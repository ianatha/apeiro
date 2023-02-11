use swc_common::{sync::Lrc, SourceMap};
use swc_ecma_ast::{Expr, ExprStmt, Lit, Stmt};
use swc_ecma_codegen::{text_writer::WriteJs, Emitter};

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
