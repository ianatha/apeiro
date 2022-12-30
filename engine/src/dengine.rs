use anyhow::{anyhow, Ok, Result};
use pristine_compiler::pristine_bundle_and_compile;
use pristine_internal_api::ProcListOutput;
use pristine_internal_api::ProcNewOutput;
use pristine_internal_api::ProcNewRequest;
use pristine_internal_api::ProcSendRequest;
use pristine_internal_api::ProcStatus;
use pristine_internal_api::ProcStatusDebug;
use pristine_internal_api::StepResult;
use pristine_internal_api::StepResultStatus;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio::sync::RwLock;

use crate::db;
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
    db: Pool<SqliteConnectionManager>,
    locks: Arc<RwLock<HashMap<String, Arc<RwLock<()>>>>>,
    tx: mpsc::Sender<DEngineCmd>,
    watchers: Arc<RwLock<HashMap<String, tokio::sync::watch::Sender<ProcEvent>>>>,
    watchers_exec: Arc<RwLock<HashMap<(String, String), tokio::sync::watch::Sender<ProcEvent>>>>,
}

#[derive(Debug)]
pub struct EventLoop {
    dengine: DEngine,
    tx: mpsc::Sender<DEngineCmd>,
    rx: mpsc::Receiver<DEngineCmd>,
}

use tracing::{Level, event, instrument};

