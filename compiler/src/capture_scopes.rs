/***
 * Expects `decl_to_expr` to have ran before.
 */
use swc_common::util::take::Take;
use swc_common::{Spanned, SyntaxContext, DUMMY_SP};
use swc_ecma_ast::{
    AssignExpr, AssignOp, BlockStmt, CallExpr, ExprStmt, FnDecl, Id, Ident, KeyValueProp,
    MemberExpr, MemberProp, Module, ObjectLit, Pat, PatOrExpr, Prop, SeqExpr, Stmt, VarDecl,
    VarDeclKind, VarDeclarator,
};

use crate::APEIRO_INTERNAL_SYNTAX_CONTEXT;
use swc_ecma_utils::{private_ident, quote_ident, ExprFactory};
use swc_ecmascript::visit::{as_folder, Fold};
use swc_ecmascript::{
    ast::Expr,
    visit::{VisitMut, VisitMutWith},
};

use crate::helper;

pub fn folder() -> impl Fold {
    as_folder(CaptureScopes::new(false))
}

pub fn folder_for_repl() -> impl Fold {
    as_folder(CaptureScopes::new(true))
}

#[derive(Default)]
struct CaptureScopes {
    repl_mode: bool,
    uncaptured_idents: Vec<Id>,
    captured_vars: Vec<Id>,
    scope_identifiers: Vec<Ident>,
}

impl CaptureScopes {
    fn new(repl_mode: bool) -> Self {
        let result = CaptureScopes {
            repl_mode,
            ..Default::default()
        };

        result
    }

    fn new_scope_identifier(&mut self) -> Ident {
        let ident = private_ident!(format!("$scope"));
        self.scope_identifiers.push(ident.clone());
        ident
    }

    fn current_scope_identifier(&self) -> Option<Ident> {
        self.scope_identifiers.last().map(|x| x.clone())
    }

    fn scope_decl(
        &mut self,
        scope_ident: &Ident,
        previous_scope_ident: &Ident,
        needs_parent_scope: bool,
        _parent_scope_from_args: bool,
    ) -> Stmt {
        let call_expr = CallExpr {
            span: DUMMY_SP,
            type_args: None,
            callee: helper!(new_scope, "$$new_scope"),
            args: match needs_parent_scope {
                true => vec![previous_scope_ident.clone().as_arg()],
                false => vec![],
            },
        };

        let mut result = VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Let,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: scope_ident.clone().into(),
                definite: false,
                init: Some(call_expr.into()),
            }],
        };

        result.span.ctxt = SyntaxContext::from_u32(APEIRO_INTERNAL_SYNTAX_CONTEXT);

        result.into()
    }

    fn should_move_to_scope(&self, ident: &Id) -> bool {
        if self.repl_mode {
            let str = ident.0.to_string();
            str != "console" && !self.uncaptured_idents.contains(&ident)
        } else {
            self.captured_vars.contains(&ident)
        }
    }
}

impl VisitMut for CaptureScopes {
    fn visit_mut_block_stmt(&mut self, block_stmt: &mut BlockStmt) {
        let previous_scope_ident = self
            .current_scope_identifier()
            .unwrap_or(private_ident!("undefined"));
        let scope_ident = self.new_scope_identifier();
        block_stmt.visit_mut_children_with(self);
        block_stmt.stmts.insert(
            0,
            self.scope_decl(&scope_ident, &previous_scope_ident, true, false),
        );
        self.scope_identifiers.pop();
    }

    fn visit_mut_module(&mut self, module: &mut Module) {
        let previous_scope_ident = self
            .current_scope_identifier()
            .unwrap_or(private_ident!("undefined"));
        let scope_ident = self.new_scope_identifier();
        module.body.visit_mut_children_with(self);
        if !self.repl_mode {
            module.body.insert(
                0,
                self.scope_decl(&scope_ident, &previous_scope_ident, true, false)
                    .into(),
            );
        }
        self.scope_identifiers.pop();
    }

    fn visit_mut_fn_decl(&mut self, _fn_decl: &mut FnDecl) {
        panic!("must use decl_to_expr first");
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        let span = expr.span();
        if expr.is_ident() {
            expr.visit_mut_children_with(self);

            let ident = expr.as_mut_ident().unwrap();
            if self.should_move_to_scope(&ident.to_id()) {
                let current_scope = self.current_scope_identifier().unwrap();
                *expr = MemberExpr {
                    span,
                    obj: MemberExpr {
                        span,
                        obj: current_scope.into(),
                        prop: MemberProp::Ident(ident.take()),
                    }
                    .into(),
                    prop: quote_ident!("$val").into(),
                }
                .into();
            }
        } else if expr.is_fn_expr() {
            let mut parent_scope_ident: Ident = quote_ident!("$parentScope").into();
            parent_scope_ident.span.ctxt = SyntaxContext::from_u32(APEIRO_INTERNAL_SYNTAX_CONTEXT);

            self.scope_identifiers.push(parent_scope_ident.clone());
            expr.visit_mut_children_with(self);
            self.scope_identifiers.pop();

            let fn_expr = expr.as_mut_fn_expr().unwrap();

            fn_expr.function.params.iter().for_each(|param| {
                if let Pat::Ident(param_ident) = &param.pat {
                    self.uncaptured_idents.push(param_ident.id.to_id());
                }
            });

            // insert $parentScope
            fn_expr.function.params.insert(0, parent_scope_ident.into());

            // wrap in $$fn
            let current_scope = self.current_scope_identifier().unwrap();
            *expr = Expr::Call(CallExpr {
                span: fn_expr.span(),
                callee: helper!(fn_wrap, "$$fn"),
                args: vec![fn_expr.take().as_arg(), current_scope.as_arg()],
                type_args: None,
            })
            .into();
        } else {
            expr.visit_mut_children_with(self);
        }
    }

