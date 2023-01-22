use anyhow::{anyhow, Ok, Result};
use apeiro_compiler::apeiro_compile;
use apeiro_compiler::extract_export_name;
use apeiro_internal_api::MountNewRequest;
use apeiro_internal_api::MountSummary;
use apeiro_internal_api::ProcListOutput;
use apeiro_internal_api::ProcNewOutput;
use apeiro_internal_api::ProcNewRequest;
use apeiro_internal_api::ProcSendRequest;
use apeiro_internal_api::ProcStatus;
use apeiro_internal_api::ProcStatusDebug;
use apeiro_internal_api::StepResult;
use apeiro_internal_api::StepResultStatus;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tokio::sync::mpsc;
use tokio::sync::RwLock;
use tracing::trace;

use std::borrow::BorrowMut;
use std::cell::RefCell;
use std::collections::HashMap;
use std::ops::DerefMut;
use std::string::String;
use std::sync::Arc;

pub struct DEngine(Arc<SharedDEngine>);

/// Returns a new `DEngine` referencing the same state as `self`.
impl Clone for DEngine {
    fn clone(&self) -> DEngine {
        DEngine(self.0.clone())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DEngineCmdSend {
    pub proc_id: String,
    pub step_id: String,
    pub req: ProcSendRequest,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum DEngineCmd {
    Broadcast(String, String, ProcEvent),
    Send(DEngineCmdSend),
    Log((String, String, serde_json::Value)),
    Tick,
}

#[derive(Debug, Clone, Serialize, Deserialize, Eq, PartialEq)]
pub enum ProcEvent {
    Error(String),
    Log(serde_json::Value),
    StepResult(StepResult),
    None,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct RemoteDEngineCmd {
    pub peer_id: String,
    pub cmd: crate::dengine::DEngineCmd,
}

#[derive(Debug)]
struct SharedDEngine {
    p2p_channel: RwLock<Option<tokio::sync::mpsc::Sender<RemoteDEngineCmd>>>,
    runtime_js_src: Option<fn() -> String>,
    db: Box<dyn ApeiroEnginePersistence>,
    locks: Arc<RwLock<HashMap<String, Arc<RwLock<()>>>>>,
    tx: mpsc::Sender<DEngineCmd>,
    watchers: Arc<RwLock<HashMap<String, tokio::sync::watch::Sender<ProcEvent>>>>,
    watchers_exec: Arc<RwLock<HashMap<(String, String), tokio::sync::watch::Sender<ProcEvent>>>>,
    proc_subscriptions: Arc<RwLock<HashMap<String, Vec<serde_json::Value>>>>,
}

use tracing::{event, instrument, Level};

use crate::db::ApeiroEnginePersistence;
use crate::eventloop::now_as_millis;
use crate::eventloop::EventLoop;

pub trait PluginStorage {
    fn get(&self) -> Result<serde_json::Value, anyhow::Error>;
    fn set(&self, val: serde_json::Value) -> Result<(), anyhow::Error>;
}

pub struct DEngineStorage {
    pub dengine: DEngine,
    pub plugin_id: String,
}

impl PluginStorage for DEngineStorage {
    fn get(&self) -> Result<serde_json::Value, anyhow::Error> {
        self.dengine.0.db.plugin_get_state(&self.plugin_id)
    }

    fn set(&self, val: serde_json::Value) -> Result<(), anyhow::Error> {
        self.dengine.0.db.plugin_set_state(&self.plugin_id, &val)
    }
}

pub use tokio::task::spawn;

impl DEngine {
    pub async fn set_p2p_channel(&mut self, channel: tokio::sync::mpsc::Sender<RemoteDEngineCmd>) {
        self.0.set_p2p_channel(channel).await;
    }

    pub fn extract_export_name(&self, input: String) -> String {
        extract_export_name(input)
    }

    pub fn new(
        runtime_js_src: Option<fn() -> String>,
        db: Box<dyn ApeiroEnginePersistence>,
    ) -> Result<(DEngine, EventLoop)> {
        let (shared_dengine, rx, tx) = SharedDEngine::new_inner(runtime_js_src, db)?;
        let instance = Arc::new(shared_dengine);
        let event_loop = EventLoop {
            dengine: DEngine(instance.clone()),
            tx,
            rx,
        };
        Ok((DEngine(instance), event_loop))
    }

    #[instrument(skip(self))]
    pub async fn get_proc_lock(&self, proc_id: &String) -> Result<Arc<RwLock<()>>, anyhow::Error> {
        let proc_lock = {
            let mut locked_map = self.0.locks.write().await;
            if let Some(proc_lock) = locked_map.get(proc_id) {
                Arc::clone(proc_lock)
            } else {
                let proc_lock = Arc::new(RwLock::new(()));
                locked_map.insert(proc_id.clone(), proc_lock.clone());
                proc_lock
            }
        };

        Ok(proc_lock)
    }

    pub async fn process_post_step_suspension(
        &self,
        proc_id: &String,
        suspension: &serde_json::Value,
    ) {
        if let Some(subscription) = suspension.get("$subscribe") {
            println!("subscription detected");
            self.subscribe_proc_to_events(proc_id.clone(), subscription.clone())
                .await;
        }
    }

    pub async fn proc_new_compiled(
        &self,
        mount: MountSummary,
        name: Option<String>,
    ) -> Result<ProcNewOutput, anyhow::Error> {
        let name = if mount.singleton {
            self.0.db.proc_rename_if_exists(&mount.name, &format!("{}_{}", mount.name, now_as_millis()).clone())?;

            mount.name
        } else {
            name.unwrap_or_else(|| format!("{}_{}", mount.name, now_as_millis()))
        };
        
        let proc_id = self.0.db.proc_new(&mount.id, &Some(name))?;

        let mut engine = crate::Engine::new(self.0.runtime_js_src, proc_id.clone(), self.clone());

        let (res, engine_status) = engine
            .step_process(mount.compiled_src, None, None, None)
            .await?;

        self.0.db.proc_update(&proc_id, &res, &engine_status)?;

        if let Some(suspension) = &res.suspension {
            self.process_post_step_suspension(&proc_id, suspension)
                .await;
        };

        Ok(ProcNewOutput {
            id: proc_id,
            state: res,
        })
    }

    pub async fn proc_new(&self, req: ProcNewRequest) -> Result<ProcNewOutput, anyhow::Error> {
        let mount = self.mount_get(req.mount_id.clone()).await?;
        self.proc_new_compiled(mount, req.name).await
    }

    pub async fn proc_list(&self) -> Result<ProcListOutput, anyhow::Error> {
        let procs = self.0.db.proc_list()?;

        Ok(ProcListOutput { procs })
    }

    pub async fn mount_edit(
        &self,
        mount_id: String,
        new_src: String,
    ) -> Result<Option<ProcNewOutput>, anyhow::Error> {
        let mount_summary = self.0.db.mount_get(&mount_id)?;

        let procs_not_done = mount_summary
            .procs
            .iter()
            .filter(|proc_id| {
                let (_, _, _, step_result) = self.0.db.proc_get(proc_id).unwrap();
                !(step_result.status == StepResultStatus::DONE
                    || step_result.status == StepResultStatus::CRASHED)
            })
            .count();

        if procs_not_done > 0 {
            Err(anyhow!(
                "can't edit mount while there are procs still running"
            ))
        } else {
            let src = new_src.clone();
            let compiled_src = tokio::task::spawn_blocking(move || apeiro_compile(src)).await??;

            self.0.db.mount_edit(&mount_id, &new_src, &compiled_src.compiled_src)?;

            if mount_summary.singleton {
                let new_proc = self.proc_new(ProcNewRequest {
                    mount_id: mount_id.clone(),
                    name: None,
                }).await?;
                Ok(Some(new_proc))
            } else {
                Ok(None)
            }
        }
    }

    #[instrument(skip(self))]
    pub async fn mount_get(&self, mount_id: String) -> Result<MountSummary, anyhow::Error> {
        Ok(self.0.db.mount_get(&mount_id)?)
    }

    #[instrument(skip(self))]
    pub async fn mount_list(&self) -> Result<Vec<MountSummary>, anyhow::Error> {
        Ok(self.0.db.mount_list()?)
    }

    #[instrument(skip(self))]
    // calculate hash
    // check if hash exists in db
    // if it does, return the mount id
    // if it doesn't, compile and insert into db
    pub async fn mount_new(&self, req: MountNewRequest) -> Result<String, anyhow::Error> {
        use sha256::digest;
        let hash = digest(req.src.clone());
        if let Result::Ok(Some(mount)) = self.0.db.mount_find_by_hash(&hash) {
            Ok(mount)
        } else {
            let src = req.src.clone();
            let compiled_src = tokio::task::spawn_blocking(move || apeiro_compile(src)).await??;

            let mount = self.0.db.mount_new(
                &req.name.unwrap_or(extract_export_name(req.src.clone())),
                &req.src,
                &compiled_src,
                req.singleton.unwrap_or(false),
            )?;

            Ok(mount)
        }
    }

    #[instrument(skip(self))]
    pub async fn proc_is_executing(&self, proc_id: &String) -> Result<bool, anyhow::Error> {
        let executing = {
            let locked_map = self.0.locks.read().await;
            if let Some(proc_lock) = locked_map.get(proc_id) {
                if let Some(_proc_lock) = proc_lock.try_read().ok() {
                    false
                } else {
                    true
                }
            } else {
                false
            }
        };

        Ok(executing)
    }

    #[instrument(skip(self))]
    pub async fn proc_get(&self, proc_id: String) -> Result<ProcStatus, anyhow::Error> {
        let (res_proc_id, mount_id, name, res) = self
            .0
            .db
            .proc_get(&proc_id)
            .map_err(|_e| anyhow!("db problem"))?;

        let executing = self.proc_is_executing(&proc_id).await?;

        Ok(ProcStatus::new(res_proc_id, mount_id, name, res, executing))
    }

    #[instrument]
    pub async fn proc_delete(&self, proc_id: String) -> Result<(), anyhow::Error> {
        self.0.db.proc_delete(&proc_id)?;

        Ok(())
    }

    #[instrument(skip(self))]
    pub async fn proc_get_debug(&self, proc_id: String) -> Result<ProcStatusDebug, anyhow::Error> {
        let proc_status_debug = self.0.db.proc_inspect(&proc_id)?;

        Ok(proc_status_debug)
    }

    #[instrument(skip(self))]
    pub async fn proc_send_and_watch(
        &self,
        proc_id: String,
        body: ProcSendRequest,
    ) -> Result<tokio::sync::watch::Receiver<ProcEvent>, anyhow::Error> {
        use nanoid::nanoid;

        let exec_id = nanoid!();
        let watcher = self.watch(proc_id.clone()).await;
        self.proc_send(proc_id, Some(exec_id), body).await?;
        Ok(watcher)
    }

    #[instrument(skip(self))]
    pub async fn proc_watch(
        &self,
        proc_id: String,
    ) -> Result<tokio::sync::watch::Receiver<ProcEvent>, anyhow::Error> {
        let watcher = self.watch(proc_id.clone()).await;
        Ok(watcher)
    }

    #[instrument(skip(self))]
    pub async fn proc_send_and_watch_step_result(
        &self,
        proc_id: String,
        body: ProcSendRequest,
    ) -> Result<StepResult, anyhow::Error> {
        use nanoid::nanoid;

        let exec_id = nanoid!();
        let mut watcher = self.watch_exec(proc_id.clone(), exec_id.clone()).await;

        self.proc_send(proc_id.clone(), Some(exec_id), body).await?;

        while watcher.changed().await.is_ok() {
            let msg = &*watcher.borrow();
            trace!(?msg);
            match msg {
                ProcEvent::StepResult(step_result) => {
                    return Ok(step_result.clone());
                }
                ProcEvent::Error(err) => {
                    return Err(anyhow!(err.clone()));
                }
                ProcEvent::Log(log) => {
                    event!(
                        Level::INFO,
                        "received event in step request for {}: {:?}",
                        proc_id,
                        log
                    );
                }
                ProcEvent::None => {
                    event!(Level::INFO, "received none for {}", proc_id);
                }
            }
        }
        Err(anyhow!("watcher closed"))
    }

    #[instrument(skip(self))]
    pub(crate) async fn send(&self, cmd: DEngineCmd) -> Result<(), anyhow::Error> {
        self.0.tx.send(cmd).await.map_err(anyhow::Error::msg)
    }

    pub async fn load_proc_subscriptions(&self) -> Result<(), anyhow::Error> {
        let procs = self.0.db.proc_list()?;
        for proc in procs {
            if let Some(suspension) = proc.suspension {
                self.process_post_step_suspension(&proc.id, &suspension)
                    .await;
            }
        }

        Ok(())
    }

    pub async fn tick(&self) -> Result<(), anyhow::Error> {
        self.send(DEngineCmd::Tick).await
    }

    #[instrument(skip(self))]
    pub async fn proc_send(
        &self,
        proc_id: String,
        exec_id: Option<String>,
        body: ProcSendRequest,
    ) -> Result<String, anyhow::Error> {
        use nanoid::nanoid;

        let exec_id = exec_id.unwrap_or(nanoid!());
        self.send(DEngineCmd::Send(DEngineCmdSend {
            proc_id,
            step_id: exec_id.clone(),
            req: body,
        }))
        .await?;

        Ok(exec_id)
    }

    #[instrument(skip(self))]
    pub async fn remote_send(
        &self,
        peer_id: String,
        proc_id: String,
        exec_id: Option<String>,
        body: ProcSendRequest,
    ) -> Result<String, anyhow::Error> {
        use nanoid::nanoid;

        let exec_id = exec_id.unwrap_or(nanoid!());
        if let Some(p2p_channel) = &*self.0.p2p_channel.read().await {
            p2p_channel.send(RemoteDEngineCmd {
                peer_id,
                cmd: DEngineCmd::Send(DEngineCmdSend {
                    proc_id,
                    step_id: exec_id.clone(),
                    req: body,
                }),
            }).await.unwrap();
            Ok(exec_id)
        } else {
            panic!("can't send without p2p enabled")
        }
    }

    pub async fn send_to_watchers(
        &self,
        proc_id: &String,
        msg: &ProcEvent,
    ) -> Result<(), anyhow::Error> {
        trace!("acquiring read lock on watchers");
        let watchers_locked = self.0.watchers.read().await;
        if let Some(watcher) = watchers_locked.get(proc_id) {
            if !watcher.is_closed() {
                watcher.send(msg.clone()).unwrap();
                trace!("sent");
            }
        }
        Ok(())
    }

    #[instrument(skip(self))]
    pub async fn send_to_exec_watchers(
        &self,
        proc_id: &String,
        exec_id: &String,
        msg: &ProcEvent,
    ) -> Result<(), anyhow::Error> {
        trace!("acquiring read lock on exec_watchers");
        let watchers_locked = self.0.watchers_exec.read().await;
        if let Some(watcher) = watchers_locked.get(&(proc_id.clone(), exec_id.clone())) {
            if !watcher.is_closed() {
                watcher.send(msg.clone()).unwrap();
                trace!("sent");
            }
        }
        Ok(())
    }

    #[instrument(skip(self))]
    pub(crate) async fn inner_proc_send(
        &self,
        proc_id_or_name: &String,
        body: &ProcSendRequest,
    ) -> Result<StepResult, anyhow::Error> {
        let proc = self.0.db.proc_get_details(&proc_id_or_name)?;

        let res = if proc.state.status != StepResultStatus::SUSPEND {
            Err(anyhow!("can only send to suspended procs"))
        } else {
            let proc_lock = self.get_proc_lock(&proc.pid).await.expect("cant lock");
            let _proc_lock_guard = proc_lock.write().await;

            event!(Level::INFO, "after proc lock guard");

            let mut engine = crate::Engine::new(
                Some(crate::get_engine_runtime),
                proc.pid.clone(),
                self.clone(),
            );

            engine.mbox.push(body.msg.clone());

            let (res, engine_status) = engine
                .step_process(
                    proc.compiled_src,
                    proc.engine_status.funcs,
                    proc.engine_status.frames,
                    proc.engine_status.snapshot,
                )
                .await?;

            self.0.db.proc_update(&proc.pid, &res, &engine_status)?;

            if let Some(suspension) = &res.suspension {
                if let Some(generator_tag) = suspension.get("$generator") {
                    if generator_tag.as_bool().unwrap_or(false) {
                        println!(
                            "advacing {} because of $generator: {:?}",
                            proc.pid, res.suspension
                        );
                        self.send(DEngineCmd::Send(DEngineCmdSend {
                            proc_id: proc.pid.clone(),
                            step_id: "generator_step".to_string(),
                            req: ProcSendRequest {
                                msg: serde_json::json!({
                                    "$generator": true,
                                }),
                            },
                        }))
                        .await?;
                    }
                } else if let Some(subscription) = suspension.get("$subscribe") {
                    println!("subscription detected");
                    self.subscribe_proc_to_events(proc.pid.clone(), subscription.clone())
                        .await;
                }
            };

            Ok(res)
        };

        event!(Level::INFO, "result: {:?}", res);

        res
    }

    pub async fn get_all_subscriptions(&self) -> Vec<(String, serde_json::Value)> {
        let mut result = vec![];
        let proc_subscriptions_locked = self.0.proc_subscriptions.read().await;
        for (proc_id, proc_subscriptions) in proc_subscriptions_locked.iter() {
            for subscription in proc_subscriptions {
                result.push((proc_id.clone(), subscription.clone()));
            }
        }
        result
    }

    #[instrument(skip(self))]
    pub async fn subscribe_proc_to_events(&self, proc_id: String, subscription: serde_json::Value) {
        let _subscription_id = self
            .0
            .db
            .proc_subscription_new(&proc_id, &subscription)
            .unwrap();
        let mut proc_subscriptions_locked = self.0.proc_subscriptions.write().await;
        if let Some(subscriptions) = proc_subscriptions_locked.get_mut(&proc_id) {
            subscriptions.push(subscription);
        } else {
            proc_subscriptions_locked.insert(proc_id, vec![subscription]);
        }
    }

    #[instrument(skip(self))]
    pub async fn watch(&self, proc_id: String) -> tokio::sync::watch::Receiver<ProcEvent> {
        event!(Level::INFO, "waiting for watch creation");
        let watcher_subscription = {
            let watchers_locked = self.0.watchers.read().await;
            if let Some(watcher) = watchers_locked.get(&proc_id) {
                Some(watcher.subscribe())
            } else {
                None
            }
        };

        if let Some(watcher_subscription) = watcher_subscription {
            event!(Level::INFO, "returning watch");
            watcher_subscription
        } else {
            let (tx, rx) = tokio::sync::watch::channel(ProcEvent::None);
            let mut watchers_locked = self.0.watchers.write().await;
            watchers_locked.insert(proc_id.clone(), tx);
            event!(
                Level::INFO,
                "returning new watch -- total watchers for {} = {}",
                proc_id,
                watchers_locked.len()
            );
            rx
        }
    }

    #[instrument(skip(self))]
    pub async fn watch_exec(
        &self,
        proc_id: String,
        exec_id: String,
    ) -> tokio::sync::watch::Receiver<ProcEvent> {
        event!(Level::INFO, "waiting for watch creation");
        let watcher_subscription = {
            let watchers_locked = self.0.watchers_exec.read().await;
            if let Some(watcher) = watchers_locked.get(&(proc_id.clone(), exec_id.clone())) {
                Some(watcher.subscribe())
            } else {
                None
            }
        };

        if let Some(watcher_subscription) = watcher_subscription {
            event!(Level::INFO, "returning watch");
            watcher_subscription
        } else {
            let (tx, rx) = tokio::sync::watch::channel(ProcEvent::None);
            let mut watchers_locked = self.0.watchers_exec.write().await;
            watchers_locked.insert((proc_id.clone(), exec_id.clone()), tx);
            event!(
                Level::INFO,
                "returning new watch -- total watchers for ({},{}) = {}",
                proc_id,
                exec_id,
                watchers_locked.len()
            );
            rx
        }
    }
}

impl SharedDEngine {
    pub async fn set_p2p_channel(&self, channel: tokio::sync::mpsc::Sender<RemoteDEngineCmd>) {
        let mut p2p_channel = self.p2p_channel.write().await;
        *p2p_channel = Some(channel);
    }

    fn new_inner(
        runtime_js_src: Option<fn() -> String>,
        db: Box<dyn ApeiroEnginePersistence>,
    ) -> Result<(
        SharedDEngine,
        mpsc::Receiver<DEngineCmd>,
        mpsc::Sender<DEngineCmd>,
    )> {
        let (tx, rx) = mpsc::channel(32);

        let instance = SharedDEngine {
            p2p_channel: RwLock::new(None),
            runtime_js_src,
            db,
            locks: Arc::new(RwLock::new(HashMap::new())),
            tx: tx.clone(),
            watchers: Arc::new(RwLock::new(HashMap::new())),
            watchers_exec: Arc::new(RwLock::new(HashMap::new())),
            proc_subscriptions: Arc::new(RwLock::new(HashMap::new())),
        };

        instance.init_db()?;

        Ok((instance, rx, tx))
    }

    #[instrument(skip(self))]
    fn init_db(&self) -> Result<(), anyhow::Error> {
        self.db.init()
    }
}
