use swc_common::util::take::Take;
use swc_common::BytePos;

use swc_common::Span;
use swc_common::SyntaxContext;
use swc_common::DUMMY_SP;

use swc_ecma_ast::AssignPatProp;
use swc_ecma_ast::BlockStmt;
use swc_ecma_ast::ExprStmt;
use swc_ecma_ast::Function;
use swc_ecma_ast::Id;
use swc_ecma_ast::Ident;
use swc_ecma_ast::ImportDecl;
use swc_ecma_ast::ImportSpecifier;
use swc_ecma_ast::KeyValueProp;
use swc_ecma_ast::MemberExpr;

use swc_ecma_ast::Module;
use swc_ecma_ast::ModuleDecl;
use swc_ecma_ast::ModuleItem;
use swc_ecma_ast::ObjectLit;

use swc_ecma_ast::ObjectPat;
use swc_ecma_ast::ObjectPatProp;
use swc_ecma_ast::Pat;
use swc_ecma_ast::Prop;
use swc_ecma_ast::Stmt;
use swc_ecma_ast::SwitchCase;
use swc_ecma_ast::SwitchStmt;
use swc_ecma_ast::{CallExpr, Callee, Decl, ExprOrSpread, VarDecl, VarDeclKind, VarDeclarator};

use swc_ecma_utils::private_ident;

use swc_ecma_utils::quote_ident;

use swc_ecmascript::{
    ast::Expr,
    visit::{VisitMut, VisitMutWith},
};
use swc_ecmascript::{
    ast::Lit,
    visit::{as_folder, Fold},
};

use super::utils::is_use_strict;

pub fn folder() -> impl Fold {
    as_folder(WrapFunctions {
        frame_depth: 0,
        moved_vars: vec![],
    })
}

struct WrapFunctions {
    frame_depth: i32,
    moved_vars: Vec<Vec<Id>>,
}

impl WrapFunctions {
    fn previous_frame_identifier(&self) -> Ident {
        private_ident!(format!("$f{}", self.frame_depth - 1))
    }

    fn current_frame_identifier(&self) -> Ident {
        private_ident!(format!("$f{}", self.frame_depth))
    }

    fn frame_decl(&mut self) -> Stmt {
        let call_expr = if self.frame_depth == 1 {
            CallExpr {
                span: DUMMY_SP,
                type_args: None,
                callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!("$new_frame")))),
                args: vec![],
            }
        } else {
            CallExpr {
                span: DUMMY_SP,
                type_args: None,
                callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!("$new_subframe")))),
                args: vec![ExprOrSpread {
                    spread: None,
                    expr: self.previous_frame_identifier().into(),
                }],
            }
        };
        VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Var,
            declare: false,
            decls: vec![VarDeclarator {
                span: Span {
                    lo: BytePos::DUMMY,
                    hi: BytePos::DUMMY,
                    ctxt: SyntaxContext::from_u32(91919),
                },
                name: self.current_frame_identifier().into(),
                definite: false,
                init: Some(call_expr.into()),
            }],
            // expr: Box::new(Expr::Call(CallExpr {
            //     span: DUMMY_SP,
            //     callee: Callee::Expr(Box::new(Expr::Ident(quote_ident!("console.log")))),
            //     args: vec![ExprOrSpread {
            //         spread: None,
            //         expr: Box::new(Expr::Lit(Lit::Str(quote_str!("Hello, world!")))),
            //     }],
            //     type_args: None,
            // })),
        }
        .into()
    }

    fn expr_set_frame_pc(&mut self, pc: i32) -> Stmt {
        ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Assign(swc_ecma_ast::AssignExpr {
                span: DUMMY_SP,
                left: MemberExpr {
                    span: DUMMY_SP,
                    obj: self.current_frame_identifier().into(),
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

    fn move_var_assignments(&mut self, stmt: Stmt) -> Stmt {
        if let Stmt::Decl(Decl::Var(var)) = &stmt {
            let new_stmts = Vec::new();
            for decl in &var.decls {
                if let Some(init) = &decl.init {
                    self.moved_vars
                        .last_mut()
                        .unwrap()
                        .push(decl.name.as_ident().unwrap().to_id());
                    return ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(Expr::Assign(swc_ecma_ast::AssignExpr {
                            span: DUMMY_SP,
                            left: MemberExpr {
                                span: DUMMY_SP,
                                obj: self.current_frame_identifier().into(),
                                prop: decl.name.as_ident().unwrap().id.clone().into(),
                                // Expr::Ident(quote_ident!("$frame")).into(),
                                // prop: ,
                                // decl.name.clone().as_ident().unwrap().into(),
                                // Ident {
                                //     span: DUMMY_SP,
                                //     sym: ,
                                //     optional: false,
                                // }),
                            }
                            .into(),
                            op: swc_ecma_ast::AssignOp::Assign,
                            right: ObjectLit {
                                span: DUMMY_SP,
                                props: vec![swc_ecma_ast::PropOrSpread::Prop(
                                    Prop::KeyValue(KeyValueProp {
                                        key: quote_ident!("value").into(),
                                        value: init.clone(),
                                    })
                                    .into(),
                                )],
                            }
                            .into(),
                        })),
                    }
                    .into();
                }
            }
            if new_stmts.len() > 0 {
                return Stmt::Block(BlockStmt {
                    span: DUMMY_SP,
                    stmts: new_stmts,
                });
            }
        }
        stmt
    }

    fn block_statement_to_switch(&mut self, stmts: Vec<Stmt>) -> Stmt {
        let mut cases = Vec::with_capacity(stmts.len());
        let mut pc = 0;
        for stmt in stmts {
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
                cons: if stmt.is_return_stmt() {
                    vec![self.move_var_assignments(stmt)]
                } else {
                    vec![
                        self.move_var_assignments(stmt),
                        self.expr_set_frame_pc(pc + 1),
                    ]
                },
            });
            pc = pc + 1;
        }
        SwitchStmt {
            span: DUMMY_SP,
            discriminant: MemberExpr {
                span: DUMMY_SP,
                obj: self.current_frame_identifier().into(),
                prop: quote_ident!("$pc").take().into(),
            }
            .into(),
            cases: cases,
        }
        .into()
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
        stmts.push(self.frame_decl());
        stmts.push(self.block_statement_to_switch(fn_body.stmts.take()));

        fn_body.stmts = stmts;
    }
}

