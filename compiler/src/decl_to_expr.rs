use swc_common::util::take::Take;
use swc_common::Spanned;
use swc_ecma_ast::{
    Decl, DefaultDecl, ExportDefaultDecl, ExportDefaultExpr, Expr, FnExpr, Module, ModuleDecl,
    ModuleItem, VarDecl, VarDeclKind, VarDeclarator, ClassExpr,
};

use swc_ecmascript::visit::{as_folder, Fold};
use swc_ecmascript::visit::{VisitMut, VisitMutWith};

pub fn folder() -> impl Fold {
    as_folder(DeclToExpr {})
}

struct DeclToExpr;

impl VisitMut for DeclToExpr {
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
        match decl {
            Decl::Fn(fn_decl) => {
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
            }
            Decl::Class(class_decl) => {
                *decl = VarDecl {
                    span: class_decl.span(),
                    kind: VarDeclKind::Let,
                    declare: false,
                    decls: vec![VarDeclarator {
                        span: class_decl.class.span(),
                        name: class_decl.ident.clone().into(),
                        definite: false,
                        init: Some(
                            ClassExpr {
                                ident: Some(class_decl.ident.take()),
                                class: class_decl.class.take(),
                            }
                            .into(),
                        ),
                    }],
                }
                .into();
            }
            Decl::Var(_) => todo!(),
            Decl::TsInterface(_) => todo!("typescript interface declaration"),
            Decl::TsTypeAlias(_) => todo!("typescript type alias declaration"),
            Decl::TsEnum(_) => todo!("typescript enum declaration"),
            Decl::TsModule(_) => todo!("typescript module declaration"),
        }
        decl.visit_mut_children_with(self);
    }
}
