use std::borrow::BorrowMut;

use swc_common::util::take::Take;
use swc_common::BytePos;
use swc_common::Spanned;

use swc_common::Span;
use swc_common::SyntaxContext;
use swc_common::DUMMY_SP;

use swc_ecma_ast::AssignPatProp;
use swc_ecma_ast::BlockStmt;

use swc_ecma_ast::ExprStmt;
use swc_ecma_ast::FnExpr;
use swc_ecma_ast::Function;
use swc_ecma_ast::Id;
use swc_ecma_ast::Ident;
use swc_ecma_ast::IfStmt;
use swc_ecma_ast::ImportDecl;
use swc_ecma_ast::ImportSpecifier;
use swc_ecma_ast::KeyValueProp;
use swc_ecma_ast::MemberExpr;
use swc_ecma_ast::Module;
use swc_ecma_ast::ModuleDecl;
use swc_ecma_ast::ModuleItem;
use swc_ecma_ast::Null;
use swc_ecma_ast::ObjectLit;
use swc_ecma_ast::ObjectPat;
use swc_ecma_ast::ObjectPatProp;
use swc_ecma_ast::Param;
use swc_ecma_ast::Pat;
use swc_ecma_ast::Prop;
use swc_ecma_ast::ReturnStmt;
use swc_ecma_ast::Stmt;
use swc_ecma_ast::SwitchCase;
use swc_ecma_ast::SwitchStmt;
use swc_ecma_ast::ThrowStmt;
use swc_ecma_ast::TryStmt;
use swc_ecma_ast::{CallExpr, Callee, Decl, ExprOrSpread, VarDecl, VarDeclKind, VarDeclarator};

use swc_ecma_utils::private_ident;
use swc_ecma_utils::ExprFactory;

use swc_ecma_utils::quote_ident;

use swc_ecmascript::{
    ast::Expr,
    visit::{VisitMut, VisitMutWith},
};
use swc_ecmascript::{
    ast::Lit,
    visit::{as_folder, Fold},
};
use tracing::{event, Level};

use crate::helpers::HELPERS;
use crate::utils::ast_to_hash;

use super::utils::is_use_strict;

pub fn folder() -> impl Fold {
    as_folder(WrapFunctions {
        ..Default::default()
    })
}

#[derive(Default)]
struct WrapFunctions {
    frame_depth: i32,
    fn_hash: Vec<u64>,
}

fn penultimate(data: &Vec<u64>) -> Option<&u64> {
    if data.len() >= 2 {
        data.get(data.len() - 2)
    } else {
        None
    }
}

impl WrapFunctions {
    fn current_frame_identifier(&self) -> Option<Ident> {
        if self.frame_depth >= 1 {
            Some(quote_ident!(format!("$f{}", self.frame_depth)))
        } else {
            None
        }
    }

