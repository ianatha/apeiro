mod handlers;

use std::time::Duration;

use actix_web::middleware::Logger;
use actix_web::{App, HttpServer};
use apeiro_engine::plugins::PluginConfiguration;
use apeiro_engine::{get_engine_runtime, DEngine};
use clap::{command, Parser};
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use tracing::Level;
use tracing::instrument::WithSubscriber;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    #[clap(short, long)]
    listen: Option<String>,

    #[clap(short, long)]
    port: Option<u16>,

    #[clap(short, long)]
    store: Option<String>,

    #[clap(long)]
    swarm: bool,

    #[clap(long)]
    swarm_mdns: bool,

    #[clap(long)]
    swarm_peer_addr: Vec<String>,

    #[clap(long)]
    allowed_origin: Option<String>,
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
    // console_subscriber::ConsoleLayer::builder()
    //     .retention(Duration::from_secs(120))
    //     .init();

    println!("Starting Apeiro Daemon");

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

    let (mut dengine, mut event_loop) = DEngine::new(
        Some(get_engine_runtime),
        Box::new(apeiro_engine::Db {
            pool: establish_db_connection(store)?,
        }),
    )?;

    tokio::task::spawn(async move {
        event_loop.run().await;
    });

    if cli.swarm {
        let p2pchan = apeiro_engine::p2prpc::start_p2p(dengine.clone(), cli.swarm_peer_addr).await.unwrap();
        dengine.set_p2p_channel(p2pchan).await;
    }

    dengine.load_proc_subscriptions().await?;

    if let Ok(plugins_json_contents) = std::fs::read_to_string("./plugins.json") {
        // #[allow(unused_imports)]
        // use apeiro_port_mqtt::MqttPlugin;
        #[allow(unused_imports)]
        use apeiro_port_syslog::SyslogPlugin;

        let plugin_conf: PluginConfiguration =
            serde_json::from_str(plugins_json_contents.as_str())?;
        for plugin in plugin_conf.plugins {
            plugin.init(dengine.clone()).await?;
        }
    }

    {
        let dengine = dengine.clone();
        tokio::task::spawn(async move {
            loop {
                dengine.tick().await.unwrap();
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        });
    }

    let listen_addr = cli.listen.unwrap_or("127.0.0.1".to_string());
    println!("Starting HTTP daemon on port {}:{}", listen_addr, port);
    let allowed_origin = cli
        .allowed_origin
        .unwrap_or("http://localhost:3000".to_string());

    HttpServer::new(move || {
        use actix_cors::Cors;
        use actix_web::http;

        let cors = Cors::default()
            // .allowed_origin(allowed_origin.as_str())
            .allowed_origin_fn(|origin, _req_head| {
                true
            })
            .allowed_methods(vec!["GET", "POST", "PUT"])
            .allowed_headers(vec![
                "apeiro-wait",
                http::header::AUTHORIZATION.as_str(),
                http::header::ACCEPT.as_str(),
            ])
            .allowed_header(http::header::CONTENT_TYPE)
            .max_age(3600);

            let json_cfg = actix_web::web::JsonConfig::default()
    .error_handler(|err, req| {
        handlers::ApeiroError::new(anyhow::anyhow!("Error parsing JSON: {:?}", err)).into()
    });

        App::new()
            .wrap(Logger::default())
            .wrap(Logger::new("%a %{User-Agent}i"))
            .wrap(cors)
            .app_data(actix_web::web::Data::new(dengine.clone()))
            .app_data(json_cfg)
            .service(handlers::proc_new)
            .service(handlers::proc_list)
            .service(handlers::proc_get)
            .service(handlers::proc_get_debug)
            .service(handlers::proc_send)
            .service(handlers::proc_post_send)
            .service(handlers::proc_watch)
            .service(handlers::proc_delete)
            .service(handlers::mount_new)
            .service(handlers::mount_list)
            .service(handlers::mount_get)
            .service(handlers::mount_edit)
            .service(handlers::helper_extract_export_name)
    })
    .bind((listen_addr, port))?
    .run()
    .await?;

    Ok(())
}
