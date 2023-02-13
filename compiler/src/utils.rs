use swc_common::{sync::Lrc, SourceMap};
use swc_ecma_ast::{Expr, ExprStmt, Lit, Stmt};
use swc_ecma_codegen::{text_writer::WriteJs, Emitter};

use swc_common::Spanned;
use swc_common::SyntaxContext;

use swc_ecma_ast::Function;
use swc_ecma_ast::Id;
use swc_ecma_ast::Ident;
use swc_ecma_ast::KeyValueProp;

use swc_ecma_ast::Prop;
use swc_ecma_ast::PropName;

use swc_ecma_visit::noop_visit_mut_type;
use swc_ecma_visit::visit_mut_obj_and_computed;

use swc_ecmascript::visit::{VisitMut, VisitMutWith};

#[allow(dead_code)]
pub fn ast_to_str<T: swc_ecma_codegen::Node>(node: &T) -> Vec<u8> {
    let cm: Lrc<SourceMap> = Default::default();
    let mut buf = vec![];
    {
        let wr = Box::new(swc_ecma_codegen::text_writer::JsWriter::new(
            cm.clone(),
            "\n",
            &mut buf,
            None,
        )) as Box<dyn WriteJs>;

        let mut emitter = Emitter {
            cfg: swc_ecma_codegen::Config {
                ..Default::default()
            },
            comments: None,
            cm: cm.clone(),
            wr,
        };

        node.emit_with(&mut emitter).unwrap();
    }
    buf
}

// #[cfg(test)]
// pub fn ast_to_hash<T: swc_ecma_codegen::Node>(_node: &T) -> u64 {
//     1
// }

// #[cfg(not(test))]
pub fn ast_to_hash<T: swc_ecma_codegen::Node>(node: &T) -> u64 {
    xxhash_rust::xxh3::xxh3_64(&ast_to_str(node))
}

pub fn is_use_strict(first_stmt: &Stmt) -> bool {
    if let Stmt::Expr(ExprStmt { expr, .. }) = first_stmt {
        if let Expr::Lit(Lit::Str(s)) = expr.as_ref() {
            if let Some(atom) = &s.raw {
                if atom == "\"use strict\"" {
                    return true;
                }
            }
        }
    }
    false
}

pub fn syntax_context_blind_replace_ident<T>(node: &mut T, from: Id, to: &Ident)
where
    T: for<'any> VisitMutWith<SyntaxContextBlindIdentReplacer<'any>>,
{
    node.visit_mut_with(&mut SyntaxContextBlindIdentReplacer { from, to })
}

pub struct SyntaxContextBlindIdentReplacer<'a> {
    from: Id,
    to: &'a Ident,
}

impl VisitMut for SyntaxContextBlindIdentReplacer<'_> {
    noop_visit_mut_type!();

    visit_mut_obj_and_computed!();

    fn visit_mut_function(&mut self, _function: &mut Function) {
        // do not descend into functions
    }

    fn visit_mut_prop(&mut self, node: &mut Prop) {
        match node {
            Prop::Shorthand(i) => {
                let cloned = i.clone();
                i.visit_mut_with(self);
                if i.sym != cloned.sym || i.span.ctxt != cloned.span.ctxt {
                    *node = Prop::KeyValue(KeyValueProp {
                        key: PropName::Ident(Ident::new(
                            cloned.sym,
                            cloned.span.with_ctxt(SyntaxContext::empty()),
                        )),
                        value: Box::new(Expr::Ident(i.clone())),
                    });
                }
            }
            _ => {
                node.visit_mut_children_with(self);
            }
        }
    }

    fn visit_mut_ident(&mut self, node: &mut Ident) {
        if node.sym == self.from.0 {
            *node = self.to.clone();
        }
    }
}
