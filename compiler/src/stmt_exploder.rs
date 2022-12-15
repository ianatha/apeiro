use swc_common::util::take::Take;
use swc_common::BytePos;
use swc_common::Span;
use swc_common::SyntaxContext;
use swc_common::DUMMY_SP;

use swc_ecma_ast::BlockStmt;

use swc_ecma_ast::Decl;
use swc_ecma_ast::Expr;
use swc_ecma_ast::Function;
use swc_ecma_ast::Ident;
use swc_ecma_ast::Stmt;

use swc_ecma_ast::VarDecl;
use swc_ecma_ast::VarDeclarator;
use swc_ecmascript::visit::{as_folder, Fold};
use swc_ecmascript::visit::{VisitMut, VisitMutWith};

use super::utils::is_use_strict;

pub fn folder() -> impl Fold {
    as_folder(StmtExploder {
        ..Default::default()
    })
}

#[derive(Default, Debug)]
struct CallExprExploder {
    count: u32,
    pre_stmts: Vec<Stmt>,
}

impl VisitMut for CallExprExploder {
    fn visit_mut_function(&mut self, _: &mut Function) {
        // do nothing
    }

    fn visit_mut_expr(&mut self, n: &mut Expr) {
        match n {
            Expr::Call(call_expr) => {
                self.count += 1;

                let my_id = self.count;

                let ident = Ident {
                    span: DUMMY_SP,
                    sym: ("_temp$".to_owned() + &my_id.to_string()).into(),
                    optional: false,
                };

                call_expr.visit_mut_children_with(self);

                self.pre_stmts.push(Stmt::Decl(Decl::Var(
                    VarDecl {
                        kind: swc_ecma_ast::VarDeclKind::Const,
                        declare: false,
                        span: DUMMY_SP,
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

                *n = Expr::Ident(ident)
            }
            _ => {}
        }
        n.visit_mut_children_with(self);
    }
}

#[derive(Default)]
struct StmtExploder {}

impl StmtExploder {
    fn expand_stmt(&mut self, mut stmt: Stmt) -> Vec<Stmt> {
        let mut a = CallExprExploder {
            ..Default::default()
        };
        stmt.visit_mut_children_with(&mut a);
        a.pre_stmts.push(stmt);
        a.pre_stmts
    }

    fn block_statement_to_switch(&mut self, stmts: &mut Vec<Stmt>) -> Vec<Stmt> {
        let stmts_length = stmts.len();
        let mut expanded_stmts = Vec::with_capacity(stmts_length);
        for (_index, stmt) in stmts.iter_mut().enumerate() {
            expanded_stmts.append(&mut self.expand_stmt(stmt.take()));
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
