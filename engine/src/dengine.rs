use anyhow::{anyhow, Ok, Result};
use pristine_compiler::pristine_bundle_and_compile;
use pristine_internal_api::ProcListOutput;
use pristine_internal_api::ProcNewOutput;
use pristine_internal_api::ProcNewRequest;
use pristine_internal_api::ProcSendRequest;
use pristine_internal_api::ProcStatus;
use pristine_internal_api::StepResult;
use pristine_internal_api::StepResultStatus;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use serde::{Serialize,Deserialize};
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
    pid: String,
    req: ProcSendRequest,
}

#[derive(Debug)]
pub(crate) enum DEngineCmd {
    Send(DEngineCmdSend),
    Log((String, serde_json::Value)),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcEvent {
    Log(serde_json::Value),
    StepResult(StepResult),
    None,
}

struct SharedDEngine {
    runtime_js_src: Option<fn() -> String>,
    db: Pool<SqliteConnectionManager>,
    locks: Arc<RwLock<HashMap<String, Arc<RwLock<()>>>>>,
    tx: mpsc::Sender<DEngineCmd>,
    watchers: Arc<RwLock<HashMap<String, tokio::sync::watch::Sender<ProcEvent>>>>,
}

pub struct EventLoop {
    dengine: DEngine,
    rx: mpsc::Receiver<DEngineCmd>,
}

impl EventLoop {
    pub async fn run(&mut self) {
        println!("Event loop started");
        while let Some(message) = self.rx.recv().await {
            println!("GOT = {:?}", message);
            match message {
                DEngineCmd::Send(cmd) => {
                    let dengine = self.dengine.clone();
                    tokio::task::spawn(async move {
                        println!("inner proc send");
                        let res = dengine.inner_proc_send(&cmd.pid, &cmd.req).await;
                        if let Err(err) = res {
                            println!("inner proc send error {:?} -> {:?}", cmd, err);
                        }
                    });
                }
                DEngineCmd::Log((pid, msg)) => {
                    let dengine = self.dengine.clone();
                    println!("event loop LOG: {} -> {:?}", pid, msg);
                    tokio::task::spawn(async move {
                        dengine.send_to_watchers(&pid, &ProcEvent::Log(msg)).await.unwrap();
                    });
                }
            }
        }
        println!("Event loop finished");
    }
}

impl DEngine {
    pub fn new(
        runtime_js_src: Option<fn() -> String>,
        db: Pool<SqliteConnectionManager>,
    ) -> Result<(DEngine, EventLoop)> {
        let (shared_dengine, rx) = SharedDEngine::new_inner(runtime_js_src, db)?;
        let instance = Arc::new(shared_dengine);
        let event_loop = EventLoop {
            dengine: DEngine(instance.clone()),
            rx,
        };
        Ok((DEngine(instance), event_loop))
    }

    async fn get_proc_lock(&self, pid: String) -> Result<Arc<RwLock<()>>, anyhow::Error> {
        let proc_lock = {
            let mut locked_map = self.0.locks.write().await;
            if let Some(proc_lock) = locked_map.get(&pid) {
                Arc::clone(proc_lock)
            } else {
                let proc_lock = Arc::new(RwLock::new(()));
                locked_map.insert(pid, proc_lock.clone());
                proc_lock
            }
        };

        Ok(proc_lock)
    }