impl EventLoop {
    #[instrument(name="dengine::eventloop")]
    pub async fn run(&mut self) {
        event!(Level::INFO, "Event loop started");
        while let Some(message) = self.rx.recv().await {
            event!(Level::INFO, "received event loop message");
            event!(Level::INFO, message = ?message);
            match message {
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
    #[instrument]
    pub fn new(
        runtime_js_src: Option<fn() -> String>,
        db: Pool<SqliteConnectionManager>,
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

    #[instrument]
    async fn get_proc_lock(&self, proc_id: String) -> Result<Arc<RwLock<()>>, anyhow::Error> {
        let proc_lock = {
            let mut locked_map = self.0.locks.write().await;
            if let Some(proc_lock) = locked_map.get(&proc_id) {
                Arc::clone(proc_lock)
            } else {
                let proc_lock = Arc::new(RwLock::new(()));
                locked_map.insert(proc_id, proc_lock.clone());
                proc_lock
            }
        };

        Ok(proc_lock)
    }

    #[instrument]
    pub async fn proc_new(&self, req: ProcNewRequest) -> Result<ProcNewOutput, anyhow::Error> {
        let conn = self.0.db.get().map_err(|_e| anyhow!("no conn"))?;

        let src = req.src.clone();
        let compiled_src =
            tokio::task::spawn_blocking(move || pristine_bundle_and_compile(src).unwrap())
                .await
                .unwrap();

        let proc_id = db::proc_new(&conn, &req.src, &req.name, &compiled_src)?;

        let mut engine = crate::Engine::new(self.0.runtime_js_src);

        #[cfg(v8_snapshots)]
        {
            let (res, snapshot) = engine
                .step_process(
                    Some(compiled_src),
                    None,
                    "$step($usercode().default)".into(),
                )
                .await
                .unwrap();

            db::proc_update(&conn, &proc_id, &res, &snapshot).unwrap();

            Ok(ProcNewOutput {
                id: proc_id,
                state: res,
            })
        }

        #[cfg(not(v8_snapshots))]
        {
            let res = engine
                .step_process_fast(
                    Some(compiled_src),
                    "$step($usercode().default)".into(),
                    None,
                )
                .await
                .unwrap();

            db::proc_update(&conn, &proc_id, &res, &vec![]).unwrap();

            Ok(ProcNewOutput {
                id: proc_id,
                state: res,
            })
        }
    }

    #[instrument]
    pub async fn proc_list(&self) -> Result<ProcListOutput, anyhow::Error> {
        let conn = self.0.db.get()?;
        let procs = db::proc_list(&conn)?;

        Ok(ProcListOutput { procs })
    }

    #[instrument]
    pub async fn proc_get(&self, proc_id: String) -> Result<ProcStatus, anyhow::Error> {
        let conn = self.0.db.get().expect("");
        let res = db::proc_get(&conn, &proc_id).map_err(|_e| anyhow!("db problem"))?;

        let executing = {
            let locked_map = self.0.locks.read().await;
            if let Some(proc_lock) = locked_map.get(&proc_id) {
                if let Some(_proc_lock) = proc_lock.try_read().ok() {
                    false
                } else {
                    true
                }
            } else {
                false
            }
        };

        Ok(ProcStatus::new(res, executing))
    }

    #[instrument]
    pub async fn proc_get_debug(&self, proc_id: String) -> Result<ProcStatusDebug, anyhow::Error> {
        let conn = self.0.db.get().expect("");
        let src = db::proc_get_src(&conn, &proc_id).map_err(|_e| anyhow!("db problem"))?;

        Ok(ProcStatusDebug { compiled_src: src })
    }

    #[instrument]
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

    #[instrument]
    pub async fn proc_watch(
        &self,
        proc_id: String,
    ) -> Result<tokio::sync::watch::Receiver<ProcEvent>, anyhow::Error> {
        let watcher = self.watch(proc_id.clone()).await;
        Ok(watcher)
    }

    #[instrument]
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
            event!(Level::INFO, "watching watcher for {}", proc_id);
            match &*watcher.borrow() {
                ProcEvent::StepResult(step_result) => {
                    event!(Level::INFO, "received step result for {}", proc_id);
                    event!(Level::INFO, "terminating");
                    return Ok(step_result.clone());
                }
                ProcEvent::Error(err) => {
                    event!(Level::INFO, "received error for {}", proc_id);
                    event!(Level::INFO, "terminating");
                    return Err(anyhow!(err.clone()));
                }
                ProcEvent::Log(log) => {
                    event!(Level::INFO, "received event in step request for {}: {:?}", proc_id, log);
                }
                ProcEvent::None => {
                    event!(Level::INFO, "received none for {}", proc_id);
                }
            }
        }
        event!(Level::INFO, "terminating");
        Err(anyhow!("watcher closed"))
    }

    #[instrument]
    pub(crate) async fn send(&self, cmd: DEngineCmd) -> Result<(), anyhow::Error> {
        self.0.tx.send(cmd).await.map_err(anyhow::Error::msg)
    }

    #[instrument]
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

    #[instrument]
    pub async fn send_to_watchers(
        &self,
        proc_id: &String,
        msg: &ProcEvent,
    ) -> Result<(), anyhow::Error> {
        event!(Level::INFO, "trying to read watchers to send {:?}", msg);
        let watchers_locked = self.0.watchers.read().await;
        if let Some(watcher) = watchers_locked.get(proc_id) {
            if !watcher.is_closed() {
                event!(Level::INFO, "sending to watcher {} {:?}", proc_id, msg);
                watcher.send(msg.clone()).unwrap();
            }
        }
        event!(Level::INFO, "sent {:?}", msg);
        Ok(())
    }

    #[instrument]
    pub async fn send_to_exec_watchers(
        &self,
        proc_id: &String,
        exec_id: &String,
        msg: &ProcEvent,
    ) -> Result<(), anyhow::Error> {
        event!(Level::INFO, "trying to read exec watchers to send {:?}", msg);
        let watchers_locked = self.0.watchers_exec.read().await;
        if let Some(watcher) = watchers_locked.get(&(proc_id.clone(), exec_id.clone())) {
            if !watcher.is_closed() {
                event!(Level::INFO, "trying to read exec watchers to send {} {} {:?}", proc_id, exec_id, msg);
                watcher.send(msg.clone()).unwrap();
            }
        }
        event!(Level::INFO, "sent {:?}", msg);
        Ok(())
    }

    #[instrument]
    async fn inner_proc_send(
        &self,
        proc_id: &String,
        body: &ProcSendRequest,
    ) -> Result<StepResult, anyhow::Error> {
        let conn = self.0.db.get()?;

        let proc = db::proc_get_details(&conn, &proc_id)?;

        let res = if proc.state.status != StepResultStatus::SUSPEND {
            Err(anyhow!("can only send to suspended procs"))
        } else {
            let proc_lock = self
                .get_proc_lock(proc_id.clone())
                .await
                .expect("cant lock");
            let _proc_lock_guard = proc_lock.write().await;

            event!(Level::INFO, "after proc lock guard");

            let mut engine =
                crate::Engine::new_with_name(Some(crate::get_engine_runtime), proc_id.clone());

            engine.dengine = Some(self.clone());

            engine.mbox.push(body.msg.clone());

            #[cfg(v8_snapshots)]
            {
                let (res, snapshot) = engine
                    .step_process(
                        Some(proc.compiled_src),
                        Some(proc.snapshot),
                        "$step($usercode().default)".into(),
                    )
                    .await?;

                db::proc_update(&conn, &proc_id, &res, &snapshot)?;

                Ok(res)
            }

            #[cfg(not(v8_snapshots))]
            {
                let res = engine
                    .step_process_fast(
                        Some(proc.compiled_src),
                        "$step($usercode().default)".into(),
                        proc.state.frames,
                    )
                    .await?;

                db::proc_update(&conn, &proc_id, &res, &vec![])?;

                Ok(res)
            }
        };

        event!(Level::INFO, "result: {:?}", res);

        res
    }

    #[instrument]
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
            event!(Level::INFO,
                "returning new watch -- total watchers for {} = {}",
                proc_id,
                watchers_locked.len()
            );
            rx
        }
    }

    #[instrument]
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
            event!(Level::INFO,
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
    #[instrument]
    fn new_inner(
        runtime_js_src: Option<fn() -> String>,
        db: Pool<SqliteConnectionManager>,
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
        };

        instance.init_db()?;

        Ok((instance, rx, tx))
    }

    #[instrument]
    fn init_db(&self) -> Result<(), anyhow::Error> {
        let conn = self.db.get()?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS procs (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE,
            src TEXT,
            compiled_src TEXT,
            status TEXT,
            val TEXT,
            suspension TEXT,
            snapshot BLOB,
            frames TEXT
        );",
            (),
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS mbox (
            id TEXT PRIMARY KEY,
            proc_id TEXT,
            msg TEXT,
            read BOOL
        );",
            (),
        )?;

        Ok(())
    }
}
