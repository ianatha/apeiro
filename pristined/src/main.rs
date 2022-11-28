use anyhow::{Ok, Result};
use clap::{Arg, ArgAction, Command};
use pristine_engine::Engine;
use std::string::String;

fn cli() -> Command {
    Command::new("pristine_stepper")
        .arg(
            Arg::new("no-compile")
                .short('N')
                .long("no-compile")
                .action(ArgAction::SetTrue)
                .num_args(0),
        )
        .arg(
            Arg::new("pid")
                .action(ArgAction::Set)
                .required(true)
                .num_args(1),
        )
        .arg(
            Arg::new("step")
                .action(ArgAction::Set)
                .required(true)
                .num_args(1),
        )
}

/// pristine_stepper [id] [js_stmt]
/// Steps a Pristine function by executing [js_stmt]. If no [id].state.json, or [id].snapshot.bin exist,
/// it assumes this is the function's first step, and it expects its source to be at [id].js.
/// [id].js is not evaluated after the first step.
#[tokio::main]
async fn main() -> Result<()> {
    let matches = cli().get_matches();
    let no_compile = matches.get_flag("no-compile");
    let pid = matches.get_one::<String>("pid").expect("pid");
    let step = matches.get_one::<String>("step").expect("step").to_owned();

    let mut engine = Engine::new(None);

    let res = engine.step_fs_process(pid, step, !no_compile).await;

    match res {
        Result::Ok(state) => {
            println!("state: {:?}", state);
        }
        Err(e) => {
            println!("error: {}", e);
        }
    }

    Ok(())
}
