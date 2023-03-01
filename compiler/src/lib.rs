///
/// The standard pipeline is
/// 0. prepare & simplify
///     a. ES5 helpers
///     b. for_stmt_to_while_stmt
///     c. decl_to_expr
/// 2. stmt_exploder
/// 3. capture_scopes
/// 4. capture_frames
/// 5. hide_internal_arguments
///
#[cfg(test)]
mod tests;

#[allow(dead_code)]
pub mod helpers;

mod decl_to_expr;
mod for_stmt_to_while_stmt;

mod capture_frames;
mod capture_scopes;
mod hide_internal_arguments;
mod stmt_exploder;

mod utils;

mod compile_phase;

pub use compile_phase::custom_apeiro_compile;
use compile_phase::ApeiroCompiler;

use swc_common::{chain, Spanned};
use swc_ecma_ast::EsVersion;

use anyhow::Result;
use swc_ecma_transforms::pass::noop;

const APEIRO_INTERNAL_SYNTAX_CONTEXT: u32 = 0xA931120;

pub trait ApeiroInternalSyntaxContext {
    fn is_apeiro_internal_syntax_context(&self) -> bool;
}

impl<T> ApeiroInternalSyntaxContext for T
where
    T: Spanned,
{
    fn is_apeiro_internal_syntax_context(&self) -> bool {
        self.span().ctxt.as_u32() == APEIRO_INTERNAL_SYNTAX_CONTEXT
    }
}

pub fn engine_runtime_compile(input: String) -> Result<String> {
    Ok(custom_apeiro_compile(input, |_| noop(), false, helpers::HelpersSetting::Inline, false)?.compiled_src)
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

fn top_level_from_program(parsed: &swc_ecma_ast::Program) -> Option<String> {
    match parsed.as_module() {
        Some(module) => module.body.iter().find_map(|stmt| match stmt {
            swc_ecma_ast::ModuleItem::ModuleDecl(swc_ecma_ast::ModuleDecl::ExportDefaultExpr(
                default_expr,
            )) => match &*default_expr.expr {
                swc_ecma_ast::Expr::Ident(ident) => Some(ident.sym.to_string()),
                _ => None,
            },
            swc_ecma_ast::ModuleItem::ModuleDecl(swc_ecma_ast::ModuleDecl::ExportDefaultDecl(
                default_decl,
            )) => match &default_decl.decl {
                swc_ecma_ast::DefaultDecl::Fn(f) => match &f.ident {
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
    if let Ok((_source_file, parsed)) = swc_common::GLOBALS.set(&swc_common::Globals::new(), || {
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
    compiler.bundle(src, false)
}

#[inline]
fn _apeiro_compile(input: String, for_repl: bool) -> Result<CompilationResult> {
    if !for_repl {
        custom_apeiro_compile(
            input,
            |_| { chain!(
                // either_param_to_closure::folder(),
                decl_to_expr::folder(),
                for_stmt_to_while_stmt::folder(),
                stmt_exploder::folder(),
                capture_scopes::folder(),
                capture_frames::folder(),
                hide_internal_arguments::folder(),
                // fn_instrument::folder(),
            ) },
            true,
            helpers::HelpersSetting::Inline,
            false,
        )
    } else {
        custom_apeiro_compile(
            input,
            |_| { chain!(
                // either_param_to_closure::folder(),
                decl_to_expr::folder(),
                for_stmt_to_while_stmt::folder(),
                stmt_exploder::folder(),
                capture_scopes::folder_for_repl(),
                capture_frames::folder(),
                hide_internal_arguments::folder(),
                // fn_instrument::folder(),
            ) },
            false,
            helpers::HelpersSetting::Nothing,
            false,
        )
    }
}

pub fn apeiro_compile(input: String) -> Result<CompilationResult> {
    _apeiro_compile(input, false)
}

pub fn apeiro_compile_for_repl(input: String) -> Result<CompilationResult> {
    _apeiro_compile(input, true)
}

pub(crate) const BASELINE_ES_VERSION: EsVersion = EsVersion::Es2022;
