#[cfg(test)]
mod tests;

use anyhow::{anyhow, Ok, Result};
use std::env;
use std::fs::OpenOptions;
use std::string::String;

/// pristine_stepper [id] [js_stmt]
/// Steps a Pristine function by executing [js_stmt]. If no [id].state.json, or [id].snapshot.bin exist,
/// it assumes this is the function's first step, and it expects its source to be at [id].js.
/// [id].js is not evaluated after the first step.
#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();

    v8_init();

    step_fs_process(
        args.get(1)
            .ok_or(anyhow!("missing first argument: src name, without the js"))?,
        args.get(2)
            .ok_or(anyhow!("missing stepping js expression"))?
            .clone(),
    )
    .await
    .unwrap();

    Ok(())
}

fn bytes_to_file_compress(bytes: Vec<u8>, loc: String, compress: bool) -> Result<()> {
    use brotli::CompressorWriter;
    use std::io::Write;

    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(loc)?;

    if compress {
        let mut brotli_file = CompressorWriter::new(&mut file, 4096, 5 as u32, 21 as u32);
        brotli_file.write_all(&bytes).map_err(anyhow::Error::msg)
    } else {
        file.write_all(&bytes).map_err(anyhow::Error::msg)
    }
}

#[inline]
fn bytes_to_file(bytes: Vec<u8>, loc: String) -> Result<()> {
    bytes_to_file_compress(bytes, loc, false)
}

fn file_to_bytes_decompress(loc: String, decompress: bool) -> Option<Vec<u8>> {
    use brotli::Decompressor;
    use std::io::Read;

    let mut file = OpenOptions::new().read(true).open(loc).ok()?;

    let mut bytes = Vec::new();
    if decompress {
        let mut brotli_file = Decompressor::new(&mut file, 4096);
        brotli_file.read_to_end(&mut bytes).ok()?;
    } else {
        file.read_to_end(&mut bytes).ok()?;
    }

    Some(bytes)
}

fn file_to_bytes(loc: String) -> Option<Vec<u8>> {
    file_to_bytes_decompress(loc, false)
}

async fn step_fs_process(pid: &String, js_stmt: String) -> Result<()> {
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

    bytes_to_file(new_state.into_bytes(), format!("{}.state.json", pid))?;
    bytes_to_file_compress(new_snpashot, format!("{}.snapshot.bin", pid), true)?;

    Ok(())
}

async fn step_process(
    src_loc: Option<Vec<u8>>,
    state_loc: Option<String>,
    snapshot_loc: Option<Vec<u8>>,
    js_stmt: String,
) -> Result<(String, Vec<u8>)> {
    match (src_loc, state_loc, snapshot_loc) {
        (Some(src), None, None) => {
            // First step
            let (state, snapshot) = step_process_first(src, js_stmt).await?;
            println!("state: {:?}", state);
            Ok((state, snapshot))
        }
        (None, Some(_state), Some(snapshot)) => {
            // Subsequent step
            let (new_state, new_snapshot) = step_process_subsequent(snapshot, js_stmt).await?;
            println!("state: {:?}", new_state);
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
    isolate.set_capture_stack_trace_for_uncaught_exceptions(true, 10);
    isolate
}

fn v8_init() {
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

    let new_state = {
        let scope = &mut HandleScope::new(&mut isolate);
        let context = Context::new(scope);
        scope.set_default_context(context);

        let context_scope = &mut ContextScope::new(scope, context);

        if let Some(src) = src {
            let src_code = v8::String::new_from_utf8(context_scope, &src, NewStringType::Normal)
                .ok_or(anyhow!("206"))?;
            let src_script =
                Script::compile(context_scope, src_code, None).ok_or(anyhow!("206"))?;
            _ = src_script
                .run(context_scope)
                .ok_or(anyhow!("couldnt run script"))?;
        }

        let js_stmt_code = v8::String::new(context_scope, &js_stmt).ok_or(anyhow!("206"))?;
        let js_stmt_script =
            Script::compile(context_scope, js_stmt_code, None).ok_or(anyhow!("206"))?;
        let js_stmt_result = js_stmt_script.run(context_scope).ok_or(anyhow!("206"))?;

        let new_state_json = js_stmt_result
            .to_string(context_scope)
            .ok_or(anyhow!("206"))?;
        let new_state = new_state_json.to_rust_string_lossy(context_scope);

        new_state
    };

    let snapshot_slice = {
        let snapshot = isolate
            .create_blob(FunctionCodeHandling::Keep)
            .ok_or(anyhow!("could not create snapshot"))?;
        (&*snapshot).to_vec()
    };

    Ok((new_state, snapshot_slice))
}
