use std::{io::Error, net::SocketAddr};

use anyhow;
use apeiro_engine::{plugins::ApeiroPlugin, DEngine, ProcSendRequest};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use syslog::SyslogMsg;

mod syslog;

async fn udp_listen(port: u16, dengine: PrivateSender) -> Result<(), Error> {
    let addr = format!("0.0.0.0:{}", port).parse::<SocketAddr>().unwrap();
    let socket = tokio::net::UdpSocket::bind(&addr).await?;
    let mut buf = [0; 4096];

    loop {
        let (n, peer) = socket.recv_from(&mut buf).await?;
        match receive_udp(&dengine, &mut buf, n, peer).await {
            Ok(()) => continue,
            Err(e) => {
                eprintln!("IPv4 receive {}", e);
            }
        };
    }
}

// common receive routine
async fn receive_udp(
    dengine: &PrivateSender,
    buf: &mut [u8],
    len: usize,
    from: SocketAddr,
) -> Result<(), anyhow::Error> {
    if let Some(msg) = syslog::parse(from, len, buf) {
        println!("\n\n\n\n\n\n\n\n{:?}\n\n\n\n\n\n\n\n", msg);
        dengine.send(msg).await;
        Ok(())
    } else {
        match std::str::from_utf8(buf) {
            Ok(s) => Err(anyhow::anyhow!("error parsing: {}", s)),
            Err(e) => Err(anyhow::anyhow!(
                "received message not parseable and not UTF-8: {}",
                e
            )),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyslogPlugin {
    port: u16,
    to_pid: String,
}

struct PrivateSender {
    dengine: DEngine,
    to_pid: String,
}

impl PrivateSender {
    async fn send(&self, msg: SyslogMsg) {
        let dengine = self.dengine.clone();
        let msg = serde_json::to_value(msg).unwrap();
        let to_pid = self.to_pid.clone();
        dengine
            .proc_send(to_pid, None, ProcSendRequest { msg })
            .await
            .unwrap();
    }
}

#[typetag::serde]
#[async_trait]
impl ApeiroPlugin for SyslogPlugin {
    async fn init(&self, dengine: DEngine) -> Result<(), anyhow::Error> {
        let to_pid = self.to_pid.clone();
        let port = self.port;
        apeiro_engine::dengine::spawn(async move {
            println!("listening on UDP");
            udp_listen(port, PrivateSender { dengine, to_pid })
                .await
                .unwrap();
        });

        Ok(())
    }
}
