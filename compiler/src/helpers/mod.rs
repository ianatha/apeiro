// copied from swc_ecma_transforms_base/src/helpers/mod.rs
use std::{
    cell::RefCell,
    mem::replace,
    sync::atomic::{AtomicBool, Ordering},
};

use once_cell::sync::Lazy;
use rustc_hash::FxHashMap;
use swc_core::{
    atoms::JsWord,
    common::{FileName, FilePathMapping, Mark, SourceMap, SyntaxContext, DUMMY_SP},
    ecma::{
        ast::*,
        utils::{prepend_stmts, DropSpan},
        visit::{as_folder, noop_visit_mut_type, Fold, VisitMut, VisitMutWith},
    },
};

use crate::ProgramCounterToSourceLocation;

#[doc(hidden)]
#[macro_export]
macro_rules! helper_expr {
    (ts, $field_name:ident, $s:tt) => {{
        $crate::helper_expr!(ts, ::swc_core::common::DUMMY_SP, $field_name, $s)
    }};

    (ts, $span:expr, $field_name:ident, $s:tt) => {{
        #[allow(unused_imports)]
        use swc_core::ecma::utils::{quote_ident, ExprFactory};

        debug_assert!(
            $s.starts_with("__"),
            "ts helper! macro should be invoked with '__' prefix"
        );
        let mark = $crate::enable_helper!($field_name);
        let span = $span.apply_mark(mark);
        let external = $crate::helpers::HELPERS.with(|helper| helper.external());

        if external {
            Expr::from(swc_core::ecma::utils::quote_ident!(
                span,
                concat!("_", stringify!($field_name))
            ))
        } else {
            Expr::from(swc_core::ecma::utils::quote_ident!(span, $s))
        }
    }};

    ($field_name:ident, $s:tt) => {{
        $crate::helper_expr!(::swc_core::common::DUMMY_SP, $field_name, $s)
    }};

    ($span:expr, $field_name:ident, $s:tt) => {{
        #[allow(unused_imports)]
        use swc_core::ecma::utils::{quote_ident, ExprFactory};

        debug_assert!(
            !$s.starts_with("_"),
            "helper! macro should not invoked with '_' prefix"
        );
        let mark = $crate::enable_helper!($field_name);
        let span = $span.apply_mark(mark);
        let external = $crate::helpers::HELPERS.with(|helper| helper.external());

        if external {
            Expr::from(swc_core::ecma::utils::quote_ident!(
                span,
                concat!("_", stringify!($field_name))
            ))
        } else {
            Expr::from(swc_core::ecma::utils::quote_ident!(span, concat!("_", $s)))
        }
    }};
}

#[macro_export]
macro_rules! helper {
    ($($t:tt)*) => {{
        use swc_core::ecma::utils::ExprFactory;
        $crate::helper_expr!($($t)*).as_callee()
    }};
}

#[macro_export]
macro_rules! enable_helper {
    ($i:ident) => {{
        $crate::helpers::HELPERS.with(|helpers| {
            helpers.$i();
            helpers.mark()
        })
    }};
}

fn parse(code: &str) -> Vec<Stmt> {
    let cm = SourceMap::new(FilePathMapping::empty());

    let fm = cm.new_source_file(FileName::Custom(stringify!($name).into()), code.into());

    swc_ecma_parser::parse_file_as_script(
        &fm,
        Default::default(),
        Default::default(),
        None,
        &mut vec![],
    )
    .map(|mut script| {
        script.body.visit_mut_with(&mut DropSpan {
            preserve_ctxt: false,
        });
        script.body
    })
    .map_err(|e| {
        unreachable!("Error occurred while parsing error: {:?}", e);
    })
    .unwrap()
}

macro_rules! add_to {
    ($buf:expr, $name:ident, $b:expr, $mark:expr) => {{
        static STMTS: Lazy<Vec<Stmt>> = Lazy::new(|| {
            let code = include_str!(concat!("./_", stringify!($name), ".js"));
            parse(&code)
        });

        let enable = $b.load(Ordering::Relaxed);
        if enable {
            $buf.extend(STMTS.iter().cloned().map(|mut stmt| {
                stmt.visit_mut_with(&mut Marker {
                    base: SyntaxContext::empty().apply_mark($mark),
                    decls: Default::default(),

                    decl_ctxt: SyntaxContext::empty().apply_mark(Mark::new()),
                });
                stmt
            }))
        }
    }};
}

macro_rules! add_import_to {
    ($buf:expr, $name:ident, $b:expr, $mark:expr) => {{
        let enable = $b.load(Ordering::Relaxed);
        if enable {
            let s = ImportSpecifier::Default(ImportDefaultSpecifier {
                span: DUMMY_SP,
                local: Ident::new(
                    concat!("_", stringify!($name)).into(),
                    DUMMY_SP.apply_mark($mark),
                ),
            });

            let src: Str = concat!("@apeiro/helpers/src/_", stringify!($name), ".mjs").into();

            $buf.push(ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
                span: DUMMY_SP,
                specifiers: vec![s],
                src: Box::new(src),
                with: Default::default(),
                type_only: Default::default(),
                phase: Default::default(),
            })))
        }
    }};
}

