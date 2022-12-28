#[cfg(test)]
mod tests;

#[allow(dead_code)]
pub mod helpers;

mod bundle_phase;
mod compile_phase;
mod either_param_to_closure;
mod fn_decl_to_fn_expr;
mod fn_instrument;
#[allow(dead_code)]
mod generator;
mod stmt_exploder;
mod utils;

pub use bundle_phase::pristine_bundle_and_compile;
pub use compile_phase::custom_pristine_compile;

use swc_common::chain;
use swc_ecma_ast::EsVersion;

use anyhow::Result;
use swc_ecma_transforms::pass::noop;

pub fn engine_runtime_compile(input: String) -> Result<String> {
    custom_pristine_compile(input, |_| noop(), false, false, false)
}

pub fn pristine_compile(input: String) -> Result<String> {
    custom_pristine_compile(
        input,
        |_| {
            chain!(
                either_param_to_closure::folder(),
                fn_decl_to_fn_expr::folder(),
                stmt_exploder::folder(),
                fn_instrument::folder(),
            )
        },
        true,
        false,
        false,
    )
}

pub(crate) const BASELINE_ES_VERSION: EsVersion = EsVersion::Es2015;
