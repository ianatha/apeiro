use anyhow::{Ok, Result};
use apeiro_internal_api::{
    ApeiroError, MountNewRequest, MountSummary, ProcListOutput, ProcNewOutput, ProcNewRequest,
    ProcSendRequest, ProcStatus, ProcStatusDebug, StepResult, StepResultStatus,
};
use clap::{command, Parser, Subcommand};
use cli_table::format::VerticalLine;
use futures::stream::StreamExt;
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
        proc_id: String,
        #[clap(short, long)]
        value: bool,
    },
    Cleanup {},
    Rm {
        proc_ids: Vec<String>,
    },
    /// Get compiled source code of a process
    Inspect {
        proc_id: String,
    },
    /// Send message to process
    Send {
        proc_id: String,
        message: String,
    },
    /// New mount
    Mount {
        srcfile: PathBuf,
    },
    /// List mounts
    Mounts {},
    /// Start a new process
    New {
        #[clap(short, long)]
        mount: Option<String>,
        #[clap(short, long)]
        src: Option<PathBuf>,
        #[clap(short, long)]
        name: Option<String>,
    },
    /// Stream process events and logs
    Watch {
        proc_id: String,
    },
}

async fn result_or_error<T>(r: Response) -> Result<T, ApeiroError>
where
    T: serde::de::DeserializeOwned,
{
    if r.status().is_success() {
        Result::<T, ApeiroError>::Ok(r.json::<T>().await.unwrap())
    } else {
        r.json::<Result<T, ApeiroError>>().await.unwrap()
    }
}

async fn watch(remote: &String, proc_id: &String) -> Result<()> {
    let url = format!("{}/proc/{}/watch", remote, proc_id);
    let mut es = EventSource::get(url);
    while let Some(event) = es.next().await {
        match event {
            Result::Ok(Event::Open) => println!("Connection Open!"),
            Result::Ok(Event::Message(message)) => {
                // let msg = serde_json::from_str(message.data.as_str()).unwrap();
                println!("{}", message.data);
            }
            Result::Err(err) => {
                println!("Error: {}", err);
                es.close();
            }
        }
        println!("")
    }
    Ok(())
}

