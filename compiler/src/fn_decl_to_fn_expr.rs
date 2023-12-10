use swc_core::{
    common::{util::take::Take, Spanned},
    ecma::{
        ast::{
            Decl, DefaultDecl, ExportDefaultDecl, ExportDefaultExpr, Expr, FnExpr, Module,
            ModuleDecl, ModuleItem, VarDecl, VarDeclKind, VarDeclarator,
        },
        visit::{as_folder, Fold, VisitMut, VisitMutWith},
    },
};

pub fn folder() -> impl Fold {
    as_folder(VisitorFnDeclToFnExpr {})
}

struct VisitorFnDeclToFnExpr;

impl VisitMut for VisitorFnDeclToFnExpr {
    fn visit_mut_module(&mut self, module: &mut Module) {
        let mut new_items = vec![];
        for module_item in module.body.iter_mut() {
            match module_item {
                ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(ExportDefaultDecl {
                    decl:
                        DefaultDecl::Fn(FnExpr {
                            ident: Some(ident),
                            function,
                            ..
                        }),
                    ..
                })) => {
                    let var_decl = VarDecl {
                        span: ident.span,
                        kind: VarDeclKind::Let,
                        declare: false,
                        decls: vec![VarDeclarator {
                            span: ident.span,
                            name: ident.clone().into(),
                            init: Some(function.take().into()),
                            definite: false,
                        }],
                    };
                    new_items.push(var_decl.into());
                    new_items.push(ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(
                        ExportDefaultExpr {
                            span: ident.span,
                            expr: Expr::Ident(ident.take()).into(),
                        },
                    )));
                }
                _ => {
                    module_item.visit_mut_with(self);
                    new_items.push(module_item.take());
                }
            }
        }
        module.body = new_items;
    }

    fn visit_mut_decl(&mut self, decl: &mut Decl) {
        if let Decl::Fn(fn_decl) = decl {
            *decl = VarDecl {
                span: fn_decl.span(),
                kind: VarDeclKind::Let,
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
