mod handlers;

use actix_web::middleware::Logger;
use actix_web::{App, HttpServer};
use clap::{command, Parser};
use apeiro_engine::{get_engine_runtime, DEngine};
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use tracing::Level;

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
    _file: String,
) -> Result<Pool<SqliteConnectionManager>, anyhow::Error> {
    let manager = SqliteConnectionManager::memory();
    let pool = Pool::builder().build(manager)?;
    Ok(pool)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let subscriber = tracing_subscriber::FmtSubscriber::builder()
        .with_span_events(
            tracing_subscriber::fmt::format::FmtSpan::NEW
                | tracing_subscriber::fmt::format::FmtSpan::CLOSE,
        )
        .with_max_level(Level::TRACE)
        .with_env_filter("apeiro_engine=trace,apeirod=trace")
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    let cli = Cli::parse();
    let port = cli.port.unwrap_or(5151);
    let store = cli.store.unwrap_or("world.db".into());

    let (dengine, mut event_loop) = DEngine::new(
        Some(get_engine_runtime),
        Box::new(apeiro_engine::Db {
            pool: establish_db_connection(store)?,
        }),
    )?;

    tokio::task::spawn(async move {
        event_loop.run().await;
    });

    dengine.load_proc_subscriptions().await?;

    let dengine2 = dengine.clone();
    tokio::task::spawn(async move {
        loop {
            dengine2.tick().await.unwrap();
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }
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
            .service(handlers::proc_get_debug)
            .service(handlers::proc_send)
            .service(handlers::proc_watch)
            .service(handlers::proc_delete)
    })
    .bind(("127.0.0.1", port))?
    .run()
    .await?;

    Ok(())
}
