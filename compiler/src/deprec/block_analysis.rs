use swc_ecma_ast::Param;
use swc_ecma_ast::Pat;
use swc_ecma_ast::{BlockStmt, Function, Id, Ident, ImportDecl, ImportSpecifier};

use swc_ecmascript::{
    ast::Expr,
    visit::{VisitMut, VisitMutWith},
};

#[derive(Debug)]
pub enum BlockAnalysisSource {
    Function,
    While,
}

#[derive(Debug)]
pub struct BlockAnalysis {
    pub module_imports: Vec<ImportDecl>,
    pub args: Vec<Param>,
    pub bound_vars: swc_common::collections::AHashSet<Id>,
    pub used_imports: Vec<String>,
    pub used_globals: Vec<String>,
    pub source: BlockAnalysisSource,
}

impl BlockAnalysis {
    pub fn analyze_function<V: VisitMutWith<Self>>(
        s: &mut V,
        imports: Vec<ImportDecl>,
        args: Vec<Param>,
        bound_vars: swc_common::collections::AHashSet<Id>,
    ) -> Self {
        let mut analysis = BlockAnalysis {
            module_imports: imports,
            used_imports: vec![],
            used_globals: vec![],
            source: BlockAnalysisSource::Function,
            args,
            bound_vars,
        };
        s.visit_mut_children_with(&mut analysis);
        analysis
    }

    pub fn analyze<V: VisitMutWith<Self>>(
        s: &mut V,
        imports: Vec<ImportDecl>,
        source: BlockAnalysisSource,
    ) -> Self {
        let mut analysis = BlockAnalysis {
            module_imports: imports,
            used_imports: vec![],
            used_globals: vec![],
            source,
            args: vec![],
            bound_vars: Default::default(),
        };
        s.visit_mut_children_with(&mut analysis);
        analysis
    }

    pub fn parent_scope_from_args(&self) -> bool {
        match self.source {
            BlockAnalysisSource::Function => true,
            _ => false,
        }
    }

    pub fn needs_parent_scope(&self) -> bool {
        self.used_globals.len() > 0
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
    fn visit_mut_block_stmt(&mut self, block_stmt: &mut BlockStmt) {
        block_stmt.visit_mut_children_with(self);
    }

    fn visit_mut_function(&mut self, _function: &mut Function) {
        // do not descend on new functions.
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if let Expr::Ident(ident) = expr {
            if self.args_includes(ident) {
            } else if self.bound_vars_includes(ident) {
            } else if self.imports_contain_ident(ident).is_some() {
                self.used_imports.push(ident.to_string());
            } else {
                self.used_globals.push(ident.to_string());
            }
        }
        expr.visit_mut_children_with(self);
    }
}
