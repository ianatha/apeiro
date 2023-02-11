use swc_ecma_ast::{Function, Id, Ident, ImportDecl, ImportSpecifier};
use swc_ecma_ast::Param;
use swc_ecma_ast::Pat;

use swc_ecmascript::{
    ast::Expr,
    visit::{VisitMut, VisitMutWith},
};

#[derive(Default, Debug, Clone)]
pub(crate) struct BlockAnalysisResult {
    pub used_imports: Vec<String>,
    pub used_globals: Vec<String>,
    pub args: Vec<Param>,
}

impl BlockAnalysisResult {
    pub fn needs_parent_scope(&self) -> bool {
        self.used_globals.len() > 0
    }
}

#[derive(Default, Debug)]
pub(crate) struct BlockAnalysis {
    pub module_imports: Vec<ImportDecl>,
    pub args: Vec<Param>,
    pub bound_vars: swc_common::collections::AHashSet<Id>,
    pub result: BlockAnalysisResult,
}

impl BlockAnalysis {
    pub(crate) fn result(mut self) -> BlockAnalysisResult {
        self.result.args = self.args;
        self.result
    }

    fn imports_contain_ident(&self, ident: &Ident) -> Option<ImportDecl> {
        self.module_imports
            .iter()
            .find(|x| {
                x.specifiers
                    .iter()
                    .find(|import_specifier| {
                        if let ImportSpecifier::Named(import_named_specifier) = import_specifier {
                            ident.to_id() == import_named_specifier.local.to_id()
                        } else {
                            false
                        }
                    })
                    .is_some()
            })
            .map(|x| x.clone())
    }

    fn args_includes(&self, ident: &Ident) -> bool {
        self.args
            .iter()
            .find(|x| {
                if let Pat::Ident(binding_ident) = &x.pat {
                    binding_ident.to_id() == ident.to_id()
                } else {
                    false
                }
            })
            .is_some()
    }

    fn bound_vars_includes(&self, ident: &Ident) -> bool {
        self.bound_vars.contains(&ident.to_id())
    }
}

impl VisitMut for BlockAnalysis {
    fn visit_mut_function(&mut self, _function: &mut Function) {
        // do not descend on new functions.
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if let Expr::Ident(ident) = expr {
            if self.args_includes(ident) {
            } else if self.bound_vars_includes(ident) {
            } else if self.imports_contain_ident(ident).is_some() {
                self.result.used_imports.push(ident.to_string());
            } else {
                self.result.used_globals.push(ident.to_string());
            }
        }
        expr.visit_mut_children_with(self);
    }
}