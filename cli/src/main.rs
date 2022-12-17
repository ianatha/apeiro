use anyhow::{Ok, Result};
use clap::{command, Parser, Subcommand};
use cli_table::format::VerticalLine;
use pristine_engine::{pristine_compile, StepResult};
use pristine_internal_api::{
    ProcListOutput, ProcNewOutput, ProcNewRequest, ProcSendRequest, ProcStatus,
};
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
                .json::<ProcStatus>()
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
            use cli_table::{format::Justify, Cell, Style, Table};

            let resp = reqwest::get(remote + "/proc/")
                .await?
                .json::<ProcListOutput>()
                .await?;

                let empty_border = cli_table::format::Border::builder().build();

            let table = resp.procs.iter().map(|p| {
                vec![
                    p.id.clone().cell(),
                    p.status.clone().cell(),
                    match p.suspension.clone() {
                        Some(s) => truncate(&s.to_string(), 64).to_string(),
                        None => "".to_string(),
                    }.cell(),
                ]
            })
            .table()
            .title(vec![
                "pid".cell().bold(true).justify(Justify::Center),
                "status".cell().bold(true),
                "suspension".cell().bold(true),
            ])
            .border(empty_border)
            .separator(cli_table::format::Separator::builder().column(Some(VerticalLine::default())).build());

            cli_table::print_stdout(table)?;

            // println!("{:?}", resp);

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

fn truncate(s: &str, max_chars: usize) -> &str {
    match s.char_indices().nth(max_chars) {
        None => s,
        Some((idx, _)) => &s[..idx],
    }
}
