mod test_either_param_to_closure;
mod test_fn_decl_to_fn_expr;
mod test_fn_instrument;

use crate as compiler;

pub fn compiler_test<P>(
    input: &str,
    folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
    expected: &str,
) where
    P: swc_ecmascript::visit::Fold,
{
    let out =
        compiler::custom_pristine_compile(input.to_string(), folder_chain, false, true, false)
            .unwrap();
    if out != expected.to_string() {
        println!("\n# Output was:\n<<<<\n{}\n>>>>>\n", out);
        assert_eq!(out.trim(), expected.to_string().trim());
    }
}
