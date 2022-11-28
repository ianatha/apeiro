#[cfg(test)]
mod tests;

#[allow(dead_code)]
pub mod helpers;

mod either_param_to_closure;
mod fn_decl_to_fn_expr;
mod fn_instrument;
#[allow(dead_code)]
mod generator;
mod utils;

use swc::{Compiler, SwcComments};

use swc_common::comments::SingleThreadedComments;
use swc_common::errors::ColorConfig;
use swc_common::sync::Lrc;

use swc_common::{chain, Globals, GLOBALS};
use swc_common::{errors::Handler, FileName, SourceMap};
use swc_ecma_ast::EsVersion;

use anyhow::Result;
use swc_ecma_parser::{Syntax, TsConfig};
use swc_ecma_transforms::pass::noop;

pub fn engine_runtime_compile(input: String) -> Result<String> {
    custom_pristine_compile(input, |_| noop(), false, false, true)
}

pub fn pristine_compile(input: String) -> Result<String> {
    custom_pristine_compile(
        input,
        |_| {
            chain!(
                either_param_to_closure::folder(),
                fn_decl_to_fn_expr::folder(),
                fn_instrument::folder(),
            )
        },
        true,
        false,
        false,
    )
}

const BASELINE_ES_VERSION: EsVersion = EsVersion::Es2015;

use self::helpers::{Helpers, HELPERS};
pub fn custom_pristine_compile<P>(
    input: String,
    folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
    source_map: bool,
    external_helpers: bool,
    minify: bool,
) -> Result<String>
where
    P: swc_ecmascript::visit::Fold,
{
    GLOBALS.set(&Globals::new(), || {
        HELPERS.set(&Helpers::new(external_helpers), || {
            let cm: Lrc<SourceMap> = Default::default();
            let compiler = Compiler::new(cm.clone());
            let handler =
                Handler::with_tty_emitter(ColorConfig::Auto, true, false, Some(cm.clone()));

            let config = TsConfig {
                tsx: true,
                decorators: true,
                ..Default::default()
            };

            let comments: SwcComments = Default::default();

            let file = cm.new_source_file(FileName::Custom("input.js".into()), input);

            let program = compiler
                .parse_js(
                    file.clone(),
                    &handler,
                    BASELINE_ES_VERSION,
                    Syntax::Typescript(config),
                    swc::config::IsModule::Bool(true),
                    Some(&comments),
                )
                .expect("Failed to parse JS");

            let result = compiler.process_js_with_custom_pass(
                file,
                Some(program),
                &handler,
                &swc::config::Options {
                    config: swc::config::Config {
                        jsc: swc::config::JscConfig {
                            target: Some(BASELINE_ES_VERSION),
                            syntax: Some(swc_ecma_parser::Syntax::Typescript(config)),
                            ..Default::default()
                        },
                        minify: minify.into(),
                        ..Default::default()
                    },
                    source_maps: if source_map {
                        Some(swc::config::SourceMapsConfig::Str("inline".into()))
                    } else {
                        None
                    },
                    ..Default::default()
                },
                SingleThreadedComments::default(),
                |_| noop(),
                |p| chain!(folder_chain(p), helpers::inject_helpers(),),
            );

            let result = result?;

            let mut result_str = String::new();

            // match result.map {
            //     Some(map) => {
            //         let src_map_b64 = base64::encode(map);
            //         result_str.push_str(&format!(
            //             "//# sourceMappingURL=data:application/json;base64,{}",
            //             src_map_b64
            //         ));
            //     }
            //     None => {}
            // }
            // result_str.push_str("//apeirocode\n\nfunction $fnwrap(fn, hash) { return fn; }\n");
            result_str.push_str(&result.code);

            Ok(result_str)
        })
    })
}
