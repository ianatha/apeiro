#[cfg(test)]
mod tests;

mod fs;
mod v8_helpers;

use anyhow::{anyhow, Ok, Result};
use pristine_internal_api::StepResult;
use v8::MapFnTo;
use v8::ScriptOrigin;

use crate::fs::*;
use crate::v8_helpers::*;
pub use pristine_compiler::pristine_compile;
use std::string::String;
use std::sync::Once;
use v8::{ContextScope, FunctionCodeHandling, HandleScope, Isolate, NewStringType, Script};

static INIT: Once = Once::new();

#[inline(always)]
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

#[derive(Default, Debug)]
pub struct Engine {
    runtime_js_src: Option<fn() -> String>,
    mbox: Box<Vec<serde_json::Value>>,
    pid: String,
}

#[derive(Debug, Deserialize, PartialEq, Default)]
pub enum StepResultStatus {
    #[default]
    DONE,
    SUSPEND,
    ERROR,
}

#[derive(Debug, Deserialize)]
pub struct StepResult {
    pub status: StepResultStatus,
    pub val: Option<serde_json::Value>,
    // err: Option<v8::Value>,
    pub suspension: Option<serde_json::Value>,
}

pub fn get_engine_runtime() -> String {
    pristine_compiler::engine_runtime_compile(include_str!("engine_runtime.ts").into()).unwrap()
}

impl Engine {
    pub fn new(engine_runtime: Option<fn() -> String>) -> Engine {
        Engine::new_with_name(engine_runtime, "anon".into())
    }

    pub fn new_with_name(engine_runtime: Option<fn() -> String>, name: String) -> Engine {
        INIT.call_once(v8_init);
        Engine {
            runtime_js_src: engine_runtime,
            mbox: Box::new(vec![]),
            pid: name,
        }
    }

    pub async fn step_fs_process(
        &mut self,
        pid: &String,
        js_stmt: String,
        compile: bool,
    ) -> Result<StepResult> {
        let state = file_to_bytes(format!("{}.state.json", pid))
            .map(|x| std::str::from_utf8(x.as_slice()).unwrap().to_string());
        let snapshot = file_to_bytes_decompress(format!("{}.snapshot.bin", pid), true);

        let src: Option<Vec<u8>> = if state.is_none() || snapshot.is_none() {
            let src_loc = format!("{}.js", pid);
            match file_to_bytes(src_loc) {
                Some(src_bytes) => {
                    if compile {
                        let src = std::str::from_utf8(src_bytes.as_slice())
                            .unwrap()
                            .to_string();
                        Some(pristine_compile(src).unwrap().into_bytes())
                    } else {
                        Some(src_bytes)
                    }
                }
                None => None,
            }
        } else {
            None
        };

        let (new_state, new_snpashot) = self.step_process(src, snapshot, js_stmt).await?;

        bytes_to_file_compress(new_snpashot, format!("{}.snapshot.bin", pid), true)?;

        Ok(new_state)
    }

    pub async fn step_process(
        &mut self,
        src_loc: Option<Vec<u8>>,
        snapshot_loc: Option<Vec<u8>>,
        js_stmt: String,
    ) -> Result<(StepResult, Vec<u8>)> {
        match (src_loc, snapshot_loc) {
            (Some(src), None) => {
                // First step
                let (state, snapshot) = self.step_process_first(src, js_stmt).await?;
                Ok((state, snapshot))
            }
            (_, Some(snapshot)) => {
                // Subsequent step
                let (new_state, new_snapshot) =
                    self.step_process_subsequent(snapshot, js_stmt).await?;
                Ok((new_state, new_snapshot))
            }
            _ => Err(anyhow!("missing both src and snapshot")),
        }
    }

    fn setup_isolate(&self, mut isolate: v8::OwnedIsolate) -> v8::OwnedIsolate {
        isolate.set_capture_stack_trace_for_uncaught_exceptions(true, 100);
        isolate
    }

    async fn step_process_first(
        &mut self,
        src: Vec<u8>,
        js_stmt: String,
    ) -> Result<(StepResult, Vec<u8>)> {
        self.step_process_inner(Some(src), None, js_stmt).await
    }

    async fn step_process_subsequent(
        &mut self,
        snapshot: Vec<u8>,
        js_stmt: String,
    ) -> Result<(StepResult, Vec<u8>)> {
        self.step_process_inner(None, Some(snapshot), js_stmt).await
    }

