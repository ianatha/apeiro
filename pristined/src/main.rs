mod handlers;

use actix_web::middleware::Logger;
use actix_web::{App, HttpServer};
use clap::{command, Parser};
use env_logger::Env;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    #[clap(short, long)]
    port: Option<u16>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let cli = Cli::parse();
    let port = cli.port.unwrap_or(5151);

    env_logger::init_from_env(Env::default().default_filter_or("info"));

    println!("Starting HTTP daemon on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Logger::new("%a %{User-Agent}i"))
            .service(handlers::proc_list)
    })
    .bind(("127.0.0.1", port))
    .expect("failed to bind 127.0.0.1")
    .run()
    .await
}
