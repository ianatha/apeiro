use std::{collections::HashMap, fs, path::Path};

use anyhow::{anyhow, Error, Result};
use swc::{Compiler, SwcComments};
use swc_bundler::{Bundle, Bundler, Load, ModuleData, ModuleRecord};
use swc_core::{
    atoms::js_word,
    common::{
        chain,
        comments::SingleThreadedComments,
        errors::{ColorConfig, Handler},
        sync::Lrc,
        FileName, Globals, Mark, SourceFile, SourceMap, Span, GLOBALS,
    },
    ecma::{
        ast::{
            Bool, Expr, Ident, KeyValueProp, Lit, MemberExpr, MemberProp, MetaPropExpr,
            MetaPropKind, Module, Program, PropName, Str,
        },
        loader::{resolve::Resolution, resolvers::lru::CachingResolver},
        transforms::base::{fixer::fixer, pass::noop},
        visit::VisitMutWith,
    },
};
use swc_ecma_codegen::{
    text_writer::{omit_trailing_semi, JsWriter, WriteJs},
    Emitter,
};
use swc_ecma_minifier::option::{
    CompressOptions, ExtraOptions, MangleOptions, MinifyOptions, TopLevelOptions,
};
use swc_ecma_parser::{Syntax, TsConfig};
use tracing::{event, instrument, trace, Level};

use crate::{
    either_param_to_closure, fn_decl_to_fn_expr, fn_instrument, helpers,
    helpers::{Helpers, HELPERS},
    now_as_millis, stmt_exploder, CompilationResult, BASELINE_ES_VERSION,
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
    folder_chain: impl FnOnce(&Program) -> P,
    source_map: bool,
    external_helpers: bool,
    minify: bool,
) -> Result<CompilationResult>
where
    P: swc_core::ecma::visit::Fold,
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

fn filename_to_resolution(f: FileName) -> Resolution {
    Resolution {
        filename: f,
        slug: None,
    }
}

impl swc_bundler::Resolve for ApeiroResolver {
    fn resolve(&self, base: &FileName, module_specifier: &str) -> Result<Resolution, Error> {
        match base {
            FileName::Custom(_) => {
                if let Ok(url) = url::Url::parse(module_specifier) {
                    Ok(Resolution {
                        filename: FileName::Url(url),
                        slug: None,
                    })
                } else {
                    let path = Path::new(module_specifier);
                    Ok(filename_to_resolution(FileName::Real(path.to_path_buf())))
                }
            }
            FileName::Real(parent_path) => {
                if let Ok(url) = url::Url::parse(module_specifier) {
                    Ok(filename_to_resolution(FileName::Url(url)))
                } else {
                    let path = parent_path.parent().unwrap().join(module_specifier);
                    Ok(filename_to_resolution(FileName::Real(path.to_path_buf())))
                }
            }
            FileName::Url(parent_url) => Ok(filename_to_resolution(FileName::Url(parent_url.join(module_specifier)?))),
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
    ) -> Result<Vec<swc_core::ecma::ast::KeyValueProp>, anyhow::Error> {
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

impl swc_core::common::source_map::SourceMapGenConfig for ApeiroSourceMapConfig {
    fn file_name_to_source(&self, f: &FileName) -> String {
        let res = format!("source_todo_{}", now_as_millis());
        trace!("f: {:?} -> {}", f, res);
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
                let mut emitter: Emitter<'_, Box<dyn WriteJs>, SourceMap> = Emitter {
                    cfg: swc_ecma_codegen::Config::default().with_minify(minify),
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

            trace!("srcmap_buf: {:?}\n", srcmap_buf);

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
                trace!("fecthed url {:?}", url);
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

        let (file, program) = GLOBALS.set(&Globals::new(), || {
            self.parse(filename, compiled_str.compiled_src)
        })?;

        if let Program::Module(module) = program {
            Ok((file, module))
        } else {
            Err(anyhow!("not a module"))
        }
    }

    pub fn custom_apeiro_compile<P>(
        &self,
        file: Lrc<SourceFile>,
        program: Program,
        folder_chain: impl FnOnce(&Program) -> P,
        source_map: bool,
        external_helpers: bool,
        minify: bool,
    ) -> Result<CompilationResult>
    where
        P: swc_core::ecma::visit::Fold,
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
                        input_source_map: Some(swc::config::InputSourceMap::Bool(true)),
                        jsc: swc::config::JscConfig {
                            target: Some(swc_core::ecma::ast::EsVersion::Es2017),
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
                |p| chain!(folder_chain(p), helpers::inject_helpers(),),
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
        folder_chain: impl FnOnce(&Program) -> P,
        source_map: bool,
        external_helpers: bool,
        minify: bool,
    ) -> Result<CompilationResult>
    where
        P: swc_core::ecma::visit::Fold,
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
