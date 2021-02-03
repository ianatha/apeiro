use swc_common::util::take::Take;
use swc_common::Spanned;
use swc_ecma_ast::{Decl, FnExpr, VarDecl, VarDeclKind, VarDeclarator};

use swc_ecmascript::visit::{as_folder, Fold};
use swc_ecmascript::visit::{VisitMut, VisitMutWith};

pub fn folder() -> impl Fold {
    as_folder(VisitorFnDeclToFnExpr {})
}

struct VisitorFnDeclToFnExpr;

impl VisitMut for VisitorFnDeclToFnExpr {
    fn visit_mut_decl(&mut self, decl: &mut Decl) {
        if let Decl::Fn(fn_decl) = decl {
            *decl = VarDecl {
                span: fn_decl.span(),
                kind: VarDeclKind::Var,
                declare: false,
                decls: vec![VarDeclarator {
                    span: fn_decl.function.span(),
                    name: fn_decl.ident.clone().into(),
                    definite: false,
                    init: Some(
                        FnExpr {
                            ident: Some(fn_decl.ident.take()),
                            function: fn_decl.function.take(),
                        }
                        .into(),
                    ),
                }],
            }
            .into();
        } else {
            decl.visit_mut_children_with(self);
        }
    }
}
