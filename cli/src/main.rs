use anyhow::{Ok, Result};
use clap::{command, Parser, Subcommand};
use pristine_engine::{get_engine_runtime, pristine_compile, Engine};
use pristine_internal_api::ProcListOutput;
use std::{path::PathBuf, string::String};

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List running processes
    Ps {
        #[clap(short, long)]
        remote: Option<String>,
    },
    Compile {
        input: PathBuf,
        #[clap(short, long)]
        output: Option<PathBuf>,
    },
    Step {
        #[clap(short, long)]
        no_compile: bool,
        basepath: PathBuf,
        step_stmt: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match &cli.command {
        Commands::Ps { remote } => {
            let remote = remote
                .clone()
                .unwrap_or("http://localhost:5151".to_string());
            let resp = reqwest::get(remote + "/proc/")
                .await?
                .json::<ProcListOutput>()
                .await?;

            println!("{:?}", resp);

            Ok(())
        }
        Commands::Compile { input, output } => {
            let input_content = std::fs::read_to_string(input)?;
            let output_content = pristine_compile(input_content)?;
            match output {
                Some(output) => {
                    std::fs::write(output, output_content)?;
                }
                None => println!("{}", output_content),
            }
            Ok(())
        }
        Commands::Step {
            no_compile,
            basepath,
            step_stmt,
        } => {
            let mut engine = Engine::new(Some(get_engine_runtime));
            let basepath = basepath.clone().into_os_string().into_string().unwrap();
            let res = engine
                .step_fs_process(&basepath, step_stmt.clone(), !no_compile)
                .await;
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
    }
}
