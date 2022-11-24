pub fn stack_trace_to_string<'s>(
    scope: &mut v8::HandleScope<'s>,
    stack_trace: v8::Local<v8::StackTrace>,
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
