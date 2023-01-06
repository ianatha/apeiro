use anyhow::{anyhow, Ok, Result};
use apeiro_internal_api::EngineStatus;
use apeiro_internal_api::ProcSendRequest;
use apeiro_internal_api::StepResult;
use serde_json::Value;
use tracing::{event, instrument, Level};
use v8::CreateParams;

use crate::dengine::DEngineCmd;
use crate::struct_method_to_v8;
use crate::v8_helpers::stack_trace_to_string;
use crate::v8_helpers::v8_struct_key;
use crate::v8_init;
use crate::v8_str;
use crate::DEngine;
use std::cell::RefCell;
use std::ffi::c_void;
use std::string::String;

use v8::{ContextScope, HandleScope, Isolate};

#[derive(Debug)]
pub struct Engine {
    runtime_js_src: Option<fn() -> String>,
    pub mbox: Box<Vec<serde_json::Value>>,
    proc_id: String,
    pub dengine: Option<DEngine>,
}

impl std::fmt::Debug for DEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("DEngine").finish()
    }
}

#[derive(Default, Debug)]
pub struct EngineInstance<'a> {
    pub enginecode: Option<v8::Local<'a, v8::Module>>,
    pub usercode: Option<v8::Local<'a, v8::Module>>,
    pub frames: Option<v8::Local<'a, v8::Value>>,
    pub funcs: Option<v8::Local<'a, v8::Object>>,
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
            proc_id: name,
            dengine: None,
        }
    }

    fn setup_isolate(&self, mut isolate: v8::OwnedIsolate) -> v8::OwnedIsolate {
        isolate.set_capture_stack_trace_for_uncaught_exceptions(true, 100);
        isolate
    }

    pub async fn step_process(
        &mut self,
        src: String,
        funcs: Option<Value>,
        frames: Option<Value>,
    ) -> Result<(StepResult, EngineStatus)> {
        let mut engine_instance = EngineInstance::default();
        let align = std::mem::align_of::<usize>();
        let layout = std::alloc::Layout::from_size_align(
            std::mem::size_of::<*mut v8::OwnedIsolate>(),
            align,
        )
        .unwrap();
        assert!(layout.size() > 0);

        let mut isolate = self.setup_isolate(Isolate::new(CreateParams::default()));

        let new_state: Result<(StepResult, EngineStatus)> = {
            let handle_scope = &mut HandleScope::new(&mut isolate);
            let engine_external_ref = (self as *const _) as *mut std::ffi::c_void;
            let engine_instance_external_ref =
                (&engine_instance as *const _) as *mut std::ffi::c_void;

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

            let get_frames_fn_builder = v8::FunctionTemplate::builder(frames_callback)
                .data(engine_instance_ref.into())
                .build(handle_scope);

            let get_funcs_fn_builder = v8::FunctionTemplate::builder(funcs_callback)
                .data(engine_instance_ref.into())
                .build(handle_scope);

            let get_fn_builder = v8::FunctionTemplate::builder(get_callback)
                .data(engine_ref.into())
                .build(handle_scope);

            let pid_fn_builder = v8::FunctionTemplate::builder(pid_callback)
                .data(engine_instance_ref.into())
                .build(handle_scope);

            let global = v8::ObjectTemplate::new(handle_scope);
            global.set_internal_field_count(1);
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
            global.set(
                v8::String::new(handle_scope, "$get_frames").unwrap().into(),
                get_frames_fn_builder.into(),
            );
            global.set(
                v8::String::new(handle_scope, "$get_funcs").unwrap().into(),
                get_funcs_fn_builder.into(),
            );
            global.set(
                v8::String::new(handle_scope, "$get").unwrap().into(),
                get_fn_builder.into(),
            );
            global.set(
                v8::String::new(handle_scope, "$pid").unwrap().into(),
                pid_fn_builder.into(),
            );

            let context = v8::Context::new_from_template(handle_scope, global);
            let context_scope = &mut ContextScope::new(handle_scope, context);

            if let Some(funcs) = funcs {
                let scope = &mut v8::EscapableHandleScope::new(context_scope);
                let v8_funcs = apeiro_serde::to_v8(scope, funcs).unwrap();
                let v8_funcs = apeiro_serde::resolve_ref(scope, v8_funcs);
                let v8_funcs = v8_funcs.to_object(scope).unwrap();
                // println!("v8_funcs = {:#?}", v8_type(v8_funcs));
                engine_instance.funcs = Some(scope.escape(v8_funcs));
            }

            if let Some(frames) = frames {
                let scope = &mut v8::EscapableHandleScope::new(context_scope);
                let v8_frames = apeiro_serde::to_v8(scope, frames).unwrap();
                let v8_frames = apeiro_serde::resolve_ref(scope, v8_frames);
                engine_instance.frames = Some(scope.escape(v8_frames));
            }

            let context_scope = &mut v8::TryCatch::new(context_scope);
            let new_state = (|| {
                if let Some(engine_runtime_fn) = self.runtime_js_src {
                    let engine_runtime = engine_runtime_fn();
                    let enginecode_module =
                        instantiate_module(context_scope, "engine".into(), engine_runtime).unwrap();

                    if let Some(v8_funcs) = engine_instance.funcs {
                        let enginecode_obj = enginecode_module
                            .get_module_namespace()
                            .to_object(context_scope)
                            .unwrap();
                        let fns_key = v8::String::new(context_scope, "$fns").unwrap();
                        assert!(enginecode_obj
                            .set(context_scope, fns_key.into(), v8_funcs.into())
                            .unwrap());
                    }

                    engine_instance.enginecode = Some(enginecode_module);

                    let global = context.global(context_scope);
                    export_symbols_to_global(
                        context_scope,
                        enginecode_module,
                        global,
                        vec![
                            "$fn",
                            "$new_frame",
                            "$scope",
                            "$frame_end",
                            "$isSuspendSignal",
                        ],
                    );
                }

                let usercode_module =
                    instantiate_module(context_scope, "usercode".into(), src).unwrap();
                engine_instance.usercode = Some(usercode_module);

                event!(Level::INFO, "before kickoff");

                let engine_entrypoint =
                    get_module_default(context_scope, engine_instance.enginecode.unwrap())?;
                let undefined = v8::undefined(context_scope).into();
                let js_stmt_result = engine_entrypoint
                    .call(context_scope, undefined, &[])
                    .ok_or(anyhow!("no result from $step"))?;

                let js_stmt_result_obj = js_stmt_result.to_object(context_scope).unwrap();
                let val_key = v8_struct_key(context_scope, "val");
                let new_val = js_stmt_result_obj
                    .get(context_scope, val_key.into())
                    .unwrap();

                let suspension_key = v8_struct_key(context_scope, "suspension");
                let new_suspension = js_stmt_result_obj
                    .get(context_scope, suspension_key.into())
                    .unwrap();

                engine_instance.frames = None;
                engine_instance.funcs = None;

                let obj_cache_key = v8::String::new(context_scope, "__obj_cache").unwrap();
                assert!(context
                    .global(context_scope)
                    .delete(context_scope, obj_cache_key.into(),)
                    .unwrap());

                // force GC
                context_scope.low_memory_notification();
                context_scope.perform_microtask_checkpoint();
                context_scope
                    .request_garbage_collection_for_testing(v8::GarbageCollectionType::Full);

                // fetch engine_status
                let get_engine_status = get_module_fn(
                    context_scope,
                    engine_instance.enginecode.unwrap(),
                    "$get_engine_status",
                )?;
                let v8_engine_status = get_engine_status
                    .call(context_scope, undefined, &[])
                    .ok_or(anyhow!("no result from $get_engine_status"))?;

                let v8_engine_status_obj = v8_engine_status.to_object(context_scope).unwrap();

                let fns_key = v8::String::new(context_scope, "funcs").unwrap();
                let new_fns = v8_engine_status_obj
                    .get(context_scope, fns_key.into())
                    .unwrap();

                let frames_key = v8::String::new(context_scope, "frames").unwrap();
                let new_frames = v8_engine_status_obj
                    .get(context_scope, frames_key.into())
                    .unwrap();

                context_scope.set_data(1, 100 as *mut c_void);
                let counter = RefCell::new(0);
                let (res_json, engine_status) = apeiro_serde::OBJ_COUNT_DE.set(&counter, || {
                    let new_fns: serde_json::Value =
                        apeiro_serde::from_v8(context_scope, new_fns).unwrap();

                    let new_frames: serde_json::Value =
                        apeiro_serde::from_v8(context_scope, new_frames).unwrap();

                    let mut res_json: StepResult =
                        apeiro_serde::from_v8(context_scope, js_stmt_result).unwrap();

                    if res_json.val.is_some() {
                        let new_val = apeiro_serde::resolve_ref(context_scope, new_val);

                        let global = context_scope.get_current_context().global(context_scope);
                        let disable_references_key =
                            v8::String::new(context_scope, "$$disable_references").unwrap();
                        let true_val = v8::Boolean::new(context_scope, true);
                        assert!(global
                            .set(
                                context_scope,
                                disable_references_key.into(),
                                true_val.into()
                            )
                            .unwrap());

                        let json_val: serde_json::Value =
                            apeiro_serde::from_v8(context_scope, new_val).unwrap();
                        res_json.val = Some(json_val);
                    }

                    if res_json.suspension.is_some() {
                        let new_suspension =
                            apeiro_serde::resolve_ref(context_scope, new_suspension);
                        crate::v8_helpers::v8_println(context_scope, new_suspension);
                        let global = context_scope.get_current_context().global(context_scope);
                        let disable_references_key =
                            v8::String::new(context_scope, "$$disable_references").unwrap();
                        let true_val = v8::Boolean::new(context_scope, true);
                        assert!(global
                            .set(
                                context_scope,
                                disable_references_key.into(),
                                true_val.into()
                            )
                            .unwrap());

                        let json_val: serde_json::Value =
                            apeiro_serde::from_v8(context_scope, new_suspension).unwrap();
                        res_json.suspension = Some(json_val);
                    }

                    // event!(Level::INFO, "res_json: {:?}", res_json);

                    let engine_status = EngineStatus {
                        funcs: Some(new_fns),
                        frames: Some(new_frames),
                    };

                    (res_json, engine_status)
                });

                Ok((res_json, engine_status))
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
                    Result::Ok((res_json, engine_status)) => Ok((res_json, engine_status)),
                    Err(e) => Err(e),
                },
            }
        };

        match new_state {
            Result::Ok((res_json, engine_status)) => Ok((res_json, engine_status)),
            Err(e) => {
                event!(Level::INFO, "error: {:?}", e);
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
        event!(Level::INFO, "log: {}: {}", self.proc_id, message);

        if let Some(dengine) = self.dengine.clone() {
            let msg = args.get(0);
            let counter = RefCell::new(-1);
            scope.set_data(1, usize::MAX as *mut c_void);
            let msg = apeiro_serde::OBJ_COUNT_DE
                .set(&counter, || apeiro_serde::from_v8(scope, msg).unwrap());
            let proc_id = self.proc_id.clone();
            tokio::task::spawn(async move {
                // TODO: 2nd proc_id should be exec
                dengine
                    .send(DEngineCmd::Log((proc_id.clone(), proc_id, msg)))
                    .await
                    .unwrap();
            });
        }
    }

    #[inline]
    #[instrument]
    fn mbox_callback(
        &mut self,
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        mut retval: v8::ReturnValue,
    ) {
        let _context = v8::Context::new(scope);

        let counter = RefCell::new(-1);
        scope.set_data(1, usize::MAX as *mut c_void);
        let filter = apeiro_serde::OBJ_COUNT_DE.set(&counter, || {
            apeiro_serde::from_v8(scope, args.get(0)).unwrap()
        });
        let filter = serde_json_matcher::from_json(filter).unwrap();
        for (index, msg) in self.mbox.iter().enumerate() {
            if filter.matches(msg) {
                let msg = self.mbox.remove(index);
                event!(
                    Level::INFO,
                    "mbox: {}: found match at index {}: {:?}",
                    self.proc_id,
                    index,
                    msg
                );
                let msg = apeiro_serde::to_v8(scope, msg).unwrap();
                retval.set(msg);
                return;
            }
        }

        event!(Level::INFO, "no recv match found");
        // no matching value found
        let exception_obj = v8::Object::new(scope);
        let key_str = v8_str!(scope / "apeiro_suspend");
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

        if let Some(dengine) = self.dengine.clone() {
            let proc_id = args.get(0);
            let proc_id: String = proc_id.to_rust_string_lossy(scope);

            let msg = args.get(1);
            let counter = RefCell::new(-1);
            scope.set_data(1, usize::MAX as *mut c_void);
            let msg = apeiro_serde::OBJ_COUNT_DE
                .set(&counter, || apeiro_serde::from_v8(scope, msg).unwrap());

            tokio::task::spawn(async move {
                event!(Level::INFO, "about to send {} {:?}", proc_id, msg);
                let _ = dengine
                    .proc_send(proc_id, None, ProcSendRequest { msg })
                    .await;
                event!(Level::INFO, "sent!!");
            });
        }
    }

    #[inline]
    fn pid_callback(
        &mut self,
        scope: &mut v8::HandleScope,
        _args: v8::FunctionCallbackArguments,
        mut retval: v8::ReturnValue,
    ) {
        let _context = v8::Context::new(scope);
        let res = v8::String::new(scope, self.proc_id.as_str()).unwrap();
        retval.set(res.into())
    }

    #[inline]
    fn get_callback(
        &mut self,
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        mut retval: v8::ReturnValue,
    ) {
        let _context = v8::Context::new(scope);

        if let Some(dengine) = self.dengine.clone() {
            let proc_id = args.get(0);
            let proc_id: String = proc_id.to_rust_string_lossy(scope);

            let handle = tokio::runtime::Handle::current();
            let _guard = handle.enter();
            let res = futures::executor::block_on(dengine.proc_get(proc_id)).unwrap();
            let res = serde_json::to_value(res.val.unwrap_or("false".into())).unwrap();
            let res = apeiro_serde::to_v8(scope, res).unwrap();
            retval.set(res.into());
        }
    }
}

fn export_symbols_to_global<'a>(
    scope: &mut v8::TryCatch<'a, v8::HandleScope>,
    enginecode_module: v8::Local<v8::Module>,
    global: v8::Local<v8::Object>,
    vec: Vec<&str>,
) {
    for fn_name in vec {
        let fn_func = get_module_fn(scope, enginecode_module, fn_name).unwrap();
        let fn_key = v8_str!(scope, fn_name);
        global.set(scope, fn_key, fn_func.into());
    }
}

