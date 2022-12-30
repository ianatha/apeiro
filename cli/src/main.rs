use anyhow::{Ok, Result};
use clap::{command, Parser, Subcommand};
use cli_table::format::VerticalLine;
use futures::stream::StreamExt;
use pristine_engine::{pristine_compile, StepResult};
use pristine_internal_api::{
    PristineError, ProcListOutput, ProcNewOutput, ProcNewRequest, ProcSendRequest, ProcStatus,
    ProcStatusDebug,
};
use reqwest::Response;
use reqwest_eventsource::{Event, EventSource};

use std::{path::PathBuf, string::String};

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    /// defaults to http://localhost:5151
    #[clap(short, long)]
    remote: Option<String>,

    /// output in JSON format (only supported by get)
    #[clap(short('j'), long)]
    output_json: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List running processes
    Ps {},
    /// Get process status
    Get {
        pid: String,
        #[clap(short, long)]
        value: bool,
    },
    /// Get compiled source code of a process
    Inspect { pid: String },
    /// Send message to process
    Send { pid: String, message: String },
    /// Start a new process
    New {
        srcfile: PathBuf,
        #[clap(short, long)]
        name: Option<String>,
    },
    /// Stream process events and logs
    Watch { pid: String },
    /// Compile a source file into Pristine VM
    Compile {
        input: PathBuf,
        #[clap(short, long)]
        output: Option<PathBuf>,
    },
}

async fn result_or_error<T>(r: Response) -> Result<T, PristineError>
where
    T: serde::de::DeserializeOwned,
{
    if r.status().is_success() {
        Result::<T, PristineError>::Ok(r.json::<T>().await.unwrap())
    } else {
        r.json::<Result<T, PristineError>>().await.unwrap()
    }
}

async fn watch(remote: &String, pid: &String) -> Result<()> {
    let url = format!("{}/proc/{}/watch", remote, pid);
    let mut es = EventSource::get(url);
    while let Some(event) = es.next().await {
        match event {
            Result::Ok(Event::Open) => println!("Connection Open!"),
            Result::Ok(Event::Message(message)) => println!("Message: {:#?}", message),
            Result::Err(err) => {
                println!("Error: {}", err);
                es.close();
            }
        }
    }
    Ok(())
}

async fn get(remote: &String, pid: &String, value: &bool, output_json: bool) -> Result<()> {
    let resp = reqwest::get(remote.clone() + "/proc/" + pid)
        .await?
        .json::<ProcStatus>()
        .await?;

    if *value {
        println!("{}", resp.val.unwrap_or("null".into()));
        return Ok(());
    }

    if output_json {
        let j = serde_json::to_string(&resp)?;
        println!("{}", j);
    } else {
        println!("{:?}", resp);
    }

    Ok(())
}
async fn inspect(remote: String, pid: &String) -> Result<()> {
    let resp = reqwest::get(remote + "/proc/" + pid + "/debug")
        .await?
        .json::<ProcStatusDebug>()
        .await?;

    println!("{}", resp.compiled_src);

    Ok(())
}

async fn send(remote: String, pid: &String, message: &String) -> Result<()> {
    let msg = serde_json::from_str(message)?;
    let client = reqwest::Client::new();
    let resp = client
        .put(remote + "/proc/" + pid)
        .json(&ProcSendRequest { msg })
        .send()
        .await?;

    let resp = result_or_error::<StepResult>(resp).await;

    println!("{:?}", resp);

    Ok(())
}

async fn new(remote: String, srcfile: &PathBuf, name: &Option<String>) -> Result<()> {
    let src = std::fs::read_to_string(srcfile)?;
    let client = reqwest::Client::new();
    let resp = client
        .post(remote + "/proc/")
        .json(&ProcNewRequest {
            src,
            name: name.clone(),
        })
        .send()
        .await?;

    let resp = result_or_error::<ProcNewOutput>(resp).await;

    println!("{:?}", resp);

    Ok(())
}

async fn ps(remote: String, output_json: bool) -> Result<()> {
    use cli_table::{format::Justify, Cell, Style, Table};

    let resp = reqwest::get(remote + "/proc/")
        .await?
        .json::<ProcListOutput>()
        .await?;

    let empty_border = cli_table::format::Border::builder().build();

    let table = resp
        .procs
        .iter()
        .map(|p| {
            vec![
                p.id.clone().cell(),
                p.name.clone().unwrap_or("".into()).cell(),
                p.status.clone().cell(),
                match p.suspension.clone() {
                    Some(s) => truncate(&s.to_string(), 64).to_string(),
                    None => "".to_string(),
                }
                .cell(),
            ]
        })
        .table()
        .title(vec![
            "pid".cell().bold(true).justify(Justify::Center),
            "name".cell().bold(true),
            "status".cell().bold(true),
            "suspension".cell().bold(true),
        ])
        .border(empty_border)
        .separator(
            cli_table::format::Separator::builder()
                .column(Some(VerticalLine::default()))
                .build(),
        );

    cli_table::print_stdout(table)?;

    // println!("{:?}", resp);

    Ok(())
}

async fn compile(input: &PathBuf, output: &Option<PathBuf>) -> Result<()> {
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

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let remote = cli.remote.unwrap_or("http://localhost:5151".to_string());

    match &cli.command {
        Commands::Watch { pid } => watch(&remote, pid).await,
        Commands::Get { pid, value } => get(&remote, pid, value, cli.output_json).await,
        Commands::Inspect { pid } => inspect(remote, pid).await,
        Commands::Send { pid, message } => send(remote, pid, message).await,
        Commands::New { srcfile, name } => new(remote, srcfile, name).await,
        Commands::Ps {} => ps(remote, cli.output_json).await,
        Commands::Compile { input, output } => compile(input, output).await,
    }
}

fn truncate(s: &str, max_chars: usize) -> &str {
    match s.char_indices().nth(max_chars) {
        None => s,
        Some((idx, _)) => &s[..idx],
    }
}