    fn frame_decl(&mut self) -> Stmt {
        let call_expr = if self.frame_depth == 1 {
            CallExpr {
                span: DUMMY_SP,
                type_args: None,
                callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!("$new_frame")))),
                args: vec![
                    self.fn_hash
                        .last()
                        .or(Some(&(1 as u64)))
                        .unwrap()
                        .to_string()
                        .as_arg(),
                    match penultimate(&self.fn_hash) {
                        Some(hash) => hash.to_string().as_arg(),
                        None => Lit::Null(Null { span: DUMMY_SP }).as_arg(),
                    },
                ],
            }
        } else {
            CallExpr {
                span: DUMMY_SP,
                type_args: None,
                callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!("$new_frame")))),
                args: vec![
                    self.fn_hash
                        .last()
                        .or(Some(&(1 as u64)))
                        .unwrap()
                        .to_string()
                        .as_arg(),
                    match penultimate(&self.fn_hash) {
                        Some(hash) => hash.to_string().as_arg(),
                        None => Lit::Null(Null { span: DUMMY_SP }).as_arg(),
                    },
                ],
            }
        };
        VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Let,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: self.current_frame_identifier().unwrap().into(),
                definite: false,
                init: Some(call_expr.into()),
            }],
        }
        .into()
    }

    fn expr_end_frame(&mut self) -> Stmt {
        Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: CallExpr {
                span: DUMMY_SP,
                type_args: None,
                callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!("$frame_end")))),
                args: vec![self.current_frame_identifier().unwrap().as_arg()],
            }
            .into(),
        })
    }

    fn expr_set_frame_pc(&mut self, pc: i32) -> Stmt {
        ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Assign(swc_ecma_ast::AssignExpr {
                span: DUMMY_SP,
                left: MemberExpr {
                    span: DUMMY_SP,
                    obj: self.current_frame_identifier().unwrap().into(),
                    prop: quote_ident!("$pc").take().into(),
                }
                .into(),
                op: swc_ecma_ast::AssignOp::Assign,
                right: swc_ecma_ast::Number {
                    span: DUMMY_SP,
                    value: (pc) as f64,
                    raw: None,
                }
                .into(),
            })),
        }
        .into()
    }

    // fn expr_from_fn_expr(&mut self, fn_expr: &mut FnExpr) -> Expr {
    //     let hash = self.fn_hash.last().unwrap();
    //     Expr::Call(CallExpr {
    //         span: fn_expr.span(),
    //         callee: Callee::Expr(quote_ident!(self.wrapping_function.clone()).into()),
    //         args: vec![
    //             fn_expr.take().as_arg(),
    //             hash.to_string().as_arg(),
    //             match self.current_scope_identifier() {
    //                 Some(id) => id.as_arg(),
    //                 None => Lit::Null(Null { span: DUMMY_SP }).as_arg(),
    //             },
    //         ],
    //         type_args: None,
    //     })
    // }

    fn block_statement_to_switch(&mut self, stmts: &mut Vec<Stmt>) -> Vec<Stmt> {
        let stmts_length = stmts.len();
        let mut cases = Vec::with_capacity(stmts.len());
        let mut pc = 0;
        let mut result = vec![];
        for (index, stmt) in stmts.iter_mut().enumerate() {
            if stmt.span().ctxt.as_u32() == 91919 {
                result.push(stmt.take());
                continue;
            }

            cases.push(SwitchCase {
                span: DUMMY_SP,
                test: Some(
                    swc_ecma_ast::Number {
                        span: DUMMY_SP,
                        value: pc as f64,
                        raw: None,
                    }
                    .into(),
                ),
                cons: if let Stmt::Return(ReturnStmt { arg, .. }) = stmt {
                    if let Some(return_val) = arg {
                        let temp = private_ident!("__return_val");
                        vec![
                            VarDecl {
                                span: DUMMY_SP,
                                kind: VarDeclKind::Let,
                                declare: false,
                                decls: vec![VarDeclarator {
                                    span: return_val.span(),
                                    name: temp.clone().into(),
                                    init: Some(return_val.take()),
                                    definite: false,
                                }],
                            }
                            .into(),
                            self.expr_end_frame(),
                            ReturnStmt {
                                span: stmt.span(),
                                arg: Some(temp.into()),
                            }
                            .into(),
                        ]
                    } else {
                        let mut res = vec![self.expr_end_frame()];
                        res.push(stmt.take());
                        res
                    }
                } else if index == stmts_length - 1 {
                    let mut res = vec![];
                    res.push(stmt.take());
                    res.push(self.expr_end_frame());
                    res
                } else {
                    // HELPERS.with(|mut helpers| {
                    //     let helpers = helpers.borrow_mut();
                    //     let fnhash = *self.fn_hash.last().unwrap();
                    //     let orig_span: swc_common::Span = stmt.span();
                    //     helpers.add_pc_to_src(fnhash, pc, orig_span.lo.0, orig_span.hi.0);
                    // });
                    let mut res = vec![];
                    res.push(stmt.take());
                    res.push(self.expr_set_frame_pc(pc + 1));
                    res
                },
            });
            pc = pc + 1;
        }
        result.push(Stmt::Switch(SwitchStmt {
            span: DUMMY_SP,
            discriminant: MemberExpr {
                span: DUMMY_SP,
                obj: self.current_frame_identifier().unwrap().into(),
                prop: quote_ident!("$pc").take().into(),
            }
            .into(),
            cases: cases,
        }));
        result
    }

    fn visit_mut_fn_body(&mut self, fn_body: &mut BlockStmt) {
        // println!("fn_body {:?}", fn_body);
        let mut stmts = Vec::with_capacity(fn_body.stmts.len());
        let has_use_strict = fn_body
            .stmts
            .get(0)
            .map_or(false, |first| is_use_strict(first));
        if has_use_strict {
            stmts.push(fn_body.stmts.remove(0));
        }
        stmts.push(self.frame_decl());
        stmts.append(&mut self.block_statement_to_switch(&mut fn_body.stmts));

        fn_body.stmts = stmts;
    }
}