struct_method_to_v8!(log_callback -> Engine::log_callback);
struct_method_to_v8!(mbox_callback -> Engine::mbox_callback);
struct_method_to_v8!(send_callback -> Engine::send_callback);
struct_method_to_v8!(get_callback -> Engine::get_callback);
struct_method_to_v8!(pid_callback -> Engine::pid_callback);

fn frames_callback(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut retval: v8::ReturnValue,
) {
    let external = v8::Local::<v8::External>::try_from(args.data()).unwrap();
    let struct_instance = unsafe { &mut *(external.value() as *mut EngineInstance) };
    let val = struct_instance
        .frames
        .unwrap_or(v8::Array::new(scope, 0).into());
    retval.set(val);
}

fn funcs_callback(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
    mut retval: v8::ReturnValue,
) {
    let external = v8::Local::<v8::External>::try_from(args.data()).unwrap();
    let struct_instance = unsafe { &mut *(external.value() as *mut EngineInstance) };
    let val = struct_instance.funcs.unwrap_or({
        let obj = v8::Object::new(scope);
        let scope_last_id_key = v8_str!(scope, "$scopeLastId");
        let scope_last_id_val = v8::Integer::new(scope, 0);
        obj.set(scope, scope_last_id_key, scope_last_id_val.into());
        obj
    });
    retval.set(val.into());
}

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

