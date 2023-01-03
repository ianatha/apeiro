use v8::{Array, Context, HandleScope, Local, StackTrace, Value};

pub fn stack_trace_to_string<'s>(
    scope: &mut HandleScope<'s>,
    stack_trace: Local<StackTrace>,
) -> String {
    let mut stack_trace_str = String::new();
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
        stack_trace_str.push_str(&format!(
            "at {} ({}, line {}, column {})",
            script_name, func_name, line_number, column_number
        ));
    }
    stack_trace_str
}

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

pub fn v8_println_array(context_scope: &mut HandleScope<Context>, props: Local<Array>) {
    if props.length() == 0 {
        println!("empty array");
        return;
    }
    for i in 0..props.length() - 1 {
        let prop = props.get_index(context_scope, i).unwrap();
        let prop_str = prop.to_rust_string_lossy(context_scope);
        println!("{} (type: {})", prop_str, v8_type(prop));
    }
    println!("----");
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