impl VisitMut for WrapFunctions {
    fn visit_mut_try_stmt(&mut self, try_stmt: &mut TryStmt) {
        try_stmt.visit_mut_children_with(self);

        if let Some(catch_clause) = &mut try_stmt.handler {
            if let Some(catch_param) = &mut catch_clause.param {
                if let Pat::Ident(catch_ident) = catch_param {
                    let error_ident: Ident = catch_ident.to_id().into();
                    catch_clause.body.stmts.insert(
                        0,
                        IfStmt {
                            span: DUMMY_SP,
                            test: Box::new(Expr::Call(swc_ecma_ast::CallExpr {
                                span: DUMMY_SP,
                                callee: Callee::Expr(
                                    Expr::Ident(quote_ident!("$isSuspendSignal")).into(),
                                ),
                                args: vec![Expr::Ident(error_ident.clone()).into()],
                                type_args: None,
                            })),

                            cons: Stmt::Throw(ThrowStmt {
                                span: DUMMY_SP,
                                arg: Expr::Ident(error_ident.clone()).into(),
                            })
                            .into(),
                            alt: None,
                        }
                        .into(),
                    );
                }
            }
        }
    }

    // wrap either event specs into closure
    fn visit_mut_module(&mut self, module: &mut Module) {
        for stmt in module.body.iter_mut() {
            if let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = stmt {
                if import
                    .src
                    .raw
                    .as_ref()
                    .unwrap()
                    .to_string()
                    .starts_with("\"apeiro://")
                {
                    let mut assign_obj = vec![];
                    for import_spec in import.specifiers.iter() {
                        if let ImportSpecifier::Named(import_spec) = import_spec {
                            assign_obj.push(ObjectPatProp::Assign(AssignPatProp {
                                span: DUMMY_SP,
                                key: import_spec.local.clone(),
                                value: None,
                            }));
                        }
                    }
                    *stmt = VarDecl {
                        span: DUMMY_SP,
                        kind: VarDeclKind::Const,
                        decls: vec![VarDeclarator {
                            span: DUMMY_SP,
                            name: ObjectPat {
                                span: DUMMY_SP,
                                props: assign_obj,
                                optional: false,
                                type_ann: None,
                            }
                            .into(),
                            init: Some(
                                CallExpr {
                                    span: DUMMY_SP,
                                    callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!(
                                        "$dyn_import"
                                    )))),
                                    args: vec![
                                        ExprOrSpread {
                                            spread: None,
                                            expr: Lit::Str(*import.src.clone()).into(),
                                        }, // import.src.into(),
                                    ],
                                    type_args: None,
                                }
                                .into(),
                            ),
                            definite: false,
                        }],
                        declare: false,
                    }
                    .into();
                } else {
                    event!(
                        Level::INFO,
                        "import doesn't begin with apeiro {:?}",
                        import.src.raw.as_ref().unwrap().to_string()
                    )
                }
            }
        }
        module.visit_mut_children_with(self);
    }

    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        // println!("block: {:?}", block);
        self.frame_depth = self.frame_depth + 1;
        self.visit_mut_fn_body(block);
        block.visit_mut_children_with(self);
        self.frame_depth = self.frame_depth - 1;
    }

    fn visit_mut_function(&mut self, function: &mut Function) {
        match function.body {
            Some(ref mut _block_stmt) => {
                // self.moved_vars.push(vec![]);
                function.visit_mut_children_with(self);
                // _ = self.moved_vars.pop()
            }
            None => {}
        }
    }

    // fn visit_mut_expr(&mut self, expr: &mut Expr) {
    //     if let Expr::Fn(fn_expr) = expr {
    //         let hash = ast_to_hash(fn_expr);
    //         self.fn_hash.push(hash);
    //         fn_expr.visit_mut_children_with(self);
    //         // *expr = self.expr_from_fn_expr(fn_expr);
    //         self.fn_hash.pop();
    //     } else {
    //         expr.visit_mut_children_with(self);
    //     }
    // }
}
