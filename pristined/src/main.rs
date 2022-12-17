mod handlers;

use actix_web::middleware::Logger;
use actix_web::{App, HttpServer};
use clap::{command, Parser};
use env_logger::Env;
use pristine_engine::{get_engine_runtime, DEngine};
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    #[clap(short, long)]
    port: Option<u16>,

    #[clap(short, long)]
    store: Option<String>,
}

#[cfg(not(test))]
pub fn establish_db_connection(
    file: String,
) -> Result<Pool<SqliteConnectionManager>, anyhow::Error> {
    let manager = SqliteConnectionManager::file(file);
    let pool = Pool::builder().build(manager)?;
    Ok(pool)
}

#[cfg(test)]
pub fn establish_db_connection(
    file: String,
) -> Result<Pool<SqliteConnectionManager>, anyhow::Error> {
    let manager = SqliteConnectionManager::memory();
    let pool = Pool::builder().build(manager)?;
    Ok(pool)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    console_subscriber::init();

    let cli = Cli::parse();
    let port = cli.port.unwrap_or(5151);
    let store = cli.store.unwrap_or("world.db".into());

    let conn_pool = establish_db_connection(store)?;
    let (dengine, mut event_loop) = DEngine::new(Some(get_engine_runtime), conn_pool)?;

    env_logger::init_from_env(Env::default().default_filter_or("info,swc_ecma_codegen=off"));

    tokio::task::spawn(async move {
        event_loop.run().await;
    });

    println!("Starting HTTP daemon on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Logger::new("%a %{User-Agent}i"))
            .app_data(actix_web::web::Data::new(dengine.clone()))
            .service(handlers::proc_new)
            .service(handlers::proc_list)
            .service(handlers::proc_get)
            .service(handlers::proc_send)
            .service(handlers::proc_watch)
    })
    .bind(("127.0.0.1", port))?
    .run()
    .await?;

    Ok(())
}
