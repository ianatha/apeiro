use anyhow::{anyhow, Ok, Result};
use v8::ScriptOrigin;

use crate::fs::*;
use crate::v8_helpers::*;
use std::string::String;

pub async fn step_fs_process(pid: &String, js_stmt: String) -> Result<String> {
    let state = file_to_bytes(format!("{}.state.json", pid))
        .map(|x| std::str::from_utf8(x.as_slice()).unwrap().to_string());
    let snapshot = file_to_bytes_decompress(format!("{}.snapshot.bin", pid), true);

    let src: Option<Vec<u8>> = if state.is_none() || snapshot.is_none() {
        let src_loc = format!("{}.js", pid);
        file_to_bytes(src_loc)
    } else {
        None
    };

    let (new_state, new_snpashot) = step_process(src, state, snapshot, js_stmt).await?;

    let result = new_state.clone();

    bytes_to_file(new_state.into_bytes(), format!("{}.state.json", pid))?;
    bytes_to_file_compress(new_snpashot, format!("{}.snapshot.bin", pid), true)?;

    Ok(result)
}

pub async fn step_process(
    src_loc: Option<Vec<u8>>,
    state_loc: Option<String>,
    snapshot_loc: Option<Vec<u8>>,
    js_stmt: String,
) -> Result<(String, Vec<u8>)> {
    match (src_loc, state_loc, snapshot_loc) {
        (Some(src), None, None) => {
            // First step
            let (state, snapshot) = step_process_first(src, js_stmt).await?;
            Ok((state, snapshot))
        }
        (None, Some(_state), Some(snapshot)) => {
            // Subsequent step
            let (new_state, new_snapshot) = step_process_subsequent(snapshot, js_stmt).await?;
            Ok((new_state, new_snapshot))
        }
        (_, Some(_), None) => Err(anyhow!(
            "Error: state.json exists, but snapshot.bin does not"
        )),
        (_, None, Some(_)) => Err(anyhow!(
            "Error: snapshot.bin exists, but state.json does not"
        )),
        _ => Err(anyhow!("missing all src, state, or snapshot")),
    }
}

fn setup_isolate(mut isolate: v8::OwnedIsolate) -> v8::OwnedIsolate {
    isolate.set_capture_stack_trace_for_uncaught_exceptions(true, 100);
    isolate
}

pub fn v8_init() {
    let flags = concat!(
        " --wasm-test-streaming",
        " --harmony-import-assertions",
        " --no-validate-asm",
        " --turbo_fast_api_calls",
    );

    v8::V8::set_flags_from_string(&format!("{}{}", flags, " --predictable --random-seed=42"));

    let v8_platform = v8::new_default_platform(0, false).make_shared();
    v8::V8::initialize_platform(v8_platform);
    v8::V8::initialize();
}

async fn step_process_first(src: Vec<u8>, js_stmt: String) -> Result<(String, Vec<u8>)> {
    step_process_inner(Some(src), None, js_stmt).await
}

async fn step_process_subsequent(snapshot: Vec<u8>, js_stmt: String) -> Result<(String, Vec<u8>)> {
    step_process_inner(None, Some(snapshot), js_stmt).await
}

async fn step_process_inner(
    src: Option<Vec<u8>>,
    snapshot: Option<Vec<u8>>,
    js_stmt: String,
) -> Result<(String, Vec<u8>)> {
    use v8::{
        Context, ContextScope, FunctionCodeHandling, HandleScope, Isolate, NewStringType, Script,
    };

    let align = std::mem::align_of::<usize>();
    let layout =
        std::alloc::Layout::from_size_align(std::mem::size_of::<*mut v8::OwnedIsolate>(), align)
            .unwrap();
    assert!(layout.size() > 0);

    let snapshot_creator = match snapshot {
        Some(snapshot) => Isolate::snapshot_creator_from_existing_snapshot(snapshot, None),
        None => Isolate::snapshot_creator(None),
    };
    let mut isolate = setup_isolate(snapshot_creator);

    let new_state: Result<String> = {
        let scope = &mut HandleScope::new(&mut isolate);
        let context = Context::new(scope);
        scope.set_default_context(context);
        let context_scope = &mut ContextScope::new(scope, context);
        let context_scope = &mut v8::TryCatch::new(context_scope);

        let new_state = (|| {
            if let Some(src) = src {
                let src_code =
                    v8::String::new_from_utf8(context_scope, &src, NewStringType::Normal)
                        .ok_or(anyhow!("src is too long"))?;

                let resource_name = v8::String::new(context_scope, "src").unwrap().into();
                let null = v8::null(context_scope).into();

                let script_origin = &ScriptOrigin::new(
                    context_scope,
                    resource_name,
                    0,
                    0,
                    false,
                    0,
                    null,
                    false,
                    false,
                    false,
                );

                let src_script = Script::compile(context_scope, src_code, Some(script_origin))
                    .ok_or(anyhow!("207"))?;
                _ = src_script
                    .run(context_scope)
                    .ok_or(anyhow!("couldnt run script"))?;
            }

            let js_stmt_code =
                v8::String::new(context_scope, &js_stmt).ok_or(anyhow!("js_stmt is too long"))?;
            let resource_name = v8::String::new(context_scope, "js_stmt").unwrap().into();
            let null = v8::null(context_scope).into();

            let script_origin = &ScriptOrigin::new(
                context_scope,
                resource_name,
                0,
                0,
                false,
                0,
                null,
                false,
                false,
                false,
            );

            let js_stmt_script = Script::compile(context_scope, js_stmt_code, Some(script_origin))
                .ok_or(anyhow!("209"))?;
            let js_stmt_result = js_stmt_script.run(context_scope).ok_or(anyhow!("210"))?;

            let new_state_json = js_stmt_result
                .to_string(context_scope)
                .ok_or(anyhow!("couldn't run statement"))?;
            Ok(new_state_json.to_rust_string_lossy(context_scope))
        })();

        match (context_scope.exception(), context_scope.message()) {
            (Some(exception), Some(message)) => {
                let exception_str = exception.to_string(context_scope).unwrap();
                let exception_str = exception_str.to_rust_string_lossy(context_scope);

                let stack_trace_str = message.get_stack_trace(context_scope).unwrap();
                let stack_trace_str = stack_trace_to_string(context_scope, stack_trace_str);
                Err(anyhow!("Exception: {} {}", exception_str, stack_trace_str))
            }
            _ => match new_state {
                Result::Ok(new_state) => Ok(new_state),
                Err(e) => Err(e),
            },
        }
    };

    match new_state {
        Result::Ok(new_state) => {
            let snapshot_slice = {
                let snapshot = isolate
                    .create_blob(FunctionCodeHandling::Keep)
                    .ok_or(anyhow!("could not create snapshot"))?;
                (&*snapshot).to_vec()
            };

            Ok((new_state, snapshot_slice))
        }
        Err(e) => {
            // we're snapshotting so no panic is caused when isolate is dropped
            _ = isolate.create_blob(FunctionCodeHandling::Keep);
            Err(e)
        }
    }
}
