use swc::{Compiler, SwcComments};

use swc_common::comments::SingleThreadedComments;
use swc_common::errors::ColorConfig;
use swc_common::sync::Lrc;

use swc_common::{chain, Globals, GLOBALS};
use swc_common::{errors::Handler, FileName, SourceMap};

use anyhow::Result;
use swc_ecma_parser::{Syntax, TsConfig};
use swc_ecma_transforms::pass::noop;

use crate::helpers::{Helpers, HELPERS};
use crate::{helpers, BASELINE_ES_VERSION};

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

            result_str.push_str(&result.code);

            Ok(result_str)
        })
    })
}
