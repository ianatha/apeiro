mod test_bundle;
mod test_capture_frames;
mod test_capture_scopes;
mod test_decl_to_expr;
mod test_stmt_exploder;

use crate::{self as compiler, extract_export_name};

pub fn functional_compiler_test<P>(
    js: &str,
    folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
    tests_and_excpetations: Vec<(&str, &str)>,
) where
    P: swc_ecmascript::visit::Fold,
{
    let external_helpers = false;
    let out = compiler::custom_apeiro_compile(
        js.to_string(),
        folder_chain,
        false,
        external_helpers,
        false,
    )
    .unwrap();

    println!("{}", out.compiled_src);

    v8_do(|| {
        let mut isolate = v8::Isolate::new(v8::CreateParams::default());
        let mut top_scope = &mut v8::HandleScope::new(&mut isolate);
        let context = v8::Context::new(&mut top_scope);
        let scope = &mut v8::ContextScope::new(top_scope, context);

        js_exec(scope, out.compiled_src.as_str());

        tests_and_excpetations.iter().for_each(|(test, expected)| {
            let output = js_exec(scope, test).unwrap();
            let output = output.to_rust_string_lossy(scope);
            assert_eq!(output, expected.to_string());
        });
    });
}

pub fn compiler_test<P>(
    input: &str,
    folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
    expected: &str,
) where
    P: swc_ecmascript::visit::Fold,
{
    let external_helpers = true;
    let out = compiler::custom_apeiro_compile(
        input.to_string(),
        folder_chain,
        false,
        external_helpers,
        false,
    )
    .unwrap();

    if out.compiled_src != expected.to_string() {
        println!("\n# Output was:\n<<<<\n{}\n>>>>>\n", out.compiled_src);
        assert_eq!(out.compiled_src.trim(), expected.to_string().trim());
    }
}

pub fn v8_init() {
    let platform = v8::new_default_platform(0, false).make_shared();
    v8::V8::initialize_platform(platform);
    v8::V8::initialize();
}

pub fn v8_do<R>(f: impl FnOnce() -> R) -> R {
    static V8_INIT: std::sync::Once = std::sync::Once::new();
    V8_INIT.call_once(|| {
        v8_init();
    });
    f()
}

pub fn js_exec<'s>(scope: &mut v8::HandleScope<'s>, src: &str) -> Option<v8::Local<'s, v8::Value>> {
    let code = v8::String::new(scope, src).unwrap();
    let script = v8::Script::compile(scope, code, None).unwrap();
    script.run(scope)
}

#[test]
pub fn test_extract_export_name_1() {
    let res = extract_export_name(
        r#"export default function hello_world() {
        return "Hello, world!";
    }"#
        .to_string(),
    );
    assert_eq!(res, "hello_world".to_string());
}

#[test]
pub fn test_extract_export_name_2() {
    let res = extract_export_name(
        r#"function hello_world() {
        return "Hello, world!";
    };
    
    export default hello_world;"#
            .to_string(),
    );
    assert_eq!(res, "hello_world".to_string());
}
