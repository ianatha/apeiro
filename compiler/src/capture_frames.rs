/***
 * If you're going to run `capture_scopes`, you should run it before this.
 */
use crate::ApeiroInternalSyntaxContext;
use swc_common::util::take::Take;
use swc_common::Spanned;
use swc_common::DUMMY_SP;
use swc_ecma_ast::{
    AssignOp, BlockStmt, CallExpr, ExprStmt, FnDecl, Ident, MemberExpr, ReturnStmt, Stmt,
    SwitchCase, SwitchStmt, VarDecl, VarDeclKind, VarDeclarator,
};
use swc_ecma_utils::{private_ident, quote_ident, ExprFactory};
use swc_ecmascript::visit::{as_folder, Fold};
use swc_ecmascript::{
    ast::Expr,
    visit::{VisitMut, VisitMutWith},
};

use crate::helper;

pub fn folder() -> impl Fold {
    as_folder(CaptureFrames {
        ..Default::default()
    })
}

#[derive(Default)]
struct CaptureFrames {
    frame_identifiers: Vec<Ident>,
}

impl CaptureFrames {
    fn new_frame_identifier(&mut self) -> Ident {
        let ident = private_ident!(format!("$frame"));
        self.frame_identifiers.push(ident.clone());
        ident
    }

    fn current_frame_identifier(&self) -> Option<Ident> {
        self.frame_identifiers.last().map(|x| x.clone())
    }

    fn frame_decl(&mut self, frame_ident: &Ident, previous_frame_ident: &Ident) -> Stmt {
        let call_expr = CallExpr {
            span: DUMMY_SP,
            type_args: None,
            callee: helper!(new_frame, "$$new_frame"),
            args: vec![previous_frame_ident.clone().as_arg()],
        };
        VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Let,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: frame_ident.clone().into(),
                definite: false,
                init: Some(call_expr.into()),
            }],
        }
        .into()
    }

    fn set_frame_pc_stmt(&mut self, pc: i32) -> Stmt {
        ExprStmt {
            span: DUMMY_SP,
            expr: Expr::Assign(swc_ecma_ast::AssignExpr {
                span: DUMMY_SP,
                left: MemberExpr {
                    span: DUMMY_SP,
                    obj: self.current_frame_identifier().unwrap().into(),
                    prop: quote_ident!("$pc").take().into(),
                }
                .into(),
                op: AssignOp::Assign,
                right: ((pc) as f64).into(),
            })
            .into(),
        }
        .into()
    }

    fn transform_stmt_to_frame_case(&mut self, stmt: &Stmt, pc: i32, last: bool) -> Vec<Stmt> {
        if let Stmt::Return(ReturnStmt { arg, .. }) = stmt {
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
                            init: Some(return_val.clone()),
                            definite: false,
                        }],
                    }
                    .into(),
                    // self.expr_end_frame(),
                    ReturnStmt {
                        span: stmt.span(),
                        arg: Some(temp.into()),
                    }
                    .into(),
                ]
            } else {
                // self.expr_end_frame()
                let mut res = vec![];
                res.push(stmt.clone());
                res
            }
        } else if last {
            let mut res = vec![];
            res.push(stmt.clone());
            // res.push(self.expr_end_frame());
            res
        } else {
            // HELPERS.with(|mut helpers| {
            //     let helpers = helpers.borrow_mut();
            //     let fnhash = *self.fn_hash.last().unwrap();
            //     let orig_span: swc_common::Span = stmt.span();
            //     helpers.add_pc_to_src(fnhash, pc, orig_span.lo.0, orig_span.hi.0);
            // });
            let mut res = vec![];
            res.push(stmt.clone());
            res.push(self.set_frame_pc_stmt(pc + 1));
            res
        }
    }

    fn block_statement_to_switch(&mut self, block_stmt: &BlockStmt) -> (Vec<Stmt>, usize) {
        let stmts = &block_stmt.stmts;
        let stmts_length = stmts.len();
        let mut cases = Vec::with_capacity(stmts.len());
        let mut pc = 0;
        let mut result = vec![];
        for (index, stmt) in stmts.iter().enumerate() {
            if stmt.is_apeiro_internal_syntax_context() {
                result.push(stmt.clone());
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
                cons: self.transform_stmt_to_frame_case(stmt, pc, index == stmts_length - 1),
            });
            pc = pc + 1;
        }

        let cases_length = cases.len();

        result.push(Stmt::Switch(SwitchStmt {
            span: DUMMY_SP,
            discriminant: MemberExpr {
                span: DUMMY_SP,
                obj: self.current_frame_identifier().unwrap().into(),
                prop: quote_ident!("$pc").take().into(),
            }
            .into(),
            cases,
        }));
        (result, cases_length)
    }
}

impl VisitMut for CaptureFrames {
    fn visit_mut_block_stmt(&mut self, block_stmt: &mut BlockStmt) {
        let previous_frame_ident = self
            .current_frame_identifier()
            .unwrap_or(private_ident!("undefined"));
        let frame_ident = self.new_frame_identifier();
        block_stmt.visit_mut_children_with(self);

        let (mut new_stmts, cases_length) = self.block_statement_to_switch(block_stmt);
        new_stmts.insert(0, self.frame_decl(&frame_ident, &previous_frame_ident));

        if cases_length > 1 {
            block_stmt.stmts = new_stmts;
        }

        self.frame_identifiers.pop();
    }

    fn visit_mut_fn_decl(&mut self, _fn_decl: &mut FnDecl) {
        panic!("must use decl_to_expr first");
    }
}