    pub async fn proc_new(&self, req: ProcNewRequest) -> Result<ProcNewOutput, anyhow::Error> {
        let conn = self.0.db.get().map_err(|_e| anyhow!("no conn"))?;

        let src = req.src.clone();
        let compiled_src =
            tokio::task::spawn_blocking(move || pristine_bundle_and_compile(src).unwrap())
                .await
                .unwrap();
        println!("compiled_src: {}", compiled_src);
        // let compiled_src = pristine_compile(body.src.clone()).unwrap();

        let proc_id = db::proc_new(&conn, &req.src, &compiled_src).unwrap();

        let mut engine = crate::Engine::new(self.0.runtime_js_src);

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

    pub async fn proc_list(&self) -> ProcListOutput {
        let conn = self.0.db.get().expect("");
        let procs = db::proc_list(&conn).expect("");

        ProcListOutput { procs }
    }

    pub async fn proc_get(&self, pid: String) -> Result<ProcStatus, anyhow::Error> {
        let conn = self.0.db.get().expect("");
        let res = db::proc_get(&conn, &pid).map_err(|_e| anyhow!("db problem"))?;

        let executing = {
            let locked_map = self.0.locks.read().await;
            if let Some(proc_lock) = locked_map.get(&pid) {
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

    pub async fn proc_send_and_watch(
        &self,
        proc_id: String,
        body: ProcSendRequest,
    ) -> Result<tokio::sync::watch::Receiver<ProcEvent>, anyhow::Error> {
        let watcher = self.watch(proc_id.clone()).await;
        self.proc_send(proc_id, body).await?;
        Ok(watcher)
    }

    pub async fn proc_watch(
        &self,
        proc_id: String,
    ) -> Result<tokio::sync::watch::Receiver<ProcEvent>, anyhow::Error> {
        let  watcher = self.watch(proc_id.clone()).await;
        Ok(watcher)
    }


    pub async fn proc_send_and_watch_step_result(
        &self,
        proc_id: String,
        body: ProcSendRequest,
    ) -> Result<StepResult, anyhow::Error> {
        let mut watcher = self.watch(proc_id.clone()).await;
        
        println!("before proc send");
        self.proc_send(proc_id.clone(), body).await?;
        println!("after proc send");
        
        while watcher.changed().await.is_ok() {
            println!("watching watcher for {}", proc_id);
            match &*watcher.borrow() {
                ProcEvent::StepResult(step_result) => {
                    println!("received step result for {}", proc_id);
                    return Ok(step_result.clone())
                }
                _ => {
                    println!("received event in step request for {}", proc_id)
                }
            }
        }
        Err(anyhow!("watcher closed"))
    }

    pub(crate) async fn send(
        &self,
        cmd: DEngineCmd
    ) -> Result<(), anyhow::Error> {
        self.0.tx.send(cmd).await.map_err(anyhow::Error::msg)
    }

    pub async fn proc_send(
        &self,
        proc_id: String,
        body: ProcSendRequest,
    ) -> Result<(), anyhow::Error> {
        self.0
            .tx
            .send(DEngineCmd::Send(DEngineCmdSend {
                pid: proc_id,
                req: body,
            }))
            .await?;
        Ok(())
    }

    pub async fn send_to_watchers(
        &self,
        proc_id: &String,
        msg: &ProcEvent,
    ) -> Result<(), anyhow::Error> {
            let watchers_locked = self.0.watchers.read().await;
            if let Some(watcher) = watchers_locked.get(proc_id) {
                if !watcher.is_closed() {
                    watcher.send(msg.clone()).unwrap();
                }
            }
        Ok(())
    }

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

            println!("after proc lock guard");

            let mut engine =
                crate::Engine::new_with_name(Some(crate::get_engine_runtime), proc_id.clone());
            
            engine.dengine = Some(self.clone());

            engine.mbox.push(body.msg.clone());

            let (res, snapshot) = engine
                .step_process(
                    Some(proc.compiled_src),
                    Some(proc.snapshot),
                    "$step($usercode().default)".into(),
                )
                .await?;

            db::proc_update(&conn, &proc_id, &res, &snapshot)?;

            Ok(res)
        };


        println!("result: {:?}", res);

        let msg = if let Result::Ok(res) = &res {
            res.clone()
        } else {
            println!("error: {:?}", res);
            StepResult {
                status: StepResultStatus::ERROR,
                val: Some(serde_json::Value::String(format!("{:?}", res))),
                ..Default::default()
            }
        };

        self.send_to_watchers(proc_id, &ProcEvent::StepResult(msg)).await.unwrap();

        res
    }

    pub async fn watch(&self, pid: String) -> tokio::sync::watch::Receiver<ProcEvent> {
        println!("waiting for watch creation");
        let watcher_subscription = {
            let watchers_locked = self.0.watchers.read().await;
            if let Some(watcher) = watchers_locked.get(&pid) {
                Some(watcher.subscribe())
            } else {
                None
            }
        };
        
        if let Some(watcher_subscription) = watcher_subscription {
            println!("returning watch");
            watcher_subscription
        } else {
            let (tx, rx) = tokio::sync::watch::channel(ProcEvent::None);
            let mut watchers_locked = self.0.watchers.write().await;
            watchers_locked.insert(pid, tx);
            println!("returning watch");
            rx
        }
    }
}

impl SharedDEngine {
    fn new_inner(
        runtime_js_src: Option<fn() -> String>,
        db: Pool<SqliteConnectionManager>,
    ) -> Result<(SharedDEngine, mpsc::Receiver<DEngineCmd>)> {
        let (tx, rx) = mpsc::channel(32);

        let instance = SharedDEngine {
            runtime_js_src,
            db,
            locks: Arc::new(RwLock::new(HashMap::new())),
            tx,
            watchers: Arc::new(RwLock::new(HashMap::new())),
        };

        instance.init_db()?;

        Ok((instance, rx))
    }

    fn init_db(&self) -> Result<(), anyhow::Error> {
        let conn = self.db.get()?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS procs (
            id TEXT PRIMARY KEY,
            src TEXT,
            compiled_src TEXT,
            status TEXT,
            val TEXT,
            suspension TEXT,
            snapshot BLOB
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
