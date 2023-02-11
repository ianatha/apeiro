use std::collections::HashMap;
use std::fs;
use std::path::Path;

use swc::{Compiler, SwcComments};

use swc_atoms::js_word;
use swc_bundler::{Bundle, Bundler, Load, ModuleData, ModuleRecord};
use swc_common::comments::SingleThreadedComments;
use swc_common::errors::ColorConfig;
use swc_common::sync::Lrc;

use swc_common::{chain, Globals, Mark, SourceFile, Span, GLOBALS};
use swc_common::{errors::Handler, FileName, SourceMap};

use anyhow::{anyhow, Error, Result};
use swc_ecma_ast::{
    Bool, Expr, Ident, KeyValueProp, Lit, MemberExpr, MemberProp, MetaPropExpr, MetaPropKind,
    Module, Program, PropName, Str,
};
use swc_ecma_codegen::text_writer::{omit_trailing_semi, JsWriter, WriteJs};
use swc_ecma_codegen::Emitter;
use swc_ecma_loader::resolvers::lru::CachingResolver;
use swc_ecma_minifier::option::{
    CompressOptions, ExtraOptions, MangleOptions, MinifyOptions, TopLevelOptions,
};
use swc_ecma_parser::{Syntax, TsConfig};
use swc_ecma_transforms::fixer;
use swc_ecma_transforms::pass::noop;
use swc_ecma_visit::VisitMutWith;
use tracing::{event, instrument, Level};

use crate::helpers::{Helpers, HELPERS};
use crate::{
    either_param_to_closure, decl_to_expr, fn_instrument, helpers, now_as_millis,
    stmt_exploder, CompilationResult, BASELINE_ES_VERSION, for_stmt_to_while_stmt,
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
) -> Result<CompilationResult>
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

struct ApeiroResolver {}

impl swc_bundler::Resolve for ApeiroResolver {
    fn resolve(&self, base: &FileName, module_specifier: &str) -> Result<FileName, Error> {
        match base {
            FileName::Custom(_) => {
                if let Ok(url) = url::Url::parse(module_specifier) {
                    Ok(FileName::Url(url))
                } else {
                    let path = Path::new(module_specifier);
                    Ok(FileName::Real(path.to_path_buf()))
                }
            }
            FileName::Real(parent_path) => {
                if let Ok(url) = url::Url::parse(module_specifier) {
                    Ok(FileName::Url(url))
                } else {
                    let path = parent_path.parent().unwrap().join(module_specifier);
                    Ok(FileName::Real(path.to_path_buf()))
                }
            }
            FileName::Url(parent_url) => Ok(FileName::Url(parent_url.join(module_specifier)?)),
            _ => unreachable!(),
        }
    }
}

struct Hook;

impl swc_bundler::Hook for Hook {
    fn get_import_meta_props(
        &self,
        span: Span,
        module_record: &ModuleRecord,
    ) -> Result<Vec<swc_ecma_ast::KeyValueProp>, anyhow::Error> {
        let file_name = module_record.file_name.to_string();

        Ok(vec![
            KeyValueProp {
                key: PropName::Ident(Ident::new(js_word!("url"), span)),
                value: Box::new(Expr::Lit(Lit::Str(Str {
                    span,
                    raw: None,
                    value: file_name.into(),
                }))),
            },
            KeyValueProp {
                key: PropName::Ident(Ident::new(js_word!("main"), span)),
                value: Box::new(if module_record.is_entry {
                    Expr::Member(MemberExpr {
                        span,
                        obj: Box::new(Expr::MetaProp(MetaPropExpr {
                            span,
                            kind: MetaPropKind::ImportMeta,
                        })),
                        prop: MemberProp::Ident(Ident::new(js_word!("main"), span)),
                    })
                } else {
                    Expr::Lit(Lit::Bool(Bool { span, value: false }))
                }),
            },
        ])
    }
}

pub struct Loader<'a> {
    pub compiler: &'a ApeiroCompiler,
}

impl<'a> Load for Loader<'a> {
    fn load(&self, f: &FileName) -> Result<ModuleData, anyhow::Error> {
        event!(Level::INFO, "load {:?}", f);
        // let fm = match f {
        //     FileName::Real(path) => self.cm.load_file(path)?,
        //     _ => unreachable!(),
        // };

        // let module = parse_file_as_module(
        //     &fm,
        //     Syntax::Typescript(TsConfig {
        //         ..Default::default()
        //     }),
        //     EsVersion::Es2020,
        //     None,
        //     &mut vec![],
        // )
        // .unwrap_or_else(|err| {
        //     let handler =
        //         Handler::with_tty_emitter(ColorConfig::Always, false, false, Some(self.cm.clone()));
        //     err.into_diagnostic(&handler).emit();
        //     panic!("failed to parse")
        // });

        let (fm, module) = self.compiler.load_module_transpiled(f)?;

        Ok(ModuleData {
            fm,
            module,
            helpers: Default::default(),
        })
    }
}

