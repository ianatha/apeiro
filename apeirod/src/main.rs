mod handlers;

use actix_web::middleware::Logger;
use actix_web::{App, HttpServer};
use apeiro_engine::plugins::PluginConfiguration;
use apeiro_engine::{get_engine_runtime, DEngine};
use clap::{command, Parser};
use fdb::database::FdbDatabase;
use fdb::subspace::Subspace;
use fdb::tuple::Tuple;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use tracing::Level;
// use tracing::instrument::WithSubscriber;

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

use fdb::range::{Range, RangeOptions};
use fdb::transaction::{ReadTransaction, Transaction};
use fdb::KeySelector;

async fn foundationdb_test() -> Result<(), Box<dyn std::error::Error>> {
    use bytes::Bytes;

    use tokio::runtime::Runtime;
    use tokio_stream::StreamExt;

    use std::env;
    use std::error::Error;

    let fdb_cluster_file = env::var("FDB_CLUSTER_FILE")
        .unwrap_or_else(|_| "/usr/local/etc/foundationdb/fdb.cluster".to_string());
    // .expect("FDB_CLUSTER_FILE not defined!");

    unsafe {
        fdb::select_api_version(fdb::FDB_API_VERSION as i32);
        fdb::start_network();
    }

    let fdb_database = fdb::open_database(fdb_cluster_file)?;

    // // Clear the database.
    // fdb_database
    //     .run(|tr| async move {
    //         tr.clear_range(Range::new(Bytes::new(), Bytes::from_static(b"\xFF")));

    //         Ok(())
    //     })
    //     .await?;

    // Set a few key values.
    fdb_database
        .run(|tr| async move {
            tr.set(Bytes::from("apple"), Bytes::from("foo"));
            tr.set(Bytes::from("cherry"), Bytes::from("baz"));
            tr.set(Bytes::from("banana"), Bytes::from("bar"));

            Ok(())
        })
        .await?;

    println!("non-snapshot range read");

    fdb_database
        .run(|tr| async move {
            let mut range_stream = tr.get_range(
                KeySelector::first_greater_or_equal(Bytes::new()),
                KeySelector::first_greater_or_equal(Bytes::from_static(b"\xFF")),
                RangeOptions::default(),
            );

            while let Some(x) = range_stream.next().await {
                let (key, value) = x?.into_parts();
                println!(
                    "{} is {}",
                    String::from_utf8_lossy(&Bytes::from(key)[..]),
                    String::from_utf8_lossy(&Bytes::from(value)[..])
                );
            }

            println!();

            let mut range_stream = Range::new(Bytes::new(), Bytes::from_static(b"\xFF"))
                .into_stream(&tr, RangeOptions::default());

            while let Some(x) = range_stream.next().await {
                let (key, value) = x?.into_parts();
                println!(
                    "{} is {}",
                    String::from_utf8_lossy(&Bytes::from(key)[..]),
                    String::from_utf8_lossy(&Bytes::from(value)[..])
                );
            }

            Ok(())
        })
        .await?;

    println!();
    println!("snapshot range read");

    fdb_database
        .read(|tr| async move {
            let mut range_stream = tr.get_range(
                KeySelector::first_greater_or_equal(Bytes::new()),
                KeySelector::first_greater_or_equal(Bytes::from_static(b"\xFF")),
                RangeOptions::default(),
            );

            while let Some(x) = range_stream.next().await {
                let (key, value) = x?.into_parts();
                println!(
                    "{} is {}",
                    String::from_utf8_lossy(&Bytes::from(key)[..]),
                    String::from_utf8_lossy(&Bytes::from(value)[..])
                );
            }

            println!();

            let mut range_stream = Range::new(Bytes::new(), Bytes::from_static(b"\xFF"))
                .into_stream(&tr, RangeOptions::default());

            while let Some(x) = range_stream.next().await {
                let (key, value) = x?.into_parts();
                println!(
                    "{} is {}",
                    String::from_utf8_lossy(&Bytes::from(key)[..]),
                    String::from_utf8_lossy(&Bytes::from(value)[..])
                );
            }

            Ok(())
        })
        .await?;

    drop(fdb_database);

    unsafe {
        fdb::stop_network();
    }

    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    foundationdb_test().await.unwrap();
    panic!();
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
        Box::new(apeiro_engine::db_sqlite::Db {
            pool: establish_db_connection(store)?,
        }),
    )?;

    tokio::task::spawn(async move {
        event_loop.run().await;
    });

    if cli.swarm {
        let p2pchan = apeiro_engine::p2prpc::start_p2p(dengine.clone(), cli.swarm_peer_addr)
            .await
            .unwrap();
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

    // let allowed_origin = cli
    //     .allowed_origin
    //     .unwrap_or("http://localhost:3000".to_string());

    HttpServer::new(move || {
        use actix_cors::Cors;
        use actix_web::http;

        let cors = Cors::default()
            // .allowed_origin(allowed_origin.as_str())
            .allowed_origin_fn(|_origin, _req_head| true)
            .allowed_methods(vec!["GET", "POST", "PUT"])
            .allowed_headers(vec![
                "apeiro-wait",
                http::header::AUTHORIZATION.as_str(),
                http::header::ACCEPT.as_str(),
            ])
            .allowed_header(http::header::CONTENT_TYPE)
            .max_age(3600);

        let json_cfg = actix_web::web::JsonConfig::default().error_handler(|err, _req| {
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
            .service(handlers::stats)
    })
    .bind((listen_addr, port))?
    .run()
    .await?;

    Ok(())
}