pub fn get_module_fn<'a>(
    scope: &mut v8::TryCatch<'a, v8::HandleScope>,
    module: v8::Local<v8::Module>,
    name: &str,
) -> Result<v8::Local<'a, v8::Function>, anyhow::Error> {
    let namespace_obj = module.get_module_namespace().to_object(scope).unwrap();
    let name_v8 = v8::String::new(scope, name).unwrap();
    let exported_value = namespace_obj.get(scope, name_v8.into()).unwrap();
    if exported_value.is_function() {
        let function: v8::Local<'a, v8::Function> = unsafe { v8::Local::cast(exported_value) };
        Ok(function)
    } else {
        Err(anyhow!("{} not a function in module", name))
    }
}

pub fn get_module_default<'a>(
    scope: &mut v8::TryCatch<'a, v8::HandleScope>,
    module: v8::Local<v8::Module>,
) -> Result<v8::Local<'a, v8::Function>, anyhow::Error> {
    get_module_fn(scope, module, "default")
}

pub fn instantiate_module<'a>(
    scope: &mut v8::HandleScope<'a>,
    name: String,
    src: String,
) -> Result<v8::Local<'a, v8::Module>, anyhow::Error> {
    let null = v8::null(scope).into();

    let src = v8::String::new(scope, src.as_str()).unwrap();
    let name = v8::String::new(scope, name.as_str()).unwrap();
    let script_origin =
        &v8::ScriptOrigin::new(scope, name.into(), 0, 0, false, 0, null, false, false, true);
    let script = v8::script_compiler::Source::new(src, Some(&script_origin));
    let module = v8::script_compiler::compile_module(scope, script).unwrap();
    let module_instantiation = module.instantiate_module(scope, unexpected_module_resolve_callback);
    if module_instantiation == Some(true) && module.get_status() == v8::ModuleStatus::Instantiated {
        let _module_instance = module.evaluate(scope).unwrap();
        if module.get_status() == v8::ModuleStatus::Evaluated {
            Ok(module)
        } else {
            let e = module.get_exception();
            let exception = e.to_string(scope).unwrap();
            let exception = exception.to_rust_string_lossy(scope);
            Err(anyhow!(exception))
        }
    } else {
        Err(anyhow!("module instantiation failed"))
    }
}
