use swc_common::util::take::Take;
use swc_ecma_ast::{CallExpr, Callee};
use swc_ecma_utils::ExprFactory;
use swc_ecmascript::visit::{as_folder, Fold};
use swc_ecmascript::{
    ast::Expr,
    visit::{VisitMut, VisitMutWith},
};

pub fn folder() -> impl Fold {
    as_folder(VisitorEitherParamToClosure {})
}

struct VisitorEitherParamToClosure {}

impl VisitMut for VisitorEitherParamToClosure {
    fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
        let mut is_either = false;
        if let Callee::Expr(callee) = &mut call_expr.callee {
            if let Expr::Ident(i) = &mut **callee {
                if i.sym.to_string() == "either" {
                    is_either = true;
                }
            }
        };

        if is_either {
            let either_first_arg = &mut *call_expr.args.get_mut(0).unwrap().expr;
            if let Expr::Array(array_of_arrays) = either_first_arg {
                for event in array_of_arrays.elems.iter_mut() {
                    let r = &mut *event.as_mut().unwrap().expr;
                    if let Expr::Array(event_to_fnspec) = r {
                        if let Some(first) = event_to_fnspec.elems.get_mut(0).unwrap() {
                            *first.expr = first.expr.take().into_lazy_arrow(vec![]).into();
                        }
                    }
                }
            }
        }
        call_expr.visit_mut_children_with(self);
    }
}
