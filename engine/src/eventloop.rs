use anyhow::{Result};
use apeiro_internal_api::ProcSendRequest;
use tokio::sync::mpsc;
use tracing::{Level, event, instrument};

use crate::DEngine;
use crate::dengine::{DEngineCmd, ProcEvent, DEngineCmdSend, PluginStorage, DEngineStorage};

pub struct EventLoop {
    pub dengine: DEngine,
    pub(crate) tx: mpsc::Sender<DEngineCmd>,
    pub(crate) rx: mpsc::Receiver<DEngineCmd>,
}

trait PluginInstance {
    fn pid(&self) -> String;
    fn receive(&self, dengine: DEngine, storage: Box<dyn PluginStorage>, msg: serde_json::Value) -> Result<()>;
    fn tick(&self, dengine: DEngine, storage: Box<dyn PluginStorage>) -> Result<()>;
}

struct ClockProcessor {
    
}

pub fn now_as_millis() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    start
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_millis() as u64
}

impl PluginInstance for ClockProcessor {
    fn tick(&self, dengine: DEngine, storage: Box<dyn PluginStorage>) -> Result<()> {
        let now = now_as_millis();
        let default_val: serde_json::Value = serde_json::to_value::<Vec<serde_json::Value>>(vec![]).unwrap();
        let state = storage.get().unwrap_or(default_val);
        let mut state = state.as_array().unwrap().clone();
        let state: Vec<serde_json::Value> = state.iter_mut().filter_map(|subscription| {
            let obj_subscription = subscription.as_object().unwrap();
            let target_proc_id = obj_subscription["target_pid"].as_str().unwrap();
            let target_proc_id = target_proc_id.to_string().clone();
            let time = obj_subscription["time"].as_u64().unwrap();
            if time > now {
                Some(subscription.clone())
            } else {
                event!(Level::TRACE, "sending tick to {}, now = {}", target_proc_id, now);
            
                let dengine = dengine.clone();
                tokio::task::spawn(async move {
                    dengine.proc_send(target_proc_id, None, ProcSendRequest {
                        msg: serde_json::json!({
                            "type": "$tick",
                            "tick": now,
                        }),
                    }).await.unwrap();
                });
                None
            }
        }).collect();
        storage.set(serde_json::to_value(state).unwrap()).unwrap();
        Ok(())
    }

    fn pid(&self) -> String {
        "clock".to_string()
    }

    fn receive(&self, dengine: DEngine, storage: Box<dyn PluginStorage>, msg: serde_json::Value) -> Result<()> {
        let msg_val = msg;
        let target_proc_id = msg_val["sender"].as_str().unwrap();
        let wait_time = msg_val["wait"].as_u64().unwrap();

        let default_val: serde_json::Value = serde_json::to_value::<Vec<serde_json::Value>>(vec![]).unwrap();
        let mut state = storage.get().unwrap_or(default_val);
        let mut state = state.as_array_mut().unwrap();
        state.push(serde_json::json!({
            "target_pid": target_proc_id,
            "time": now_as_millis() + wait_time,
        }));
        storage.set(serde_json::to_value(state).unwrap()).unwrap();

        Ok(())
    }
}

fn special_pid_processor(pid: &str) -> Option<Box<dyn PluginInstance>> {
    if pid == "clock" {
        Some(Box::new(ClockProcessor{}))
    } else {
        None
    }
}

impl EventLoop {
    #[instrument(name = "event_loop", skip(self))]
    pub async fn run(&mut self) {
        while let Some(message) = self.rx.recv().await {
            if message != DEngineCmd::Tick {
                event!(Level::TRACE, msg = ?message);
            }
            match message {
                DEngineCmd::Tick => {
                    {
                        let clock_plugin = ClockProcessor {};
                        let dengine = self.dengine.clone();
                        let storage = DEngineStorage {
                            dengine: self.dengine.clone(),
                            plugin_id: "clock".into(),
                        };
                        clock_plugin.tick(dengine, Box::new(storage)).unwrap();
                    }
                    let dengine = self.dengine.clone();
                    let subscriptions = dengine.get_all_subscriptions().await;
                    for (proc_id, subscription) in subscriptions {
                        if let Some(subscription) = subscription.as_object() {
                            if let Some(serde_json::Value::Number(time)) = subscription.get("$time")
                            {
                                let time = time.as_u64().unwrap();
                                match std::time::SystemTime::now()
                                    .duration_since(std::time::SystemTime::UNIX_EPOCH)
                                {
                                    Result::Ok(n) => {
                                        if n.as_millis() >= time.into() {
                                            println!("triggering {} because {}", proc_id, time);
                                        }
                                    }
                                    Err(_) => panic!("SystemTime before UNIX EPOCH!"),
                                }
                            }
                        }
                    }
                    // TODO
                }
                DEngineCmd::Broadcast(proc_id, exec_id, msg) => {
                    let dengine = self.dengine.clone();
                    dengine.send_to_watchers(&proc_id, &msg).await.unwrap();
                    dengine
                        .send_to_exec_watchers(&proc_id, &exec_id, &msg)
                        .await
                        .unwrap();
                }
                DEngineCmd::Send(cmd) => {
                    let dengine = self.dengine.clone();
                    let tx = self.tx.clone();
                    println!("\n\n\n\n\nsending to: {}\n\n\n\n\n\n", cmd.proc_id);
                    match special_pid_processor(&cmd.proc_id) {
                        Some(processor) => {
                            let plugin_storage = DEngineStorage {
                                dengine: dengine.clone(),
                                plugin_id: cmd.proc_id.clone(),
                            };
                            processor.receive(dengine, Box::new(plugin_storage), cmd.req.msg).unwrap();
                        }
                        _ => {
                            tokio::task::spawn(async move {
                                let res = dengine.inner_proc_send(&cmd.proc_id, &cmd.req).await;
                                match res {
                                    Err(err) => {
                                        tx.send(DEngineCmd::Broadcast(
                                            cmd.proc_id.clone(),
                                            cmd.step_id.clone(),
                                            ProcEvent::Error(err.to_string().clone()),
                                        ))
                                        .await
                                        .unwrap();
                                    }
                                    Result::Ok(res) => {
                                        tx.send(DEngineCmd::Broadcast(
                                            cmd.proc_id.clone(),
                                            cmd.step_id.clone(),
                                            ProcEvent::StepResult(res),
                                        ))
                                        .await
                                        .unwrap();
                                    }
                                }
                            });
                        }
                    }
                }
                DEngineCmd::Log((proc_id, _, msg)) => {
                    let dengine = self.dengine.clone();
                    event!(Level::INFO, "log: {}: {:?}", proc_id, msg);
                    tokio::task::spawn(async move {
                        dengine
                            .send_to_watchers(&proc_id, &ProcEvent::Log(msg))
                            .await
                            .unwrap();
                    });
                }
            }
        }
    }
}
