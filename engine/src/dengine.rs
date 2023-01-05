use anyhow::{anyhow, Ok, Result};
use apeiro_compiler::apeiro_bundle_and_compile;
use apeiro_internal_api::ProcListOutput;
use apeiro_internal_api::ProcNewOutput;
use apeiro_internal_api::ProcNewRequest;
use apeiro_internal_api::ProcSendRequest;
use apeiro_internal_api::ProcStatus;
use apeiro_internal_api::ProcStatusDebug;
use apeiro_internal_api::StepResult;
use apeiro_internal_api::StepResultStatus;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio::sync::RwLock;
use tracing::trace;

use std::collections::HashMap;
use std::string::String;
use std::sync::Arc;

pub struct DEngine(Arc<SharedDEngine>);

/// Returns a new `DEngine` referencing the same state as `self`.
impl Clone for DEngine {
    fn clone(&self) -> DEngine {
        DEngine(self.0.clone())
    }
}

#[derive(Debug)]
pub(crate) struct DEngineCmdSend {
    proc_id: String,
    step_id: String,
    req: ProcSendRequest,
}

#[derive(Debug)]
pub(crate) enum DEngineCmd {
    Broadcast(String, String, ProcEvent),
    Send(DEngineCmdSend),
    Log((String, String, serde_json::Value)),
    Tick,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcEvent {
    Error(String),
    Log(serde_json::Value),
    StepResult(StepResult),
    None,
}

#[derive(Debug)]
struct SharedDEngine {
    runtime_js_src: Option<fn() -> String>,
    db: Box<dyn ApeiroEnginePersistence>,
    locks: Arc<RwLock<HashMap<String, Arc<RwLock<()>>>>>,
    tx: mpsc::Sender<DEngineCmd>,
    watchers: Arc<RwLock<HashMap<String, tokio::sync::watch::Sender<ProcEvent>>>>,
    watchers_exec: Arc<RwLock<HashMap<(String, String), tokio::sync::watch::Sender<ProcEvent>>>>,
    proc_subscriptions: Arc<RwLock<HashMap<String, Vec<serde_json::Value>>>>,
}

pub struct EventLoop {
    dengine: DEngine,
    tx: mpsc::Sender<DEngineCmd>,
    rx: mpsc::Receiver<DEngineCmd>,
}

use tracing::{event, instrument, Level};

use crate::db::ApeiroEnginePersistence;

impl EventLoop {
    #[instrument(name = "eventloop", skip(self))]
    pub async fn run(&mut self) {
        event!(Level::INFO, "Event loop started");
        while let Some(message) = self.rx.recv().await {
            event!(Level::INFO, message = ?message);
            match message {
                DEngineCmd::Tick => {
                    let dengine = self.dengine.clone();
                    let s = dengine.get_all_subscriptions().await;
                    println!("subscriptions: {:?}", s);
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

impl DEngine {
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
    async fn get_proc_lock(&self, proc_id: &String) -> Result<Arc<RwLock<()>>, anyhow::Error> {
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

    #[instrument(skip(self))]
    pub async fn proc_new(&self, req: ProcNewRequest) -> Result<ProcNewOutput, anyhow::Error> {
        let src = req.src.clone();
        let compiled_src =
            tokio::task::spawn_blocking(move || apeiro_bundle_and_compile(src).unwrap())
                .await
                .unwrap();

        let proc_id = self.0.db.proc_new(&req.src, &req.name, &compiled_src)?;

        let mut engine = crate::Engine::new(self.0.runtime_js_src);

        let (res, engine_status) = engine.step_process(compiled_src, None, None).await.unwrap();

        self.0
            .db
            .proc_update(&proc_id, &res, &engine_status)
            .unwrap();

        if let Some(suspension) = &res.suspension {
            self.process_post_step_suspension(&proc_id, suspension)
                .await;
        };

        Ok(ProcNewOutput {
            id: proc_id,
            state: res,
        })
    }

    #[instrument(skip(self))]
    pub async fn proc_list(&self) -> Result<ProcListOutput, anyhow::Error> {
        let procs = self.0.db.proc_list()?;

        Ok(ProcListOutput { procs })
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
        let res = self
            .0
            .db
            .proc_get(&proc_id)
            .map_err(|_e| anyhow!("db problem"))?;

        let executing = self.proc_is_executing(&proc_id).await?;

        Ok(ProcStatus::new(res, executing))
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
        self.0
            .tx
            .send(DEngineCmd::Tick)
            .await
            .map_err(anyhow::Error::msg)
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
        self.0
            .tx
            .send(DEngineCmd::Send(DEngineCmdSend {
                proc_id: proc_id,
                step_id: exec_id.clone(),
                req: body,
            }))
            .await?;

        Ok(exec_id)
    }

    #[instrument(skip(self))]
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
    async fn inner_proc_send(
        &self,
        proc_id: &String,
        body: &ProcSendRequest,
    ) -> Result<StepResult, anyhow::Error> {
        let proc = self.0.db.proc_get_details(&proc_id)?;

        let res = if proc.state.status != StepResultStatus::SUSPEND {
            Err(anyhow!("can only send to suspended procs"))
        } else {
            let proc_lock = self.get_proc_lock(proc_id).await.expect("cant lock");
            let _proc_lock_guard = proc_lock.write().await;

            event!(Level::INFO, "after proc lock guard");

            let mut engine =
                crate::Engine::new_with_name(Some(crate::get_engine_runtime), proc_id.clone());

            engine.dengine = Some(self.clone());

            engine.mbox.push(body.msg.clone());

            let (res, engine_status) = engine
                .step_process(
                    proc.compiled_src,
                    proc.engine_status.funcs,
                    proc.engine_status.frames,
                )
                .await?;

            self.0.db.proc_update(&proc_id, &res, &engine_status)?;

            if let Some(suspension) = &res.suspension {
                if let Some(generator_tag) = suspension.get("$generator") {
                    if generator_tag.as_bool().unwrap_or(false) {
                        println!(
                            "advacing {} because of $generator: {:?}",
                            proc_id, res.suspension
                        );
                        self.send(DEngineCmd::Send(DEngineCmdSend {
                            proc_id: proc_id.clone(),
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
                    self.subscribe_proc_to_events(proc_id.clone(), subscription.clone())
                        .await;
                }
            };

            Ok(res)
        };

        event!(Level::INFO, "result: {:?}", res);

        res
    }

    pub async fn get_all_subscriptions(&self) -> Vec<serde_json::Value> {
        let mut result = vec![];
        let proc_subscriptions_locked = self.0.proc_subscriptions.read().await;
        for (_, proc_subscriptions) in proc_subscriptions_locked.iter() {
            for subscription in proc_subscriptions {
                result.push(subscription.clone());
            }
        }
        result
    }

    #[instrument(skip(self))]
    pub async fn subscribe_proc_to_events(&self, proc_id: String, subscription: serde_json::Value) {
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
