use swc_common::Spanned;
use swc_common::{util::take::Take, DUMMY_SP};
use swc_ecma_ast::{
    CallExpr, Callee, DefaultDecl, ExportDefaultExpr, ExprOrSpread, FnExpr, ModuleDecl,
};

use swc_ecma_utils::{quote_ident, quote_str};

use swc_ecmascript::visit::{as_folder, Fold};
use swc_ecmascript::{
    ast::Expr,
    visit::{VisitMut, VisitMutWith},
};

use super::utils::ast_to_hash;

pub fn folder(wrapping_function: String) -> impl Fold {
    as_folder(VisitorFnWrap {
        wrapping_function: wrapping_function,
    })
}

struct VisitorFnWrap {
    wrapping_function: String,
}

impl VisitorFnWrap {
    fn expr_from_fn_expr(&mut self, fn_expr: &mut FnExpr) -> Expr {
        let hash = ast_to_hash(fn_expr);
        Expr::Call(CallExpr {
            span: fn_expr.span(),
            callee: Callee::Expr(quote_ident!(self.wrapping_function.clone()).into()),
            args: vec![
                ExprOrSpread {
                    spread: None,
                    expr: fn_expr.take().into(),
                },
                ExprOrSpread {
                    spread: None,
                    expr: quote_str!(hash.to_string()).into(),
                },
            ],
            type_args: None,
        })
    }
}

/// Expects all functions to be expressions (which FunctionDeclsToExprs does).
impl VisitMut for VisitorFnWrap {
    fn visit_mut_module_decl(&mut self, decl: &mut ModuleDecl) {
        if let ModuleDecl::ExportDefaultDecl(export_default_decl) = decl {
            if let DefaultDecl::Fn(fn_expr) = &mut export_default_decl.decl {
                fn_expr.visit_mut_with(self);
                *decl = ModuleDecl::ExportDefaultExpr(ExportDefaultExpr {
                    span: DUMMY_SP,
                    expr: self.expr_from_fn_expr(fn_expr).into(),
                });
            }
        } else {
            decl.visit_mut_children_with(self);
        }
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if let Expr::Fn(fn_expr) = expr {
            fn_expr.visit_mut_children_with(self);
            *expr = self.expr_from_fn_expr(fn_expr);
        } else {
            expr.visit_mut_children_with(self);
        }
    }
}