    fn visit_mut_pat_or_expr(&mut self, pat: &mut PatOrExpr) {
        pat.visit_mut_children_with(self);

        let span = pat.span();
        if let Some(ident) = pat.as_ident_mut() {
            if self.should_move_to_scope(&ident.to_id()) {
                let current_scope = self.current_scope_identifier().unwrap();
                *pat = MemberExpr {
                    span,
                    obj: MemberExpr {
                        span,
                        obj: current_scope.into(),
                        prop: MemberProp::Ident(ident.take()),
                    }
                    .into(),
                    prop: quote_ident!("$val").into(),
                }
                .into();
            }
        }
    }

    fn visit_mut_stmt(&mut self, stmt: &mut Stmt) {
        stmt.visit_mut_children_with(self);

        if let Some(decl) = stmt.as_mut_decl() {
            if let Some(var_decl) = decl.as_mut_var() {
                let mut decls = var_decl.decls.take();
                let current_scope = self.current_scope_identifier().unwrap();

                *stmt = ExprStmt {
                    span: stmt.span(),
                    expr: SeqExpr {
                        span: stmt.span(),
                        exprs: decls
                            .iter_mut()
                            .map(|decl| {
                                let name = decl.name.take().as_ident().unwrap().id.clone();
                                self.captured_vars.push(name.to_id());
                                let init = decl.init.take().unwrap();
                                AssignExpr {
                                    span: decl.span(),
                                    op: AssignOp::Assign,
                                    left: MemberExpr {
                                        span: decl.span(),
                                        obj: current_scope.clone().into(),
                                        prop: name.into(),
                                    }
                                    .into(),
                                    right: Expr::Object(ObjectLit {
                                        span: DUMMY_SP,
                                        props: vec![swc_ecma_ast::PropOrSpread::Prop(
                                            Prop::KeyValue(KeyValueProp {
                                                key: quote_ident!("$val").into(),
                                                value: init.into(),
                                            })
                                            .into(),
                                        )],
                                    })
                                    .into(),
                                }
                                .into()
                            })
                            .collect(),
                    }
                    .into(),
                }
                .into();
            }
        }
    }
}

// fn custom_visit_mut_module_import(&mut self, stmt: &mut ModuleItem) {
//     if let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = stmt {
//         self.imports.push(import.clone());
//         if import
//             .src
//             .raw
//             .as_ref()
//             .unwrap()
//             .to_string()
//             .starts_with("\"apeiro://")
//         {
//             let mut assign_obj = vec![];
//             for import_spec in import.specifiers.iter() {
//                 if let ImportSpecifier::Named(import_spec) = import_spec {
//                     assign_obj.push(ObjectPatProp::Assign(AssignPatProp {
//                         span: DUMMY_SP,
//                         key: import_spec.local.clone(),
//                         value: None,
//                     }));
//                 }
//             }
//             *stmt = VarDecl {
//                 span: DUMMY_SP,
//                 kind: VarDeclKind::Const,
//                 decls: vec![VarDeclarator {
//                     span: DUMMY_SP,
//                     name: ObjectPat {
//                         span: DUMMY_SP,
//                         props: assign_obj,
//                         optional: false,
//                         type_ann: None,
//                     }
//                     .into(),
//                     init: Some(
//                         CallExpr {
//                             span: DUMMY_SP,
//                             callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!(
//                                 "$dyn_import"
//                             )))),
//                             args: vec![
//                                 ExprOrSpread {
//                                     spread: None,
//                                     expr: Lit::Str(*import.src.clone()).into(),
//                                 }, // import.src.into(),
//                             ],
//                             type_args: None,
//                         }
//                         .into(),
//                     ),
//                     definite: false,
//                 }],
//                 declare: false,
//             }
//             .into();
//         } else {
//             event!(
//                 Level::INFO,
//                 "import doesn't begin with apeiro {:?}",
//                 import.src.raw.as_ref().unwrap().to_string()
//             )
//         }
//     }
// }
