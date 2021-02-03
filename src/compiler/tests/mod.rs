use crate::compiler::{self, either_param_to_closure, fn_instrument, fn_wrap};

use swc_common::chain;

use super::fn_decl_to_fn_expr;

fn compiler_test<P>(
    input: &str,
    folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
    expected: &str,
) where
    P: swc_ecmascript::visit::Fold,
{
    let out = compiler::custom_pristine_compile(input.to_string(), folder_chain, false).unwrap();
    if out != expected.to_string() {
        println!("\n# Output was:\n<<<<\n{}\n>>>>>\n", out);
        assert_eq!(out, expected.to_string());
    }
}

#[test]
fn test_either_param_to_closure() {
    compiler_test(
        r#"function one() {
    either([
        [suspend(1, 2), (received) => console.log(received)],
        [suspend(3, 4), function (received) {
            return console.log(received);
        }],
    ]);
}"#,
        |_| either_param_to_closure::folder(),
        r#"function one() {
    either([
        [
            ()=>suspend(1, 2),
            (received)=>console.log(received)
        ],
        [
            ()=>suspend(3, 4),
            function(received) {
                return console.log(received);
            }
        ]
    ]);
}
"#,
    );
}

#[test]
fn test_fn_decl_to_fn_expr_simple() {
    compiler_test(
        "function one() { return 1;}",
        |_| fn_decl_to_fn_expr::folder(),
        r#"var one = function one() {
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
        "export default function sum(a, b) {
    return a + b;
}
",
    );
}

#[test]
fn test_fn_decl_to_fn_expr_export_named() {
    compiler_test(
        "export function sum(a, b) { return a + b; }",
        |_| fn_decl_to_fn_expr::folder(),
        r#"export var sum = function sum(a, b) {
    return a + b;
};
"#,
    );
}

#[test]
fn test_fn_wrap_simple() {
    compiler_test(
        "function one() { return 1;}",
        |_| {
            chain!(
                fn_decl_to_fn_expr::folder(),
                fn_wrap::folder("$fn".to_string()),
            )
        },
        r#"var one = $fn(function one() {
    return 1;
}, "14146478158333422237");
"#,
    );
}

#[test]
fn test_fn_wrap_export_default() {
    compiler_test(
        "export default function sum(a, b) { return a + b; }",
        |_| {
            chain!(
                fn_decl_to_fn_expr::folder(),
                fn_wrap::folder("$fn".to_string()),
            )
        },
        r#"export default $fn(function sum(a, b) {
    return a + b;
}, "10735822781612323506");
"#,
    );
}

#[test]
fn test_fn_wrap_export_named() {
    compiler_test(
        "export function sum(a, b) { return a + b; }",
        |_| {
            chain!(
                fn_decl_to_fn_expr::folder(),
                fn_wrap::folder("$fn".to_string()),
            )
        },
        r#"export var sum = $fn(function sum(a, b) {
    return a + b;
}, "10735822781612323506");
"#,
    );
}

#[test]
fn test_fn_instrument() {
    compiler_test(
        include_str!("fn_instrument.simple.in.ts"),
        |_| fn_instrument::folder(),
        include_str!("fn_instrument.simple.out.js"),
    );
}
