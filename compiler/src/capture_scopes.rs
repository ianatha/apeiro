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
use swc_ecma_ast::Stmt;
use swc_ecma_ast::{CallExpr, Callee, Decl, ExprOrSpread, VarDecl, VarDeclKind, VarDeclarator};

use swc_ecma_utils::ExprFactory;

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
use tracing::{event, Level};

use crate::block_analysis::BlockAnalysis;
use crate::block_analysis::BlockAnalysisResult;
use crate::helper;
use crate::utils::ast_to_hash;

use super::utils::is_use_strict;

pub fn folder() -> impl Fold {
    as_folder(CaptureScopes {
        ..Default::default()
    })
}

#[derive(Default)]
struct CaptureScopes {
    depth: u32,
    moved_vars: Vec<Vec<Id>>,
    fn_hash: Vec<u64>,
    imports: Vec<ImportDecl>,
    analyses: Vec<BlockAnalysisResult>,
}


impl CaptureScopes {
    fn previous_scope_identifier(&self) -> Option<Ident> {
        Some(quote_ident!("$parentScope"))
    }

    fn current_scope_identifier(&self) -> Option<Ident> {
        Some(quote_ident!("$scope"))
    }

    fn scope_decl(&mut self, with_parent: bool) -> Stmt {
        let call_expr = CallExpr {
            span: DUMMY_SP,
            type_args: None,
            callee: helper!(new_scope, "$$new_scope"),
            args: match with_parent {
                true => vec![self.previous_scope_identifier().unwrap().as_arg()],
                false => vec![],
            },
        };
        VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Let,
            declare: false,
            decls: vec![VarDeclarator {
                span: Span {
                    lo: BytePos::DUMMY,
                    hi: BytePos::DUMMY,
                    ctxt: SyntaxContext::from_u32(91919),
                },
                name: self.current_scope_identifier().unwrap().into(),
                definite: false,
                init: Some(call_expr.into()),
            }],
        }
        .into()
    }

    fn expr_from_fn_expr(&mut self, fn_expr: &mut FnExpr) -> Expr {
        // let hash = self.fn_hash.last().unwrap();
        let analysis = self.analyses.last().unwrap();

        Expr::Call(CallExpr {
            span: fn_expr.span(),
            callee: helper!(fn_wrap, "$$fn"),
            args: vec![
                fn_expr.take().as_arg(),
                // hash.to_string().as_arg(),
                match analysis.needs_parent_scope() {
                    true => self.current_scope_identifier().unwrap().as_arg(),
                    false => Lit::Null(Null { span: DUMMY_SP }).as_arg(),
                },
                Expr::Object(ObjectLit {
                    span: DUMMY_SP,
                    props: vec![
                        swc_ecma_ast::PropOrSpread::Prop(
                            Prop::KeyValue(KeyValueProp {
                                key: quote_ident!("needs_parent_scope").into(),
                                value: analysis.needs_parent_scope().into(),
                            })
                            .into(),
                        ),
                        swc_ecma_ast::PropOrSpread::Prop(
                            Prop::KeyValue(KeyValueProp {
                                key: quote_ident!("needs_imports_scope").into(),
                                value: (analysis.used_imports.len() > 0).into(),
                            })
                            .into(),
                        ),
                    ],
                })
                .as_arg(),
            ],
            type_args: None,
        })
    }

    fn move_var_assignments(&mut self, stmt: &mut Stmt) -> Vec<Stmt> {
        if let Stmt::Decl(Decl::Var(var)) = stmt {
            let mut new_stmts = Vec::new();
            for decl in &var.decls {
                if let Some(init) = &decl.init {
                    if let Some(assignee_name) = decl.name.as_ident() {
                        if let Some(moved_vars) = self.moved_vars.last_mut() {
                            moved_vars.push(assignee_name.to_id());
                        } else {
                            // TODO
                            // todo!();
                        }
                        new_stmts.push(
                            ExprStmt {
                                span: var.span,
                                expr: Box::new(Expr::Assign(swc_ecma_ast::AssignExpr {
                                    span: var.span, // todo?
                                    left: MemberExpr {
                                        span: var.span, // todo?
                                        obj: self.current_scope_identifier().unwrap().into(),
                                        prop: assignee_name.id.clone().into(),
                                    }
                                    .into(),
                                    op: swc_ecma_ast::AssignOp::Assign,
                                    right: ObjectLit {
                                        span: var.span, // todo?
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
                            .into(),
                        );
                    } else {
                        event!(Level::INFO, "{:?}", decl);
                        todo!();
                    }
                } else {
                    if let Some(assignee_name) = decl.name.as_ident() {
                        new_stmts.push(
                            ExprStmt {
                                span: DUMMY_SP,
                                expr: Box::new(Expr::Assign(swc_ecma_ast::AssignExpr {
                                    span: DUMMY_SP,
                                    left: MemberExpr {
                                        span: DUMMY_SP,
                                        obj: self.current_scope_identifier().unwrap().into(),
                                        prop: assignee_name.id.clone().into(),
                                    }
                                    .into(),
                                    op: swc_ecma_ast::AssignOp::Assign,
                                    right: ObjectLit {
                                        span: DUMMY_SP,
                                        props: vec![],
                                    }
                                    .into(),
                                })),
                            }
                            .into(),
                        );
                    }
                }
            }
            if new_stmts.len() > 0 {
                return new_stmts;
            }
        }
        vec![stmt.take()]
    }

    fn custom_visit_mut_fn_body(&mut self, fn_body: &mut BlockStmt) {
        let mut stmts = Vec::with_capacity(fn_body.stmts.len());
        let has_use_strict = fn_body
            .stmts
            .get(0)
            .map_or(false, |first| is_use_strict(first));
        if has_use_strict {
            stmts.push(fn_body.stmts.remove(0));
        }

        for (_index, stmt) in fn_body.stmts.iter_mut().enumerate() {
            stmts.append(&mut self.move_var_assignments(stmt));
        }
        if self.moved_vars.len() > 0 {
            let moved_vars = self.moved_vars.last().unwrap();
            let analysis = self.analyses.last().unwrap().clone();
            if moved_vars.len() > 0 {
                stmts.insert(0, self.scope_decl(analysis.needs_parent_scope()));
            } else {
                if analysis.needs_parent_scope() {
                    stmts.insert(
                        0,
                        VarDecl {
                            span: DUMMY_SP,
                            kind: VarDeclKind::Const,
                            declare: false,
                            decls: vec![VarDeclarator {
                                span: Span {
                                    lo: BytePos::DUMMY,
                                    hi: BytePos::DUMMY,
                                    ctxt: SyntaxContext::from_u32(91919),
                                },
                                name: quote_ident!("$scope").into(),
                                definite: false,
                                init: Some(quote_ident!("$parentScope").into()),
                            }],
                        }
                        .into(),
                    );
                }
            };
        }

        fn_body.stmts = stmts;
    }

    fn custom_visit_mut_module_import(&mut self, stmt: &mut ModuleItem) {
        if let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = stmt {
            self.imports.push(import.clone());
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
}

struct VarRewriter<'a> {
    moved_vars: &'a Vec<Id>,
}

impl<'a> VisitMut for VarRewriter<'a> {
    fn visit_mut_function(&mut self, function: &mut Function) {
        function.visit_mut_children_with(self);
    }

    fn visit_mut_params(&mut self, _params: &mut Vec<Param>) {
        // do not rename things in function params
    }

    fn visit_mut_pat(&mut self, pat: &mut Pat) {
        let mut target_ident = None;
        if let Pat::Ident(ident) = pat {
            if self.moved_vars.contains(&ident.id.to_id()) {
                target_ident = Some(ident.id.clone());
                // } else {
                // println!("ident.id not moved: {:?}", ident);
                // println!("args: {:?}", self.args.last());
            }
        } else {
            // todo
            // todo!();
        }

        if let Some(target_ident) = target_ident {
            *pat = Pat::Expr(self.target_ident_replacement(target_ident, "$scope").into());
        } else {
            pat.visit_mut_children_with(self);
        }
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        let mut target_ident = None;
        let mut scope_var = "$scope";
        if let Expr::Ident(ident) = expr {
            if self.moved_vars.contains(&ident.to_id()) {
                target_ident = Some(ident.clone());
                scope_var = "$scope";
            } else {
                match ident.sym.chars().as_str() {
                    "$scope" => {}
                    "$parentScope" => {}
                    "$$new_scope" => {}
                    "$fn" => {}
                    _ => {
                        // if let Some(used_import) = imports_contain_ident(&self.imports, ident) {
                        // target_ident = Some(ident.clone());
                        // scope_var = "$imports";
                        // self.anused_imports.push(format!("import {:?}", used_import));
                        // } else if self.args.last().unwrap().iter().find(|x| {
                        //     if let Pat::Ident(binding_ident) = &x.pat {
                        //         binding_ident.to_id() == ident.to_id()
                        //     } else {
                        //         false
                        //     }
                        // }).is_some() {
                        //     println!("\n using arg: {:?}\n", ident);
                        //     self.used_imports.push(format!("arg: {:?}", ident.to_string()));
                        // } else {
                        //     println!("\n\n global ident: ** {:?}", ident);
                        //     println!("\n\n global ident: ** {:?}", self.args);
                        //     self.used_imports.push(format!("{:?}", ident.to_string()));
                        // }
                    }
                }
            }
        }

        if let Some(target_ident) = target_ident {
            *expr = self
                .target_ident_replacement(target_ident, scope_var)
                .into();
        } else {
            expr.visit_mut_children_with(self);
        }
    }
}

impl<'a> VarRewriter<'a> {
    fn target_ident_replacement(&mut self, mut target_ident: Ident, scope_var: &str) -> MemberExpr {
        MemberExpr {
            span: target_ident.span(),
            obj: MemberExpr {
                span: target_ident.span(),
                obj: quote_ident!(scope_var).into(),
                prop: target_ident.take().into(),
            }
            .into(),
            prop: quote_ident!("value").into(),
        }
    }
}

impl CaptureScopes {}
impl VisitMut for CaptureScopes {
    // wrap either event specs into closure
    fn visit_mut_module(&mut self, module: &mut Module) {
        for stmt in module.body.iter_mut() {
            self.custom_visit_mut_module_import(stmt);
        }
        module.visit_mut_children_with(self);
        module.body.insert(0, ModuleItem::Stmt(
            Stmt::Decl(Decl::Var(VarDecl {
                span: DUMMY_SP,
                kind: VarDeclKind::Const,
                declare: false,
                decls: vec![
                    VarDeclarator {
                        span: DUMMY_SP,
                        name: private_ident!("$scope").into(),
                        init: Some(CallExpr {
                            span: DUMMY_SP,
                            callee: helper!(new_scope, "$$new_scope"),
                            args: vec![],
                            type_args: None
                        }.into()
                        ),
                        definite: true,
                    }
                ]
            }.into()))
        ))
    }

    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        self.custom_visit_mut_fn_body(block);
        block.visit_mut_children_with(self);
        if self.moved_vars.len() > 0 {
            let last = self.moved_vars.last().unwrap();
            if last.len() > 0 {
                let var_rewriter = &mut VarRewriter { moved_vars: last };
                block.visit_mut_children_with(var_rewriter);
                // self.used_imports = var_rewriter.used_imports.clone();
            }
        }
    }

    fn visit_mut_function(&mut self, function: &mut Function) {
        println!("decorators: {:?}", function.decorators);
        let analysis = self.analyses.last().unwrap().clone();

        function.params.insert(
            0,
            Param {
                span: DUMMY_SP,
                decorators: Default::default(),
                pat: Pat::Ident(if analysis.needs_parent_scope() {
                    quote_ident!("$parentScope").into()
                } else {
                    quote_ident!("_$parentScope").into()
                }),
            },
        );

        match function.body {
            Some(ref mut _block_stmt) => {
                self.moved_vars.push(vec![]);
                function.visit_mut_children_with(self);
                _ = self.moved_vars.pop()
            }
            None => {}
        }
    }


    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if let Expr::Fn(fn_expr) = expr {
            let mut analyses_created = false;
            if let Some(body) = &mut fn_expr.function.body {
                let bound_vars = swc_ecma_utils::collect_decls(body);
                println!("bound_vars: {:?}", bound_vars);
                let args = fn_expr.function.params.clone();

                let mut visitor = BlockAnalysis {
                    bound_vars,
                    args,
                    module_imports: self.imports.clone(),
                    ..Default::default()
                };
                body.visit_mut_children_with(&mut visitor);
                let analysis = visitor.result();
                self.analyses.push(analysis);
                analyses_created = true;
            }

            let hash = ast_to_hash(fn_expr);
            self.fn_hash.push(hash);
            fn_expr.visit_mut_children_with(self);
            *expr = self.expr_from_fn_expr(fn_expr);
            self.fn_hash.pop();

            if analyses_created {
                self.analyses.pop();
            }
        } else {
            expr.visit_mut_children_with(self);
        }
    }
}