struct ApeiroSourceMapConfig {}

impl swc_common::source_map::SourceMapGenConfig for ApeiroSourceMapConfig {
    fn file_name_to_source(&self, f: &FileName) -> String {
        let res = format!("source_todo_{}", now_as_millis());
        println!("f: {:?} -> {}", f, res);
        f.to_string()
    }

    fn inline_sources_content(&self, _f: &FileName) -> bool {
        true
    }

    fn emit_columns(&self, _f: &FileName) -> bool {
        true
    }

    fn skip(&self, _f: &FileName) -> bool {
        false
    }
}

impl ApeiroCompiler {
    pub fn new() -> ApeiroCompiler {
        let cm = Lrc::new(SourceMap::default());

        ApeiroCompiler {
            cm: cm.clone(),
            compiler: Compiler::new(cm.clone()),
        }
    }

    pub fn bundle_main(&self, src: String, minify: bool) -> Result<CompilationResult, Error> {
        let mut entries = HashMap::default();
        entries.insert("main".to_string(), FileName::Custom(src));
        self.bundle(entries, minify)
    }

    fn get_bundle(&self, modules: Vec<Bundle>, minify: bool) -> CompilationResult {
        if modules.len() != 1 {
            panic!("Expected 1 bundle, but got {}", modules.len());
        }
        let bundled = modules.get(0).unwrap();
        let mut srcmap_buf = vec![];

        let code = {
            let mut src_buf = vec![];
            {
                let wr = JsWriter::new(self.cm.clone(), "\n", &mut src_buf, Some(&mut srcmap_buf));
                let mut emitter = Emitter {
                    cfg: swc_ecma_codegen::Config {
                        minify,
                        ..Default::default()
                    },
                    cm: self.cm.clone(),
                    comments: None,
                    wr: if minify {
                        Box::new(omit_trailing_semi(wr)) as Box<dyn WriteJs>
                    } else {
                        Box::new(wr) as Box<dyn WriteJs>
                    },
                };

                emitter.emit_module(&bundled.module).unwrap();
            }

            println!("srcmap_buf: {:?}\n", srcmap_buf);

            String::from_utf8_lossy(&src_buf).to_string()
        };

        let map = {
            let mut buf = vec![];

            self.cm
                .build_source_map_with_config(
                    &srcmap_buf,
                    None, //orig ,
                    ApeiroSourceMapConfig {
                        // source_file_name,
                        // output_path: output_path.as_deref(),
                        // names: source_map_names,
                        // inline_sources_content,
                        // emit_columns: emit_source_map_columns,
                    },
                )
                .to_writer(&mut buf)
                .unwrap();
            // .context("failed to write source map")?;
            String::from_utf8(buf).unwrap()
        };

        #[cfg(feature = "concurrent")]
        rayon::spawn(move || drop(bundled));

        // TODO: iwa

        CompilationResult {
            compiled_src: code,
            source_map: Some(map),
            program_counter_mapping: vec![],
        }
    }

    pub fn bundle(
        &self,
        entries: HashMap<String, FileName>,
        minify: bool,
    ) -> Result<CompilationResult, Error> {
        let globals = Box::leak(Box::new(Globals::default()));
        let resolver = ApeiroResolver {};
        let mut bundler = Bundler::new(
            globals,
            self.cm.clone(),
            Loader { compiler: self },
            CachingResolver::new(
                4096,
                resolver, // NodeModulesResolver::new(TargetEnv::Node, Default::default(), true),
            ),
            swc_bundler::Config {
                require: false,
                disable_inliner: false,
                external_modules: Default::default(),
                disable_fixer: minify,
                disable_hygiene: minify,
                disable_dce: false,
                module: Default::default(),
            },
            Box::new(Hook),
        );

        let mut modules = bundler.bundle(entries)?;

        event!(Level::INFO, "Bundled as {} modules", modules.len());

        #[cfg(feature = "concurrent")]
        rayon::spawn(move || {
            drop(bundler);
        });

        if minify {
            modules = modules
                .into_iter()
                .map(|mut b| {
                    GLOBALS.set(globals, || {
                        b.module = swc_ecma_minifier::optimize(
                            b.module.into(),
                            self.cm.clone(),
                            None,
                            None,
                            &MinifyOptions {
                                compress: Some(CompressOptions {
                                    top_level: Some(TopLevelOptions { functions: true }),
                                    ..Default::default()
                                }),
                                mangle: Some(MangleOptions {
                                    top_level: Some(true),
                                    ..Default::default()
                                }),
                                ..Default::default()
                            },
                            &ExtraOptions {
                                unresolved_mark: Mark::new(),
                                top_level_mark: Mark::new(),
                            },
                        )
                        .expect_module();
                        b.module.visit_mut_with(&mut fixer(None));
                        b
                    })
                })
                .collect();
        }

        Ok(self.get_bundle(modules, minify))
    }

