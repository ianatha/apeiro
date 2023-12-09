mod cmds;

use anyhow::{Ok, Result};
use clap::{command, Parser, Subcommand};
use cmds::*;

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
    Web {

    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let remote = cli.remote.unwrap_or("http://localhost:5151".to_string());

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
        Commands::Ps {} => ps(remote, cli.output_json).await,
        Commands::Modules {} => modules_list(remote).await,
        Commands::Module { srcfile } => module_new(remote, srcfile).await,
        Commands::Web {} => {
            println!("Listening on 127.0.0.1:3030");
            apeiro_frontend_rs::web(([127, 0, 0, 1], 3030)).await;
            Ok(())
        }
    }
}
