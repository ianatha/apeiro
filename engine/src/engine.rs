use anyhow::{anyhow, Ok, Result};
use pristine_internal_api::ProcSendRequest;
use pristine_internal_api::StepResult;
use tokio::task;
use v8::MapFnTo;
use v8::ScriptOrigin;

use crate::dengine::DEngineCmd;
use crate::struct_method_to_v8;
use crate::v8_helpers::stack_trace_to_string;
use crate::v8_init;
use crate::v8_str;
use crate::DEngine;
use std::string::String;

use v8::{ContextScope, FunctionCodeHandling, HandleScope, Isolate, Script};

#[derive(Debug)]
pub struct Engine {
    runtime_js_src: Option<fn() -> String>,
    pub mbox: Box<Vec<serde_json::Value>>,
    pid: String,
    pub dengine: Option<DEngine>,
}

impl std::fmt::Debug for DEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("DEngine").finish()
    }
}

#[derive(Default, Debug)]
pub struct EngineInstance<'a> {
    pub usercode: Option<v8::Local<'a, v8::Module>>,
}

impl Engine {
    pub fn new(engine_runtime: Option<fn() -> String>) -> Engine {
        Engine::new_with_name(engine_runtime, "anon".into())
    }

    pub fn new_with_name(engine_runtime: Option<fn() -> String>, name: String) -> Engine {
        v8_init();
        Engine {
            runtime_js_src: engine_runtime,
            mbox: Box::new(vec![]),
            pid: name,
            dengine: None,
        }
    }

    fn setup_isolate(&self, mut isolate: v8::OwnedIsolate) -> v8::OwnedIsolate {
        isolate.set_capture_stack_trace_for_uncaught_exceptions(true, 100);
        isolate
    }