    #[instrument]
    pub fn load_module_transpiled(&self, f: &FileName) -> Result<(Lrc<SourceFile>, Module)> {
        let filename = match f {
            FileName::Custom(_src) => "toplevel".to_string(),
            FileName::Real(_path) => "path".to_string(),
            FileName::Url(url) => url.to_string(),
            _ => unreachable!(),
        };

        let contents = match f {
            FileName::Custom(src) => src.clone(),
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
            FileName::Custom(_) => false,
            FileName::Real(_) => false,
            _ => false,
        };

        let compiled_str = if should_compile {
            event!(Level::INFO, "compiling");
            self.custom_apeiro_compile_string(
                contents,
                |_| {
                    chain!(
                        either_param_to_closure::folder(),
                        decl_to_expr::folder(),
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

        let (file, program) = GLOBALS.set(&Globals::new(), || {
            self.parse(filename, compiled_str.compiled_src)
        })?;

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
    ) -> Result<CompilationResult>
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

            let unresolved_mark = swc_common::Mark::new();
            let top_level_mark = swc_common::Mark::new();

            let result = self.compiler.process_js_with_custom_pass(
                file,
                Some(program),
                &handler,
                &swc::config::Options {
                    config: swc::config::Config {
                        input_source_map: Some(swc::config::InputSourceMap::Bool(true)),
                        jsc: swc::config::JscConfig {
                            target: Some(BASELINE_ES_VERSION),
                            syntax: Some(swc_ecma_parser::Syntax::Typescript(config)),
                            ..Default::default()
                        },
                        minify: minify.into(),
                        ..Default::default()
                    },
                    source_maps: if source_map {
                        Some(swc::config::SourceMapsConfig::Str("inline".to_string()))
                    } else {
                        None
                    },
                    ..Default::default()
                },
                SingleThreadedComments::default(),
                |_| noop(),
                |p| chain!(
                    swc_ecma_transforms_compat::es2015::arrow(swc_common::Mark::new()),
                    swc_ecma_transforms_compat::es2015::destructuring::destructuring(Default::default()),
                    for_stmt_to_while_stmt::folder(),
                    swc_ecma_transforms_base::resolver(
                        unresolved_mark,
                        top_level_mark,
                        false
                    ),
                    folder_chain(p),
                    swc_ecma_transforms_base::hygiene::hygiene_with_config(swc_ecma_transforms_base::hygiene::Config {
                        top_level_mark: top_level_mark,
                        ..Default::default()
                    }),
                    helpers::inject_helpers(),
                ),
            )?;

            let pc_to_src = HELPERS.with(|helpers| helpers.pc_to_src_get());

            Ok(CompilationResult {
                compiled_src: result.code,
                source_map: result.map,
                program_counter_mapping: pc_to_src,
            })
        })
    }

    #[instrument]
    pub fn parse(&self, name: String, input: String) -> Result<(Lrc<SourceFile>, Program)> {
        let handler =
            Handler::with_tty_emitter(ColorConfig::Auto, true, false, Some(self.cm.clone()));

        let config = TsConfig {
            tsx: true,
            decorators: true,
            ..Default::default()
        };

        let comments: SwcComments = Default::default();

        let file = self.cm.new_source_file(FileName::Custom(name), input);

        let program = self.compiler.parse_js(
            file.clone(),
            &handler,
            BASELINE_ES_VERSION,
            Syntax::Typescript(config),
            swc::config::IsModule::Bool(true),
            Some(&comments),
        )?;

        Ok((file, program))
    }

    pub fn custom_apeiro_compile_string<P>(
        &self,
        input: String,
        folder_chain: impl FnOnce(&swc_ecma_ast::Program) -> P,
        source_map: bool,
        external_helpers: bool,
        minify: bool,
    ) -> Result<CompilationResult>
    where
        P: swc_ecmascript::visit::Fold,
    {
        let (file, program) = self.parse("toplevel".into(), input)?;

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
