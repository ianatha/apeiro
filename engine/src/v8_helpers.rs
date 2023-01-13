use apeiro_internal_api::StackTraceFrame;
use sourcemap::SourceMap;
use v8::{Context, HandleScope, Local, Value, Message};

pub fn stack_trace_to_frames<'s>(
    sm: &SourceMap,
    scope: &mut HandleScope<'s>,
    message: Local<Message>,
) -> Vec<StackTraceFrame> {
    let stack_trace = message.get_stack_trace(scope).unwrap();
    let mut result = Vec::new();
    for i in 0..stack_trace.get_frame_count() {
        let frame = stack_trace.get_frame(scope, i).unwrap();
        let script_name = match frame.get_script_name(scope) {
            Some(name) => name.to_rust_string_lossy(scope),
            None => "<unknown>".to_string(),
        };
        let line_number = frame.get_line_number();
        let column_number = frame.get_column();
        let func_name = match frame.get_function_name(scope) {
            Some(name) => name.to_rust_string_lossy(scope),
            None => "<unknown>".to_string(),
        };
        
        let original_token = sm.lookup_token(line_number as u32 - 1, column_number as u32 - 1).unwrap();

        result.push(StackTraceFrame {
            script_name,
            func_name,
            line_number: original_token.get_src_line() + 1,
            column_number: original_token.get_src_col() + 1,
        });
    }
    result
}

#[allow(dead_code)]
pub fn v8_type(val: Local<Value>) -> String {
    (if val.is_undefined() {
        "undefined"
    } else if val.is_null() {
        "null"
    } else if val.is_boolean() {
        "boolean"
    } else if val.is_number() {
        "number"
    } else if val.is_string() {
        "string"
    } else if val.is_symbol() {
        "symbol"
    } else if val.is_array() {
        "array"
    } else if val.is_function() {
        "function"
    } else if val.is_array_buffer() {
        "array_buffer"
    } else if val.is_array_buffer_view() {
        "array_buffer_view"
    } else if val.is_typed_array() {
        "typed_array"
    } else if val.is_data_view() {
        "data_view"
    } else if val.is_shared_array_buffer() {
        "shared_array_buffer".into()
    } else if val.is_proxy() {
        "proxy".into()
    } else if val.is_wasm_module_object() {
        "wasm_module_object".into()
    } else if val.is_wasm_memory_object() {
        "wasm_memory_object".into()
    } else if val.is_module() {
        "module"
    } else if val.is_module_namespace_object() {
        "module_namespace"
    } else if val.is_object() {
        "object"
    } else {
        todo!()
    })
    .into()
}

pub fn v8_println<'s>(context_scope: &mut HandleScope<'s, Context>, v8_value: Local<'s, Value>) {
    let value: serde_json::Value = serde_v8::from_v8(context_scope, v8_value).unwrap();
    let json = serde_json::to_string_pretty(&value).unwrap();
    println!("{}", json);
}

#[macro_export]
macro_rules! v8_str {
    ($scope:ident, $s:expr) => {
        v8::String::new($scope, $s).unwrap().into()
    };
    ($scope:ident / $s:expr) => {
        v8::String::new($scope, $s).unwrap()
    };
}

#[macro_export]
macro_rules! throw_exception {
    ($scope:ident, $msg:expr) => {
        let message = v8::String::new($scope, $msg).unwrap();
        let exception = v8::Exception::error($scope, message);
        $scope.throw_exception(exception);
    };
}

#[macro_export]
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

pub fn v8_struct_key<'s>(
    scope: &mut v8::HandleScope<'s>,
    field: &'static str,
) -> v8::Local<'s, v8::String> {
    // Internalized v8 strings are significantly faster than "normal" v8 strings
    // since v8 deduplicates re-used strings minimizing new allocations
    // see: https://github.com/v8/v8/blob/14ac92e02cc3db38131a57e75e2392529f405f2f/include/v8.h#L3165-L3171
    v8::String::new_from_utf8(scope, field.as_ref(), v8::NewStringType::Internalized).unwrap()
}