    pub async fn step_process(
        &mut self,
        src: Option<String>,
        snapshot: Option<Vec<u8>>,
        js_stmt: String,
    ) -> Result<(StepResult, Vec<u8>)> {
        let mut engine_instance = EngineInstance { usercode: None };
        let align = std::mem::align_of::<usize>();
        let layout = std::alloc::Layout::from_size_align(
            std::mem::size_of::<*mut v8::OwnedIsolate>(),
            align,
        )
        .unwrap();
        assert!(layout.size() > 0);

        let engine_external_ref = (self as *const _) as *mut std::ffi::c_void;
        let engine_instance_external_ref = (&engine_instance as *const _) as *mut std::ffi::c_void;

        let refs = v8::ExternalReferences::new(&[
            v8::ExternalReference {
                function: log_callback.map_fn_to(),
            },
            v8::ExternalReference {
                function: mbox_callback.map_fn_to(),
            },
            v8::ExternalReference {
                function: usercode_callback.map_fn_to(),
            },
            v8::ExternalReference {
                function: send_callback.map_fn_to(),
            },
            v8::ExternalReference {
                pointer: engine_instance_external_ref,
            },
            v8::ExternalReference {
                pointer: engine_external_ref,
            },
        ]);
        let refs: &'static v8::ExternalReferences = Box::leak(Box::new(refs));

        let (snapshot_creator, snapshot_existed) = match snapshot {
            Some(snapshot) => (
                Isolate::snapshot_creator_from_existing_snapshot(snapshot, Some(refs)),
                true,
            ),
            None => (Isolate::snapshot_creator(Some(refs)), false),
        };
        let mut isolate = self.setup_isolate(snapshot_creator);
        let new_state: Result<StepResult> = {
            let handle_scope = &mut HandleScope::new(&mut isolate);

            let engine_ref = v8::External::new(handle_scope, engine_external_ref);
            let engine_instance_ref = v8::External::new(handle_scope, engine_instance_external_ref);

            let log_callback_fn_builder = v8::FunctionTemplate::builder(log_callback)
                .data(engine_ref.into())
                .build(handle_scope);

            let mbox_fn_builder = v8::FunctionTemplate::builder(mbox_callback)
                .data(engine_ref.into())
                .build(handle_scope);

            let send_fn_builder = v8::FunctionTemplate::builder(send_callback)
                .data(engine_ref.into())
                .build(handle_scope);

            let usercode_fn_builder = v8::FunctionTemplate::builder(usercode_callback)
                .data(engine_instance_ref.into())
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
            global.set(
                v8::String::new(handle_scope, "$send").unwrap().into(),
                send_fn_builder.into(),
            );

            global.set(
                v8::String::new(handle_scope, "$usercode").unwrap().into(),
                usercode_fn_builder.into(),
            );

            let context = v8::Context::new_from_template(handle_scope, global);
            handle_scope.set_default_context(context);
            let context_scope = &mut ContextScope::new(handle_scope, context);

            let context_scope = &mut v8::TryCatch::new(context_scope);
            let new_state = (|| {
                let null = v8::null(context_scope).into();

                if let Some(src) = src {
                    if !snapshot_existed {
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
                    }

                    let src_code = v8::String::new(context_scope, src.as_str())
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
                        true,
                    );

                    let script = v8::script_compiler::Source::new(src_code, Some(&script_origin));

                    let module =
                        v8::script_compiler::compile_module(context_scope, script).unwrap();

                    let module_i1 = module
                        .instantiate_module(context_scope, unexpected_module_resolve_callback);
                    assert_eq!(module_i1, Some(true));
                    assert_eq!(module.get_status(), v8::ModuleStatus::Instantiated);

                    let _module_instance = module.evaluate(context_scope).unwrap();

                    engine_instance.usercode = Some(module);
                }

                println!("before kickoff");

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

                println!("res_json: {:?}", res_json);
                debug_display(res_json.clone());

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
                isolate.perform_microtask_checkpoint();

                let snapshot_slice = {
                    let snapshot = isolate
                        .create_blob(FunctionCodeHandling::Keep)
                        .ok_or(anyhow!("could not create snapshot"))?;
                    (&*snapshot).to_vec()
                };

                Ok((new_state, snapshot_slice))
            }
            Err(e) => {
                println!("error: {:?}", e);
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
        let message = if let Some(message) = args.get(0).to_string(scope) {
            message.to_rust_string_lossy(scope)
        } else {
            "empty".into()
        };
        println!("log: {}: {}", self.pid, message);

        if let Some(dengine) = self.dengine.clone() {
            let msg = args.get(0);
            let msg = serde_v8::from_v8(scope, msg).unwrap();

            let pid = self.pid.clone();
            tokio::task::spawn(async move {
                // TODO: 2nd pid should be exec
                dengine.send(DEngineCmd::Log((pid.clone(), pid, msg))).await.unwrap();
            });
        }
    }

    #[inline]
    fn mbox_callback(
        &mut self,
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        mut retval: v8::ReturnValue,
    ) {
        let _context = v8::Context::new(scope);

        let filter = serde_v8::from_v8(scope, args.get(0)).unwrap();
        let filter = serde_json_matcher::from_json(filter).unwrap();
        for (index, msg) in self.mbox.iter().enumerate() {
            if filter.matches(msg) {
                let msg = self.mbox.remove(index);
                println!(
                    "mbox: {}: found match at index {}: {:?}",
                    self.pid, index, msg
                );
                let msg = serde_v8::to_v8(scope, msg).unwrap();
                retval.set(msg);
                return;
            }
        }

        println!("no recv match found");
        // no matching value found
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

    #[inline]
    fn send_callback(
        &mut self,
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        _retval: v8::ReturnValue,
    ) {
        let _context = v8::Context::new(scope);

        println!("maybe sending to dengine");
        if let Some(dengine) = self.dengine.clone() {
            println!("sending to dengine");
            let pid = args.get(0);
            let pid: String = pid.to_rust_string_lossy(scope);

            let msg = args.get(1);
            let msg = serde_v8::from_v8(scope, msg).unwrap();

            tokio::task::spawn(async move {
                println!("about to send {} {:?}", pid, msg);
                let _ = dengine.proc_send(pid, None, ProcSendRequest { msg }).await;
                println!("sent!!");
            });
        }
    }
}

struct_method_to_v8!(log_callback -> Engine::log_callback);
struct_method_to_v8!(mbox_callback -> Engine::mbox_callback);
struct_method_to_v8!(send_callback -> Engine::send_callback);

fn usercode_callback(
    _scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut retval: v8::ReturnValue,
) {
    let external = v8::Local::<v8::External>::try_from(args.data()).unwrap();
    let struct_instance = unsafe { &mut *(external.value() as *mut EngineInstance) };
    let val = struct_instance.usercode.unwrap();
    let namespace = val.get_module_namespace();
    retval.set(namespace);
}

fn unexpected_module_resolve_callback<'a>(
    _context: v8::Local<'a, v8::Context>,
    _specifier: v8::Local<'a, v8::String>,
    _import_assertions: v8::Local<'a, v8::FixedArray>,
    _referrer: v8::Local<'a, v8::Module>,
) -> Option<v8::Local<'a, v8::Module>> {
    unreachable!()
}

fn debug_display(v: StepResult) -> Option<()> {
    let frames = v.frames?;
    let frames = frames.as_array()?;
    println!("======");
    println!("# frames: {}", frames.len());
    for frame in frames {
        let fnhash = frame.get("fnhash")?.as_str()?;
        let pc = frame.get("$pc")?.as_u64()?;
        println!("* fnhash: {}, pc: {}", fnhash, pc);
    }
    println!("");
    Some(())
}
