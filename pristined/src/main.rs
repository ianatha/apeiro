mod db;
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

    #[clap(short, long)]
    store: Option<String>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let cli = Cli::parse();
    let port = cli.port.unwrap_or(5151);
    let store = cli.store.unwrap_or("world.db".into());

    let conn_pool = db::establish_connection(store).unwrap();
    db::init_db(&conn_pool).expect("DB initialization failed");

    env_logger::init_from_env(Env::default().default_filter_or("info"));

    println!("Starting HTTP daemon on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Logger::new("%a %{User-Agent}i"))
            .app_data(actix_web::web::Data::new(conn_pool.clone()))
            .service(handlers::proc_new)
            .service(handlers::proc_list)
            .service(handlers::proc_get)
    })
    .bind(("127.0.0.1", port))
    .expect("failed to bind 127.0.0.1")
    .run()
    .await
}