struct VarRewriter<'a> {
    moved_vars: &'a Vec<Id>,
    top_level: Ident,
}

impl<'a> VisitMut for VarRewriter<'a> {
    fn visit_mut_pat(&mut self, pat: &mut Pat) {
        let mut target_ident = None;
        if let Pat::Ident(ident) = pat {
            if self.moved_vars.contains(&ident.id.to_id()) {
                target_ident = Some(ident.id.clone());
            }
        }

        if let Some(mut target_ident) = target_ident {
            *pat = Pat::Expr(
                MemberExpr {
                    span: DUMMY_SP,
                    obj: MemberExpr {
                        span: DUMMY_SP,
                        obj: Expr::Ident(self.top_level.clone()).into(),
                        prop: target_ident.take().into(),
                    }
                    .into(),
                    prop: quote_ident!("value").into(),
                }
                .into(),
            );
        } else {
            pat.visit_mut_children_with(self);
        }
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        let mut target_ident = None;
        if let Expr::Ident(ident) = expr {
            if self.moved_vars.contains(&ident.to_id()) {
                target_ident = Some(ident.clone());
            }
        }

        if let Some(mut target_ident) = target_ident {
            *expr = MemberExpr {
                span: DUMMY_SP,
                obj: MemberExpr {
                    span: DUMMY_SP,
                    obj: Expr::Ident(self.top_level.clone()).into(),
                    prop: target_ident.take().into(),
                }
                .into(),
                prop: quote_ident!("value").into(),
            }
            .into();
        } else {
            expr.visit_mut_children_with(self);
        }
    }
}

impl VisitMut for WrapFunctions {
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
                    .starts_with("\"pristine://")
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
                    println!(
                        "import doesn't begin with pristine {:?}",
                        import.src.raw.as_ref().unwrap().to_string()
                    )
                }
            }
        }
        module.visit_mut_children_with(self);
    }

    fn visit_mut_import_decl(&mut self, import: &mut ImportDecl) {
        println!("import: {:?}", import);
        import.visit_mut_children_with(self);
    }

    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        self.frame_depth = self.frame_depth + 1;
        self.visit_mut_fn_body(block);
        // self.top_level = Some(quote_ident!("$subframe"));
        block.visit_mut_children_with(self);
        let var_rewriter = &mut VarRewriter {
            moved_vars: self.moved_vars.last().unwrap(),
            top_level: self.current_frame_identifier(),
        };
        block.visit_mut_children_with(var_rewriter);
        self.frame_depth = self.frame_depth - 1;
    }

    fn visit_mut_function(&mut self, function: &mut Function) {
        match function.body {
            Some(ref mut _block_stmt) => {
                // self.top_level = Some(quote_ident!("$frame"));
                self.moved_vars.push(vec![]);
                function.visit_mut_children_with(self);
                // self.top_level = None;
                _ = self.moved_vars.pop()
            }
            None => {}
        }
    }
}
