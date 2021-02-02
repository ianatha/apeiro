mod engine;
mod fs;
#[cfg(test)]
mod tests;
mod v8_helpers;

use anyhow::{anyhow, Ok, Result};
use std::env;
use std::string::String;

/// pristine_stepper [id] [js_stmt]
/// Steps a Pristine function by executing [js_stmt]. If no [id].state.json, or [id].snapshot.bin exist,
/// it assumes this is the function's first step, and it expects its source to be at [id].js.
/// [id].js is not evaluated after the first step.
#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();

    engine::v8_init();

    let res = engine::step_fs_process(
        args.get(1)
            .ok_or(anyhow!("missing first argument: src name, without the js"))?,
        args.get(2)
            .ok_or(anyhow!("missing stepping js expression"))?
            .clone(),
    )
    .await;

    match res {
        Result::Ok(()) => {
            println!("ok");
        }
        Err(e) => {
            println!("error: {}", e);
        }
    }

    Ok(())
}
