#[cfg(test)]
mod tests;

#[allow(dead_code)]
pub mod helpers;

mod compile_phase;
mod either_param_to_closure;
mod fn_decl_to_fn_expr;
mod fn_instrument;
#[allow(dead_code)]
mod generator;
mod stmt_exploder;
mod utils;

pub use compile_phase::custom_apeiro_compile;
use compile_phase::ApeiroCompiler;

use swc_core::common::chain;
use swc_core::ecma::ast::EsVersion;

use anyhow::Result;
use swc_core::ecma::transforms::base::pass::noop;

pub fn engine_runtime_compile(input: String) -> Result<String> {
    Ok(custom_apeiro_compile(input, |_| noop(), false, false, false)?.compiled_src)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProgramCounterToSourceLocation {
    pub fnhash: u64,
    pub pc: i32,
    pub start_loc: u32,
    pub end_loc: u32,
}

#[derive(Debug)]
pub struct CompilationResult {
    pub compiled_src: String,
    pub source_map: Option<String>,
    pub program_counter_mapping: Vec<ProgramCounterToSourceLocation>,
}

fn now_as_millis() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    start
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_millis()
}

fn default_name() -> String {
    format!("untitled{}", now_as_millis())
}

fn top_level_from_program(parsed: &swc_core::ecma::ast::Program) -> Option<String> {
    match parsed.as_module() {
        Some(module) => module.body.iter().find_map(|stmt| match stmt {
            swc_core::ecma::ast::ModuleItem::ModuleDecl(swc_core::ecma::ast::ModuleDecl::ExportDefaultExpr(
                default_expr,
            )) => match &*default_expr.expr {
                swc_core::ecma::ast::Expr::Ident(ident) => Some(ident.sym.to_string()),
                _ => None,
            },
            swc_core::ecma::ast::ModuleItem::ModuleDecl(swc_core::ecma::ast::ModuleDecl::ExportDefaultDecl(
                default_decl,
            )) => match &default_decl.decl {
                swc_core::ecma::ast::DefaultDecl::Fn(f) => match &f.ident {
                    Some(ident) => Some(ident.sym.to_string()),
                    _ => None,
                },
                _ => None,
            },
            _ => None,
        }),
        _ => None,
    }
}

pub fn extract_export_name(input: String) -> String {
    let compiler = ApeiroCompiler::new();
    if let Ok((_source_file, parsed)) = swc_core::common::GLOBALS.set(&swc_core::common::Globals::new(), || {
        compiler.parse("".to_string(), input)
    }) {
        if let Some(name) = top_level_from_program(&parsed) {
            return name;
        }
    }
    return default_name();
}

pub fn apeiro_bundle_and_compile(src: String) -> Result<CompilationResult, anyhow::Error> {
    let compiler = crate::compile_phase::ApeiroCompiler::new();
    compiler.bundle_main(src, false)
}

pub fn apeiro_compile(input: String) -> Result<CompilationResult> {
    custom_apeiro_compile(
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
