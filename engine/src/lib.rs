#[cfg(test)]
mod tests;

pub mod db;
pub mod db_sqlite;
pub mod dengine;
mod engine;
mod eventloop;
pub mod p2prpc;
pub mod plugins;
mod v8_helpers;

use std::sync::Once;

pub use apeiro_compiler::{apeiro_bundle_and_compile, apeiro_compile};
pub use apeiro_internal_api::{ProcSendRequest, StepResult, StepResultStatus};
pub use dengine::DEngine;
pub use engine::{Engine, PristineRunError};

static INIT: Once = Once::new();

#[inline(always)]
pub(crate) fn v8_init() {
    INIT.call_once(|| {
        let flags = concat!(
            " --wasm-test-streaming",
            " --harmony-import-assertions",
            " --no-validate-asm",
            " --turbo_fast_api_calls",
            " --expose-gc",
        );

        v8::V8::set_flags_from_string(&format!("{}{}", flags, " --predictable --random-seed=42"));

        let v8_platform = v8::new_default_platform(0, false).make_shared();
        v8::V8::initialize_platform(v8_platform);
        v8::V8::initialize();
    });
}

pub fn get_engine_runtime() -> String {
    let code = include_str!("engine_runtime.ts");
    // let code =
    // std::fs::read_to_string(std::path::Path::new("engine/src/engine_runtime.ts")).unwrap();
    apeiro_compiler::engine_runtime_compile(code.into()).unwrap()
}