    async fn step_process_inner(
        &mut self,
        src: Option<Vec<u8>>,
        snapshot: Option<Vec<u8>>,
        js_stmt: String,
    ) -> Result<(StepResult, Vec<u8>)> {
        let align = std::mem::align_of::<usize>();
        let layout = std::alloc::Layout::from_size_align(
            std::mem::size_of::<*mut v8::OwnedIsolate>(),
            align,
        )
        .unwrap();
        assert!(layout.size() > 0);

        let engine_external_ref = (self as *const _) as *mut std::ffi::c_void;

        let refs = v8::ExternalReferences::new(&[
            v8::ExternalReference {
                function: log_callback.map_fn_to(),
            },
            v8::ExternalReference {
                function: mbox_callback.map_fn_to(),
            },
            v8::ExternalReference {
                pointer: engine_external_ref,
            },
        ]);
        let refs: &'static v8::ExternalReferences = Box::leak(Box::new(refs));

        let snapshot_creator = match snapshot {
            Some(snapshot) => {
                Isolate::snapshot_creator_from_existing_snapshot(snapshot, Some(refs))
            }
            None => Isolate::snapshot_creator(Some(refs)),
        };
        let mut isolate = self.setup_isolate(snapshot_creator);
        let new_state: Result<StepResult> = {
            let handle_scope = &mut HandleScope::new(&mut isolate);

            let engine_ref = v8::External::new(handle_scope, engine_external_ref);

            let log_callback_fn_builder = v8::FunctionTemplate::builder(log_callback)
                .data(engine_ref.into())
                .build(handle_scope);

            let mbox_fn_builder = v8::FunctionTemplate::builder(mbox_callback)
                .data(engine_ref.into())
                .build(handle_scope);

            let global = v8::ObjectTemplate::new(handle_scope);
            global.set(
                v8::String::new(handle_scope, "log").unwrap().into(),
                log_callback_fn_builder.into(),
            );
            global.set(
                v8::String::new(handle_scope, "$recv").unwrap().into(),
                mbox_fn_builder.into(),
            );

            let context = v8::Context::new_from_template(handle_scope, global);
            handle_scope.set_default_context(context);
            let context_scope = &mut ContextScope::new(handle_scope, context);

            let context_scope = &mut v8::TryCatch::new(context_scope);
            let new_state = (|| {
                let null = v8::null(context_scope).into();

                if let Some(src) = src {
                    if let Some(engine_runtime_fn) = self.runtime_js_src {
                        let engine_runtime = engine_runtime_fn();
                        let engine_runtime = v8_str!(context_scope / &engine_runtime);

                        let engine_resource_name = v8_str!(context_scope / "engine").into();

                        let script_origin = &ScriptOrigin::new(
                            context_scope,
                            engine_resource_name,
                            0,
                            0,
                            false,
                            0,
                            null,
                            false,
                            false,
                            false,
                        );

                        let engine_script =
                            Script::compile(context_scope, engine_runtime, Some(script_origin))
                                .ok_or(anyhow!("207"))?;
                        _ = engine_script
                            .run(context_scope)
                            .ok_or(anyhow!("couldnt run engine script"))?;
                    }

                    let src_code =
                        v8::String::new_from_utf8(context_scope, &src, NewStringType::Normal)
                            .ok_or(anyhow!("src is too long"))?;

                    let resource_name = v8::String::new(context_scope, "src").unwrap().into();

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

                let js_stmt_code = v8::String::new(context_scope, &js_stmt)
                    .ok_or(anyhow!("js_stmt is too long"))?;
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

                let js_stmt_script =
                    Script::compile(context_scope, js_stmt_code, Some(script_origin))
                        .ok_or(anyhow!("209"))?;
                let js_stmt_result = js_stmt_script.run(context_scope).ok_or(anyhow!("210"))?;

                let res_json: StepResult = serde_v8::from_v8(context_scope, js_stmt_result)
                    .map_err(|e| anyhow!("couldnt convert to json: {}", e))?;

                Ok(res_json)
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

    #[inline]
    fn log_callback(
        &self,
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        _retval: v8::ReturnValue,
    ) {
        let message = args
            .get(0)
            .to_string(scope)
            .unwrap()
            .to_rust_string_lossy(scope);

        println!("log: {}: {}", self.pid, message);
    }

    #[inline]
    fn mbox_callback(
        &mut self,
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        mut retval: v8::ReturnValue,
    ) {
        let _context = v8::Context::new(scope);

        if self.mbox.len() == 0 {
            let exception_obj = v8::Object::new(scope);
            let key_str = v8_str!(scope / "pristine_suspend");
            let r#true = v8::Boolean::new(scope, true);
            exception_obj.set(scope, key_str.into(), r#true.into());
            let key_str = v8_str!(scope / "until");
            let until_val = if args.get(0).is_null_or_undefined() {
                r#true.into()
            } else {
                args.get(0)
            };
            exception_obj.set(scope, key_str.into(), until_val);
            scope.throw_exception(exception_obj.into());
            return;
        }

        let first_val = self.mbox.pop().unwrap();
        let first_val = serde_v8::to_v8(scope, first_val).unwrap();
        retval.set(first_val);
    }
}

macro_rules! struct_method_to_v8 {
    ($struct_less_name:ident -> $struct_type:ident :: $method:ident) => {
        fn $struct_less_name(
            scope: &mut v8::HandleScope,
            args: v8::FunctionCallbackArguments,
            retval: v8::ReturnValue,
        ) {
            let external = v8::Local::<v8::External>::try_from(args.data()).unwrap();
            let struct_instance = unsafe { &mut *(external.value() as *mut $struct_type) };
            $struct_type::$method(struct_instance, scope, args, retval);
        }
    };
}

struct_method_to_v8!(log_callback -> Engine::log_callback);
struct_method_to_v8!(mbox_callback -> Engine::mbox_callback);
