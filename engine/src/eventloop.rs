use anyhow::{Result};
use tokio::sync::mpsc;
use tracing::{Level, event, instrument};

use crate::DEngine;
use crate::dengine::{DEngineCmd, ProcEvent};

pub struct EventLoop {
    pub dengine: DEngine,
    pub(crate) tx: mpsc::Sender<DEngineCmd>,
    pub(crate) rx: mpsc::Receiver<DEngineCmd>,
}

impl EventLoop {
    #[instrument(name = "event_loop", skip(self))]
    pub async fn run(&mut self) {
        while let Some(message) = self.rx.recv().await {
            event!(Level::TRACE, msg = ?message);
            match message {
                DEngineCmd::Tick => {
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
