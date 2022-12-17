use anyhow::{anyhow, Ok, Result};
use pristine_compiler::pristine_bundle_and_compile;
use pristine_internal_api::ProcListOutput;
use pristine_internal_api::ProcNewOutput;
use pristine_internal_api::ProcNewRequest;
use pristine_internal_api::ProcSendRequest;
use pristine_internal_api::StepResult;
use pristine_internal_api::StepResultStatus;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

use crate::db;
use std::string::String;
use std::sync::Arc;

pub struct DEngine(Arc<SharedDEngine>);

/// Returns a new `DEngine` referencing the same state as `self`.
impl Clone for DEngine {
    fn clone(&self) -> DEngine {
        DEngine(self.0.clone())
    }
}

struct SharedDEngine {
    runtime_js_src: Option<fn() -> String>,
    db: Pool<SqliteConnectionManager>,
}

impl DEngine {
    pub fn new(
        runtime_js_src: Option<fn() -> String>,
        db: Pool<SqliteConnectionManager>,
    ) -> DEngine {
        let instance = Arc::new(SharedDEngine::new_inner(runtime_js_src, db));
        DEngine(instance)
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

    pub async fn proc_get(&self, pid: String) -> Result<StepResult, anyhow::Error> {
        let conn = self.0.db.get().expect("");
        let res = db::proc_get(&conn, &pid).map_err(|_e| anyhow!("db problem"))?;

        Ok(res)
    }

    pub async fn proc_send(
        &self,
        proc_id: String,
        body: ProcSendRequest,
    ) -> Result<StepResult, anyhow::Error> {
        let conn = self.0.db.get().expect("");

        let proc = db::proc_get_details(&conn, &proc_id).unwrap();

        if proc.state.status != StepResultStatus::SUSPEND {
            Err(anyhow!("can only send to suspended procs"))
        } else {
            let mut engine =
                crate::Engine::new_with_name(Some(crate::get_engine_runtime), proc_id.clone());

            engine.mbox.push(body.msg.clone());

            let (res, snapshot) = engine
                .step_process(
                    Some(proc.compiled_src),
                    Some(proc.snapshot),
                    "$step($usercode().default)".into(),
                )
                .await
                .unwrap();

            db::proc_update(&conn, &proc_id, &res, &snapshot).unwrap();

            Ok(res)
        }
    }
}

impl SharedDEngine {
    fn new_inner(
        runtime_js_src: Option<fn() -> String>,
        db: Pool<SqliteConnectionManager>,
    ) -> SharedDEngine {
        let instance = SharedDEngine { runtime_js_src, db };

        instance.init_db().expect("Failed to initialize database");

        instance
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
