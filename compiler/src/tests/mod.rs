mod test_bundle;
mod test_either_param_to_closure;
mod test_decl_to_expr;
mod test_fn_instrument;
mod test_stmt_exploder;

use crate::{self as compiler, extract_export_name};

pub fn compiler_test<P>(
    input: &str,
    folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
    expected: &str,
) where
    P: swc_ecmascript::visit::Fold,
{
    let out = compiler::custom_apeiro_compile(input.to_string(), folder_chain, false, true, false)
        .unwrap();
    if out.compiled_src != expected.to_string() {
        println!("\n# Output was:\n<<<<\n{}\n>>>>>\n", out.compiled_src);
        assert_eq!(out.compiled_src.trim(), expected.to_string().trim());
    }
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
