use super::compiler_test;
use crate::fn_decl_to_fn_expr;

#[test]
fn test_fn_decl_to_fn_expr_simple() {
    compiler_test(
        "function one() { return 1; }",
        |_| fn_decl_to_fn_expr::folder(),
        r#"let one = function one() {
    return 1;
};
"#,
    );
}

#[test]
fn test_fn_decl_to_fn_expr_export_default() {
    compiler_test(
        "export default function sum(a, b) { return a + b; }",
        |_| fn_decl_to_fn_expr::folder(),
        "let sum = function(a, b) {
    return a + b;
};
export default sum;
",
    );
}

#[test]
fn test_fn_decl_to_fn_expr_export_named() {
    compiler_test(
        "export function sum(a, b) { return a + b; }",
        |_| fn_decl_to_fn_expr::folder(),
        r#"export let sum = function sum(a, b) {
    return a + b;
};
"#,
    );
}