better_scoped_tls::scoped_tls!(
    /// This variable is used to manage helper scripts like `_inherits` from babel.
    ///
    /// The instance contains flags where each flag denotes if a helper script should be injected.
    pub static HELPERS: Helpers
);

/// Tracks used helper methods. (e.g. __extends)
#[derive(Debug, Default)]
pub struct Helpers {
    external: bool,
    mark: HelperMark,
    inner: Inner,
    pc_to_src: RefCell<Vec<ProgramCounterToSourceLocation>>,
}

impl Helpers {
    pub fn new(external: bool) -> Self {
        Helpers {
            external,
            mark: Default::default(),
            inner: Default::default(),
            pc_to_src: Default::default(),
        }
    }

    pub const fn mark(&self) -> Mark {
        self.mark.0
    }

    pub const fn external(&self) -> bool {
        self.external
    }

    pub fn add_pc_to_src(&self, fnhash: u64, pc: i32, start_loc: u32, end_loc: u32) {
        self.pc_to_src
            .borrow_mut()
            .push(ProgramCounterToSourceLocation {
                fnhash,
                pc,
                start_loc,
                end_loc,
            });
    }

    pub fn pc_to_src_get(&self) -> Vec<ProgramCounterToSourceLocation> {
        self.pc_to_src.borrow().clone()
    }
}

#[derive(Debug, Clone, Copy)]
struct HelperMark(Mark);
impl Default for HelperMark {
    fn default() -> Self {
        HelperMark(Mark::fresh(Mark::root()))
    }
}

macro_rules! define_helpers {
    (
        Helpers {
            $( $name:ident : ( $( $dep:ident ),* ), )*
        }
    ) => {
        #[derive(Debug,Default)]
        struct Inner {
            $( $name: AtomicBool, )*
        }

        impl Helpers {
            $(
                pub fn $name(&self) {
                    self.inner.$name.store(true, Ordering::Relaxed);

                    if !self.external {
                        $(
                            self.$dep();
                        )*
                    }
                }
            )*
        }

        impl Helpers {
            pub fn extend_from(&self, other: &Self) {
                $(
                    if other.inner.$name.load(Ordering::SeqCst) {
                        self.inner.$name.store(true, Ordering::Relaxed);
                    }
                )*
            }
        }

        impl InjectHelpers {
            fn is_helper_used(&self) -> bool{
                let mut value = false;

                HELPERS.with(|helpers|{
                    $(
                        value |= helpers.inner.$name.load(Ordering::Relaxed);
                    )*
                });

                value
            }

            fn build_helpers(&self) -> Vec<Stmt> {
                let mut buf = vec![];

                HELPERS.with(|helpers|{
                    debug_assert!(!helpers.external);
                    $(
                            add_to!(buf, $name, helpers.inner.$name, helpers.mark.0);
                    )*
                });

                buf
            }

            fn build_imports(&self) -> Vec<ModuleItem> {
                let mut buf = vec![];

                HELPERS.with(|helpers|{
                    debug_assert!(helpers.external);
                    $(
                            add_import_to!(buf, $name, helpers.inner.$name, helpers.mark.0);
                    )*
                });

                buf
            }
        }
    };
}

define_helpers!(Helpers {
    define_property: (),
    ts_generator: (),
    ts_values: (),
});

pub fn inject_helpers() -> impl Fold + VisitMut {
    as_folder(InjectHelpers)
}

struct InjectHelpers;

impl InjectHelpers {
    fn make_helpers_for_module(&self) -> Vec<ModuleItem> {
        let (_, external) = HELPERS.with(|helper| (helper.mark(), helper.external()));
        if external {
            if self.is_helper_used() {
                self.build_imports()
            } else {
                vec![]
            }
        } else {
            self.build_helpers()
                .into_iter()
                .map(ModuleItem::Stmt)
                .collect()
        }
    }

    fn make_helpers_for_script(&self) -> Vec<Stmt> {
        let external = HELPERS.with(|helper| helper.external());

        if external {
            panic!(
                "Cannot use script with externalHelpers; There's no standard way to import other \
                 modules"
            );
        }

        self.build_helpers()
    }
}

impl VisitMut for InjectHelpers {
    noop_visit_mut_type!();

    fn visit_mut_module(&mut self, module: &mut Module) {
        let helpers = self.make_helpers_for_module();

        prepend_stmts(&mut module.body, helpers.into_iter());
    }

    fn visit_mut_script(&mut self, script: &mut Script) {
        let helpers = self.make_helpers_for_script();

        prepend_stmts(&mut script.body, helpers.into_iter());
    }
}

struct Marker {
    base: SyntaxContext,
    decls: FxHashMap<JsWord, SyntaxContext>,

    decl_ctxt: SyntaxContext,
}

impl VisitMut for Marker {
    noop_visit_mut_type!();

