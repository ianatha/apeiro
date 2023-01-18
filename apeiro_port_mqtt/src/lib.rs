use std::time::Duration;

use apeiro_engine::plugins::ApeiroPlugin;
use apeiro_engine::DEngine;
use apeiro_engine::ProcSendRequest;

use anyhow;
use async_trait::async_trait;
use rumqttc::{AsyncClient, Event, Incoming, MqttOptions, QoS};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MqttPlugin {
    host: String,
    port: u16,
    keep_alive: Option<Duration>,
    subscriptions: Vec<String>,
    to_pid: String,
}

async fn rcvd_notification(
    dengine: &DEngine,
    notification: Event,
    to_pid: &String,
) -> Result<(), anyhow::Error> {
    match notification {
        Event::Incoming(msg) => match msg {
            Incoming::Publish(p) => {
                let payload = std::str::from_utf8(&p.payload)?;
                if let Ok(payload_json) = serde_json::from_str::<serde_json::Value>(payload) {
                    dengine
                        .proc_send(to_pid.clone(), None, ProcSendRequest { msg: payload_json })
                        .await
                        .unwrap();
                }
            }
            _ => {
                println!("MQTT Received = {:?}", msg);
            }
        },
        _ => {}
    };
    Ok(())
}

#[typetag::serde]
#[async_trait]
impl ApeiroPlugin for MqttPlugin {
    async fn init(&self, dengine: DEngine) -> Result<(), anyhow::Error> {
        let mut mqttoptions = MqttOptions::new("rumqtt-async", self.host.clone(), self.port);
        mqttoptions.set_keep_alive(self.keep_alive.unwrap_or(Duration::from_secs(5)));

        let (client, mut eventloop) = AsyncClient::new(mqttoptions, 10);
        for topic in &self.subscriptions {
            client.subscribe(topic, QoS::AtMostOnce).await.unwrap();
        }

        let to_pid = self.to_pid.clone();
        apeiro_engine::dengine::spawn(async move {
            while let Ok(notification) = eventloop.poll().await {
                rcvd_notification(&dengine, notification, &to_pid)
                    .await
                    .unwrap();
            }
        });

        Ok(())
    }
}
