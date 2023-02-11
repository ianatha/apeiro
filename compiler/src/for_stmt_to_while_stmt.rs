use swc_common::util::take::Take;
use swc_common::Spanned;
use swc_ecma_ast::{
    Decl, Stmt, ForStmt, WhileStmt, BlockStmt, VarDeclOrExpr, ExprStmt,
};

use swc_ecmascript::visit::{as_folder, Fold};
use swc_ecmascript::visit::{VisitMut, VisitMutWith};

pub fn folder() -> impl Fold {
    as_folder(VisitorForStmtToWhileStmt {})
}

struct VisitorForStmtToWhileStmt;

impl VisitorForStmtToWhileStmt {
    fn for_stmt_to_while_stmt(&self, for_stmt: &mut ForStmt) -> BlockStmt {
        let mut stmts = vec![];
        if let Some(VarDeclOrExpr::VarDecl(init)) = for_stmt.init.take() {
            stmts.push(
                Stmt::Decl(Decl::Var(init))
            );
        }

        let for_stmt_body = *for_stmt.body.take();
        let mut for_stmt_body = if let Stmt::Block(block_stmt) = for_stmt_body {
            block_stmt
        } else {
            BlockStmt {
                span: for_stmt_body.span(),
                stmts: vec![
                    for_stmt_body
                ]
            }
        };

        if let Some(update) = for_stmt.update.take() {
            for_stmt_body.stmts.push(Stmt::Expr(ExprStmt {
                span: update.span(),
                expr: update,
            }));
        }
        
        stmts.push(Stmt::While(WhileStmt {
            span: for_stmt.span(),
            test: for_stmt.test.take().unwrap_or(true.into()),
            body: Box::new(for_stmt_body.into()),
        }));

        BlockStmt {
            span: for_stmt.span(),
            stmts,
        }
    }
}

impl VisitMut for VisitorForStmtToWhileStmt {
    fn visit_mut_stmt(&mut self, stmt: &mut Stmt) {
        if let Stmt::For(for_stmt) = stmt {
            *stmt = self.for_stmt_to_while_stmt(for_stmt).into();
        }
        stmt.visit_mut_children_with(self);
    }
}
