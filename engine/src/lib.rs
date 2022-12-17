#[cfg(test)]
mod tests;

mod db;
mod dengine;
mod engine;
mod v8_helpers;

use std::sync::Once;

pub use dengine::DEngine;
pub use engine::Engine;
pub use pristine_compiler::pristine_bundle_and_compile;
pub use pristine_compiler::pristine_compile;
pub use pristine_internal_api::StepResult;
pub use pristine_internal_api::StepResultStatus;

static INIT: Once = Once::new();

#[inline(always)]
pub(crate) fn v8_init() {
    INIT.call_once(|| {
        let flags = concat!(
            " --wasm-test-streaming",
            " --harmony-import-assertions",
            " --no-validate-asm",
            " --turbo_fast_api_calls",
        );

        v8::V8::set_flags_from_string(&format!("{}{}", flags, " --predictable --random-seed=42"));

        let v8_platform = v8::new_default_platform(0, false).make_shared();
        v8::V8::initialize_platform(v8_platform);
        v8::V8::initialize();
    });
}

pub fn get_engine_runtime() -> String {
    pristine_compiler::engine_runtime_compile(include_str!("engine_runtime.ts").into()).unwrap()
}