    fn visit_mut_fn_decl(&mut self, n: &mut FnDecl) {
        let old_decl_ctxt = replace(
            &mut self.decl_ctxt,
            SyntaxContext::empty().apply_mark(Mark::new()),
        );
        let old_decls = self.decls.clone();

        n.visit_mut_children_with(self);

        self.decls = old_decls;
        self.decl_ctxt = old_decl_ctxt;
    }

    fn visit_mut_fn_expr(&mut self, n: &mut FnExpr) {
        let old_decl_ctxt = replace(
            &mut self.decl_ctxt,
            SyntaxContext::empty().apply_mark(Mark::new()),
        );
        let old_decls = self.decls.clone();

        n.visit_mut_children_with(self);

        self.decls = old_decls;
        self.decl_ctxt = old_decl_ctxt;
    }

    fn visit_mut_ident(&mut self, i: &mut Ident) {
        i.span.ctxt = self.decls.get(&i.sym).copied().unwrap_or(self.base);
    }

    fn visit_mut_member_prop(&mut self, p: &mut MemberProp) {
        if let MemberProp::Computed(p) = p {
            p.visit_mut_with(self);
        }
    }

    fn visit_mut_param(&mut self, n: &mut Param) {
        if let Pat::Ident(i) = &n.pat {
            self.decls.insert(i.id.sym.clone(), self.decl_ctxt);
        }

        n.visit_mut_children_with(self);
    }

    fn visit_mut_prop_name(&mut self, n: &mut PropName) {
        if let PropName::Computed(e) = n {
            e.visit_mut_with(self);
        }
    }

    fn visit_mut_super_prop(&mut self, p: &mut SuperProp) {
        if let SuperProp::Computed(p) = p {
            p.visit_mut_with(self);
        }
    }

    fn visit_mut_var_declarator(&mut self, v: &mut VarDeclarator) {
        if let Pat::Ident(i) = &mut v.name {
            if &*i.id.sym == "id" {
                i.id.span.ctxt = self.base;
                self.decls.insert(i.id.sym.clone(), self.base);
                return;
            }

            if &*i.id.sym != "_typeof" && !i.id.sym.starts_with("__") {
                self.decls.insert(i.id.sym.clone(), self.decl_ctxt);
            }
        }

        v.visit_mut_children_with(self);
    }
}

// #[cfg(test)]
// mod tests {
//     use swc_core::ecma::visit::{as_folder, FoldWith};
//     use testing::DebugUsingDisplay;

//     use super::*;
//     use crate::pass::noop;

//     #[test]
//     fn external_helper() {
//         let input = "_throw()";
//         crate::tests::Tester::run(|tester| {
//             HELPERS.set(&Helpers::new(true), || {
//                 let expected = tester.apply_transform(
//                     as_folder(DropSpan {
//                         preserve_ctxt: false,
//                     }),
//                     "output.js",
//                     Default::default(),
//                     "import _throw from \"@swc/helpers/src/_throw.mjs\";
// _throw();",
//                 )?;
//                 enable_helper!(throw);

//                 eprintln!("----- Actual -----");

//                 let tr = as_folder(InjectHelpers);
//                 let actual = tester
//                     .apply_transform(tr, "input.js", Default::default(), input)?
//                     .fold_with(&mut crate::hygiene::hygiene())
//                     .fold_with(&mut crate::fixer::fixer(None));

//                 if actual == expected {
//                     return Ok(());
//                 }

//                 let (actual_src, expected_src) = (tester.print(&actual), tester.print(&expected));

//                 if actual_src == expected_src {
//                     return Ok(());
//                 }

//                 println!(">>>>> Orig <<<<<\n{}", input);
//                 println!(">>>>> Code <<<<<\n{}", actual_src);
//                 assert_eq!(
//                     DebugUsingDisplay(&actual_src),
//                     DebugUsingDisplay(&expected_src)
//                 );
//                 Err(())
//             })
//         });
//     }

//     #[test]
//     fn use_strict_before_helper() {
//         crate::tests::test_transform(
//             Default::default(),
//             |_| {
//                 enable_helper!(throw);
//                 as_folder(InjectHelpers)
//             },
//             "'use strict'",
//             "'use strict'
// function _throw(e) {
//     throw e;
// }
// ",
//             false,
//             Default::default(),
//         )
//     }

//     #[test]
//     fn name_conflict() {
//         crate::tests::test_transform(
//             Default::default(),
//             |_| {
//                 enable_helper!(throw);
//                 as_folder(InjectHelpers)
//             },
//             "let _throw = null",
//             "function _throw(e) {
//     throw e;
// }
// let _throw1 = null;
// ",
//             false,
//             Default::default(),
//         )
//     }
//     #[test]
//     fn use_strict_abort() {
//         crate::tests::test_transform(
//             Default::default(),
//             |_| noop(),
//             "'use strict'

// let x = 4;",
//             "'use strict'

// let x = 4;",
//             false,
//             Default::default(),
//         );
//     }
// }
