use anyhow::{Ok, Result};
use clap::{command, Parser, Subcommand};
use pristine_engine::{pristine_compile, StepResult};
use pristine_internal_api::{ProcListOutput, ProcNewOutput, ProcNewRequest, ProcSendRequest};
use std::{path::PathBuf, string::String};

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    #[clap(short, long)]
    remote: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List running processes
    Ps {},
    Get {
        pid: String,
    },
    Send {
        pid: String,
        message: String,
    },
    New {
        srcfile: PathBuf,
    },
    Compile {
        input: PathBuf,
        #[clap(short, long)]
        output: Option<PathBuf>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let remote = cli.remote.unwrap_or("http://localhost:5151".to_string());

    match &cli.command {
        Commands::Get { pid } => {
            let resp = reqwest::get(remote + "/proc/" + pid)
                .await?
                .json::<StepResult>()
                .await?;

            println!("{:?}", resp);

            Ok(())
        }
        Commands::Send { pid, message } => {
            let msg = serde_json::from_str(message)?;
            let client = reqwest::Client::new();
            let resp = client
                .put(remote + "/proc/" + pid)
                .json(&ProcSendRequest { msg })
                .send()
                .await?
                .json::<StepResult>()
                .await?;

            println!("{:?}", resp);

            Ok(())

        }
        Commands::New { srcfile } => {
            let src = std::fs::read_to_string(srcfile)?;
            let client = reqwest::Client::new();
            let resp = client
                .post(remote + "/proc/")
                .json(&ProcNewRequest { src })
                .send()
                .await?
                .json::<ProcNewOutput>()
                .await?;

            println!("{:?}", resp);

            Ok(())
        }
        Commands::Ps {} => {
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
    }
}
