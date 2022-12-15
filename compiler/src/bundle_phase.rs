#![allow(clippy::needless_update)]

/// Use memory allocator
extern crate swc_node_base;

use std::{collections::HashMap, path::Path};

use anyhow::Error;
use swc_atoms::js_word;
use swc_bundler::{Bundle, Bundler, Load, ModuleData, ModuleRecord};
use swc_common::{sync::Lrc, FileName, Globals, Mark, SourceMap, Span, GLOBALS};
use swc_ecma_ast::*;
use swc_ecma_codegen::{
    text_writer::{omit_trailing_semi, JsWriter, WriteJs},
    Emitter,
};
use swc_ecma_loader::resolvers::lru::CachingResolver;
use swc_ecma_minifier::option::{
    CompressOptions, ExtraOptions, MangleOptions, MinifyOptions, TopLevelOptions,
};
use swc_ecma_transforms_base::fixer::fixer;
use swc_ecma_visit::VisitMutWith;

use crate::compile_phase::PristineCompiler;

fn get_bundle(cm: Lrc<SourceMap>, modules: Vec<Bundle>, minify: bool) -> String {
    if modules.len() != 1 {
        panic!("Expected 1 bundle, but got {}", modules.len());
    }
    let bundled = modules.get(0).unwrap();
    let code = {
        let mut buf = vec![];

        {
            let wr = JsWriter::new(cm.clone(), "\n", &mut buf, None);
            let mut emitter = Emitter {
                cfg: swc_ecma_codegen::Config {
                    minify,
                    ..Default::default()
                },
                cm: cm.clone(),
                comments: None,
                wr: if minify {
                    Box::new(omit_trailing_semi(wr)) as Box<dyn WriteJs>
                } else {
                    Box::new(wr) as Box<dyn WriteJs>
                },
            };

            emitter.emit_module(&bundled.module).unwrap();
        }

        String::from_utf8_lossy(&buf).to_string()
    };

    #[cfg(feature = "concurrent")]
    rayon::spawn(move || drop(bundled));

    code
}

struct PristineResolver {}

impl swc_bundler::Resolve for PristineResolver {
    fn resolve(&self, base: &FileName, module_specifier: &str) -> Result<FileName, Error> {
        match base {
            FileName::Anon => {
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

fn do_test(
    compiler: Lrc<PristineCompiler>,
    cm: Lrc<SourceMap>,
    entries: HashMap<String, FileName>,
    inline: bool,
    minify: bool,
    special_main: Option<String>,
) -> Result<String, Error> {
    let globals = Box::leak(Box::new(Globals::default()));
    let resolver = PristineResolver {};
    let mut bundler = Bundler::new(
        globals,
        cm.clone(),
        Loader {
            compiler: compiler,
            special_main: special_main,
        },
        CachingResolver::new(
            4096,
            resolver, // NodeModulesResolver::new(TargetEnv::Node, Default::default(), true),
        ),
        swc_bundler::Config {
            require: false,
            disable_inliner: !inline,
            external_modules: Default::default(),
            disable_fixer: minify,
            disable_hygiene: minify,
            disable_dce: false,
            module: Default::default(),
        },
        Box::new(Hook),
    );

    let mut modules = bundler.bundle(entries)?;

    println!("Bundled as {} modules", modules.len());

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
                        cm.clone(),
                        None,
                        None,
                        &MinifyOptions {
                            compress: Some(CompressOptions {
                                top_level: Some(TopLevelOptions { functions: true }),
                                ..Default::default()
                            }),
                            mangle: Some(MangleOptions {
                                top_level: true,
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

    let cm = cm;
    Ok(get_bundle(cm, modules, minify))
}

pub fn pristine_bundle_and_compile_fs(main_file: String) -> Result<String, Error> {
    let minify = false;
    let mut entries = HashMap::default();
    entries.insert("main".to_string(), FileName::Real(main_file.clone().into()));

    let compiler = Lrc::new(crate::compile_phase::PristineCompiler::new());

    let cm = compiler.cm.clone();
    do_test(compiler.clone(), cm, entries, false, minify, None)
}

pub fn pristine_bundle_and_compile(src: String) -> Result<String, Error> {
    let minify = false;
    let mut entries = HashMap::default();

    entries.insert("main".to_string(), FileName::Anon);

    let compiler = Lrc::new(crate::compile_phase::PristineCompiler::new());

    let cm = compiler.cm.clone();
    do_test(compiler.clone(), cm, entries, false, minify, Some(src))
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

pub struct Loader {
    pub compiler: Lrc<PristineCompiler>,
    pub special_main: Option<String>,
    // pub cm: Lrc<SourceMap>,
}

impl Load for Loader {
    fn load(&self, f: &FileName) -> Result<ModuleData, Error> {
        println!("load {:?}", f);
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

        let (fm, module) = self
            .compiler
            .load_module_transpiled(f, &self.special_main)?;

        Ok(ModuleData {
            fm,
            module,
            helpers: Default::default(),
        })
    }
}
