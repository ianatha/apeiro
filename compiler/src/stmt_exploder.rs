use swc_common::util::take::Take;
use swc_common::{BytePos, Span};
use swc_common::SyntaxContext;

use swc_ecma_ast::{BlockStmt, Decl, Expr, Function, Ident, Stmt};

use super::utils::is_use_strict;
use swc_common::Spanned;
use swc_ecma_ast::{VarDecl, VarDeclarator};
use swc_ecmascript::visit::{as_folder, Fold};
use swc_ecmascript::visit::{VisitMut, VisitMutWith};

pub fn folder() -> impl Fold {
    as_folder(StmtExploder {
        ..Default::default()
    })
}

#[derive(Default, Debug)]
struct CallExprExploder {
    count: u32,
    depth: u32,
    pre_stmts: Vec<Stmt>,
    post_stmts: Vec<Stmt>,
}

impl VisitMut for CallExprExploder {
    fn visit_mut_function(&mut self, _block: &mut Function) {
        // no-op
    }

    fn visit_mut_block_stmt(&mut self, _block: &mut BlockStmt) {
        // no-op
    }

    fn visit_mut_return_stmt(&mut self, n: &mut swc_ecma_ast::ReturnStmt) {
        self.depth += 1;
        n.visit_mut_children_with(self);
        self.depth -= 1;
    }

    fn visit_mut_var_decl(&mut self, n: &mut VarDecl) {
        self.depth += 1;
        n.visit_mut_children_with(self);
        self.depth -= 1;
    }

    fn visit_mut_expr(&mut self, n: &mut Expr) {
        let orig_span = n.span();
        match n {
            Expr::Call(call_expr) => {
                self.count += 1;

                let my_id = self.count;

                let ident = Ident {
                    span: orig_span,
                    sym: ("_temp$".to_owned() + &my_id.to_string()).into(),
                    optional: false,
                };

                self.depth += 1;
                call_expr.visit_mut_children_with(self);
                self.depth -= 1;

                if self.depth > 0 {
                    self.pre_stmts.push(Stmt::Decl(Decl::Var(
                        VarDecl {
                            kind: swc_ecma_ast::VarDeclKind::Const,
                            declare: false,
                            span: orig_span,
                            decls: vec![VarDeclarator {
                                span: Span {
                                    lo: BytePos::DUMMY,
                                    hi: BytePos::DUMMY,
                                    ctxt: SyntaxContext::from_u32(91919),
                                },
                                name: ident.clone().into(),
                                definite: false,
                                init: Some(Box::new(Expr::Call(call_expr.clone()))),
                            }],
                        }
                        .into(),
                    )));

                    // // push delete statement
                    // self.post_stmts.push(
                    //     ExprStmt {
                    //         span: orig_span,
                    //         expr: swc_ecma_ast::UnaryExpr {
                    //             span: orig_span,
                    //             op: swc_ecma_ast::UnaryOp::Delete,
                    //             arg: Box::new(Expr::Ident(ident.clone())),
                    //         }
                    //         .into(),
                    //     }
                    //     .into(),
                    // );

                    *n = Expr::Ident(ident)
                }
            }
            _ => {}
        }
        n.visit_mut_children_with(self);
    }
}

#[derive(Default)]
struct StmtExploder {
    count: u32,
}

impl StmtExploder {
    fn expand_stmt(&mut self, mut stmt: Stmt) -> (Vec<Stmt>, Vec<Stmt>) {
        let mut a = CallExprExploder {
            count: self.count,
            ..Default::default()
        };
        stmt.visit_mut_children_with(&mut a);
        a.pre_stmts.push(stmt);
        self.count = a.count;
        (a.pre_stmts, a.post_stmts)
    }

    fn block_statement_to_switch(&mut self, stmts: &mut Vec<Stmt>) -> Vec<Stmt> {
        let stmts_length = stmts.len();
        let mut expanded_stmts = Vec::with_capacity(stmts_length);
        for (_index, stmt) in stmts.iter_mut().enumerate() {
            let (mut pre, mut post) = self.expand_stmt(stmt.take());
            expanded_stmts.append(&mut pre);
            expanded_stmts.append(&mut post);
        }
        expanded_stmts
    }

    fn visit_mut_fn_body(&mut self, fn_body: &mut BlockStmt) {
        let mut stmts = Vec::with_capacity(fn_body.stmts.len());
        let has_use_strict = fn_body
            .stmts
            .get(0)
            .map_or(false, |first| is_use_strict(first));
        if has_use_strict {
            stmts.push(fn_body.stmts.remove(0));
        }
        stmts.append(&mut self.block_statement_to_switch(&mut fn_body.stmts));

        fn_body.stmts = stmts;
    }
}

impl VisitMut for StmtExploder {
    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        self.visit_mut_fn_body(block);
        block.visit_mut_children_with(self);
    }
}