async fn get(remote: &String, proc_id: &String, value: &bool, output_json: bool) -> Result<()> {
    let resp = reqwest::get(remote.clone() + "/proc/" + proc_id)
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

async fn api_rm(remote: String, proc_id: &String) -> Result<()> {
    let client = reqwest::Client::new();
    client
        .delete(remote + "/proc/" + proc_id)
        .send()
        .await?
        .error_for_status()?;

    Ok(())
}

async fn rm(remote: String, proc_id: &String) -> Result<()> {
    api_rm(remote.clone(), proc_id).await?;
    println!("Deleted {:?}.", proc_id);

    Ok(())
}

async fn cleanup(remote: String) -> Result<()> {
    let resp = reqwest::get(remote.clone() + "/proc/")
        .await?
        .json::<ProcListOutput>()
        .await?;

    let mut deleted = 0;
    for proc in resp.procs {
        if proc.status == StepResultStatus::CRASHED {
            api_rm(remote.clone(), &proc.id).await?;
            deleted = deleted + 1;
        }
    }

    println!("deleted {} crashed processes", deleted);

    Ok(())
}

async fn inspect(remote: String, proc_id: &String) -> Result<()> {
    let resp = reqwest::get(remote + "/proc/" + proc_id + "/debug")
        .await?
        .json::<ProcStatusDebug>()
        .await?;

    let funcs = serde_json::to_string_pretty(&resp.funcs).unwrap();
    let frames = serde_json::to_string_pretty(&resp.frames).unwrap();
    println!(
        "{}\n======\n{}\n=====\n{}",
        funcs, frames, resp.compiled_src
    );

    Ok(())
}

async fn send(remote: String, proc_id: &String, message: &String) -> Result<()> {
    let msg = serde_json::from_str(message)?;
    let client = reqwest::Client::new();
    let resp = client
        .put(remote + "/proc/" + proc_id)
        .json(&ProcSendRequest { msg })
        .send()
        .await?;

    let resp = result_or_error::<StepResult>(resp).await;

    match resp {
        Result::Ok(resp) => println!("{}", resp),
        Err(e) => println!("error: {:?}", e),
    }

    Ok(())
}

async fn new(remote: String, mount_id: &String, name: &Option<String>) -> Result<()> {
    let client = reqwest::Client::new();
    let resp = client
        .post(remote + "/proc/")
        .json(&ProcNewRequest {
            mount_id: mount_id.clone(),
            name: name.clone(),
        })
        .send()
        .await?;

    let resp = result_or_error::<ProcNewOutput>(resp).await;

    println!("{:?}", resp);

    Ok(())
}

use anyhow::anyhow;

async fn ps(remote: awc::Client, _output_json: bool) -> Result<()> {
    use cli_table::{format::Justify, Cell, Style, Table};

    let resp = remote.get("http://localhost:5151/proc/").send()
        .await
        .map_err(|e| anyhow!(e.to_string()))?
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
                format!("{:.3} KB", (p.snapshot_size as f32 / 1024.0)).cell(),
                format!("{:.3} KB", (p.snapshot_v2_size as f32 / 1024.0)).cell(),
            ]
        })
        .table()
        .title(vec![
            "proc_id".cell().bold(true).justify(Justify::Center),
            "name".cell().bold(true),
            "status".cell().bold(true),
            "suspension".cell().bold(true),
            "snapshot size".cell().bold(true),
            "snapshot v2 size".cell().bold(true),
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

async fn mounts_list(remote: String) -> Result<()> {
    let resp = reqwest::get(remote + "/mount/")
        .await?
        .json::<Vec<MountSummary>>()
        .await?;

    println!("{:?}", resp);

    Ok(())
}

async fn mount_new_inner(remote: String, srcfile: &PathBuf) -> Result<String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(remote + "/mount/")
        .json(&MountNewRequest {
            src: std::fs::read_to_string(srcfile)?,
        })
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    let res = resp
        .as_object()
        .unwrap()
        .get("mid")
        .unwrap()
        .as_str()
        .unwrap()
        .to_string();

    Ok(res)
}

async fn mount_new(remote: String, srcfile: &PathBuf) -> Result<()> {
    let resp = mount_new_inner(remote, srcfile).await?;

    println!("{:?}", resp);

    Ok(())
}

#[actix_rt::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let remote = cli.remote.unwrap_or("http://localhost:5151".to_string());

    let connector = awc::Connector::new().connector(awc_uds::UdsConnector::new("/tmp/apeirod.socket"));
    let mut client = awc::ClientBuilder::new().connector(connector).finish();

    match &cli.command {
        Commands::Cleanup {} => cleanup(remote).await,
        Commands::Rm { proc_ids } => {
            for proc_id in proc_ids {
                rm(remote.clone(), proc_id).await?
            }
            Ok(())
        }
        Commands::Watch { proc_id } => watch(&remote, proc_id).await,
        Commands::Get { proc_id, value } => get(&remote, proc_id, value, cli.output_json).await,
        Commands::Inspect { proc_id } => inspect(remote, proc_id).await,
        Commands::Send { proc_id, message } => send(remote, proc_id, message).await,
        Commands::New { src, mount, name } => {
            if let Some(src) = src {
                let mount_id = mount_new_inner(remote.clone(), src).await?;
                new(remote, &mount_id, name).await
            } else if let Some(mount_id) = mount {
                new(remote, mount_id, name).await
            } else {
                Err(anyhow::anyhow!("either --src or --mount must be specified"))
            }
        }
        Commands::Ps {} => ps(client, cli.output_json).await,
        Commands::Mounts {} => mounts_list(remote).await,
        Commands::Mount { srcfile } => mount_new(remote, srcfile).await,
    }
}

fn truncate(s: &str, max_chars: usize) -> &str {
    match s.char_indices().nth(max_chars) {
        None => s,
        Some((idx, _)) => &s[..idx],
    }
}
