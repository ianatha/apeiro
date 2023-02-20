use swc_common::DUMMY_SP;
use swc_ecma_ast::{
    CallExpr, Function, Ident, Lit, MemberExpr, ObjectLit, Param, Stmt, VarDecl, VarDeclKind,
    VarDeclarator,
};
use swc_ecma_utils::{member_expr, quote_ident, ExprFactory};

use swc_ecmascript::visit::{as_folder, Fold, VisitMut, VisitMutWith};

use crate::utils::syntax_context_blind_replace_ident;
use crate::ApeiroInternalSyntaxContext;

pub fn folder() -> impl Fold {
    as_folder(HideInternalArguments {})
}

struct HideInternalArguments {}

impl HideInternalArguments {
    fn args_decl(&self, args_to_hide: u32, original_arguments_ident: Ident) -> (Ident, Stmt) {
        let new_arguments_ident = quote_ident!("safe$$arguments");
        let new_arguments_decl = VarDecl {
            span: DUMMY_SP,
            kind: VarDeclKind::Const,
            declare: false,
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: new_arguments_ident.clone().into(),
                init: Some(
                    CallExpr {
                        span: DUMMY_SP,
                        callee: member_expr!(DUMMY_SP, Object.assign).into(),
                        args: vec![
                            ObjectLit {
                                span: DUMMY_SP,
                                props: vec![],
                            }
                            .as_arg(),
                            CallExpr {
                                span: DUMMY_SP,
                                callee: MemberExpr {
                                    span: DUMMY_SP,
                                    obj: CallExpr {
                                        span: DUMMY_SP,
                                        callee: member_expr!(DUMMY_SP, Array.from).into(),
                                        args: vec![original_arguments_ident.as_arg()],
                                        type_args: None,
                                    }
                                    .into(),
                                    prop: quote_ident!("slice").into(),
                                }
                                .as_callee(),
                                args: vec![Lit::Num((args_to_hide as f64).into()).as_arg()],
                                type_args: None,
                            }
                            .as_arg(),
                        ],
                        type_args: None,
                    }
                    .into(),
                ),
                definite: false,
            }],
        };
        (new_arguments_ident, new_arguments_decl.into())
    }

    fn args_to_hide(&self, params: &Vec<Param>) -> u32 {
        let mut args_to_hide = 0;
        for (_, param) in params.iter().enumerate() {
            if param.pat.is_apeiro_internal_syntax_context() {
                args_to_hide += 1;
            } else {
                break;
            }
        }
        args_to_hide
    }
}

impl VisitMut for HideInternalArguments {
    fn visit_mut_function(&mut self, function: &mut Function) {
        // if the function contains a reference to `arguments`
        if let Some(fn_body) = &mut function.body {
            if swc_ecma_utils::contains_arguments(fn_body) {
                let args_to_hide = self.args_to_hide(&function.params);
                if args_to_hide > 0 {
                    let original_arguments_ident = quote_ident!("arguments");
                    let (new_args_ident, new_args_decl) =
                        self.args_decl(args_to_hide, original_arguments_ident.clone());

                    syntax_context_blind_replace_ident(
                        fn_body,
                        original_arguments_ident.to_id(),
                        &new_args_ident,
                    );

                    fn_body.stmts.insert(0, new_args_decl);
                }
            }
        }

        function.visit_mut_children_with(self);
    }
}
