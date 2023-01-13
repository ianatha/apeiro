use std::fs;

use swc::{Compiler, SwcComments};

use swc_common::comments::SingleThreadedComments;
use swc_common::errors::ColorConfig;
use swc_common::sync::Lrc;

use swc_common::{chain, Globals, SourceFile, GLOBALS};
use swc_common::{errors::Handler, FileName, SourceMap};

use anyhow::{anyhow, Result};
use swc_ecma_ast::{Module, Program};
use swc_ecma_parser::{Syntax, TsConfig};
use swc_ecma_transforms::pass::noop;
use tracing::{event, instrument, Level};

use crate::helpers::{Helpers, HELPERS};
use crate::{
    either_param_to_closure, fn_decl_to_fn_expr, fn_instrument, helpers, stmt_exploder,
    BASELINE_ES_VERSION,
};

pub struct ApeiroCompiler {
    pub cm: Lrc<SourceMap>,
    compiler: Compiler,
}

impl std::fmt::Debug for ApeiroCompiler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApeiroCompiler").finish()
    }
}

pub fn custom_apeiro_compile<P>(
    input: String,
    folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
    source_map: bool,
    external_helpers: bool,
    minify: bool,
) -> Result<String>
where
    P: swc_ecmascript::visit::Fold,
{
    let compiler = ApeiroCompiler::new();
    GLOBALS.set(&Globals::new(), || {
        compiler.custom_apeiro_compile_string(
            input,
            folder_chain,
            source_map,
            external_helpers,
            minify,
        )
    })
}

impl ApeiroCompiler {
    pub fn new() -> ApeiroCompiler {
        let cm = Lrc::new(SourceMap::default());

        ApeiroCompiler {
            cm: cm.clone(),
            compiler: Compiler::new(cm.clone()),
        }
    }

    #[instrument]
    pub fn load_module_transpiled(
        &self,
        f: &FileName,
        special_main: &Option<String>,
    ) -> Result<(Lrc<SourceFile>, Module)> {
        let contents = match f {
            FileName::Anon => special_main.clone().unwrap(),
            FileName::Real(path) => fs::read_to_string(path)?,
            FileName::Url(url) => {
                let res = futures::executor::block_on(reqwest::get(url.clone())).unwrap();
                let t = futures::executor::block_on(res.text()).unwrap();
                println!("fecthed url {:?}", url);
                t
            }
            _ => unreachable!(),
        };

        let should_compile = match f {
            FileName::Anon => true,
            FileName::Real(_) => true,
            _ => false,
        };

        let compiled_str = if should_compile {
            event!(Level::INFO, "compiling");
            self.custom_apeiro_compile_string(
                contents,
                |_| {
                    chain!(
                        either_param_to_closure::folder(),
                        fn_decl_to_fn_expr::folder(),
                        stmt_exploder::folder(),
                        fn_instrument::folder(),
                    )
                },
                true,
                false,
                false,
            )?
        } else {
            self.custom_apeiro_compile_string(contents, |_| noop(), true, false, false)?
        };

        let (file, program) = GLOBALS.set(&Globals::new(), || self.parse(compiled_str));

        if let swc_ecma_ast::Program::Module(module) = program {
            Ok((file, module))
        } else {
            Err(anyhow!("not a module"))
        }
    }

    pub fn custom_apeiro_compile<P>(
        &self,
        file: Lrc<SourceFile>,
        program: Program,
        folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
        source_map: bool,
        external_helpers: bool,
        minify: bool,
    ) -> Result<String>
    where
        P: swc_ecmascript::visit::Fold,
    {
        HELPERS.set(&Helpers::new(external_helpers), || {
            let handler =
                Handler::with_tty_emitter(ColorConfig::Auto, true, false, Some(self.cm.clone()));

            let config = TsConfig {
                tsx: true,
                decorators: true,
                ..Default::default()
            };

            let result = self.compiler.process_js_with_custom_pass(
                file,
                Some(program),
                &handler,
                &swc::config::Options {
                    config: swc::config::Config {
                        jsc: swc::config::JscConfig {
                            target: Some(swc_ecma_ast::EsVersion::Es2015),
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
            )?;

            let mut result_str = String::new();

            result_str.push_str(&result.code);

            Ok(result_str)
        })
    }

    #[instrument]
    pub fn parse(&self, input: String) -> (Lrc<SourceFile>, Program) {
        let cm: Lrc<SourceMap> = Default::default();
        let compiler = Compiler::new(cm.clone());
        let handler = Handler::with_tty_emitter(ColorConfig::Auto, true, false, Some(cm.clone()));

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

        (file, program)
    }

    pub fn custom_apeiro_compile_string<P>(
        &self,
        input: String,
        folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
        source_map: bool,
        external_helpers: bool,
        minify: bool,
    ) -> Result<String>
    where
        P: swc_ecmascript::visit::Fold,
    {
        let (file, program) = self.parse(input);

        self.custom_apeiro_compile(
            file,
            program,
            folder_chain,
            source_map,
            external_helpers,
            minify,
        )
    }
}
