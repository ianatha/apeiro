use std::fmt::Debug;

use anyhow::{anyhow, Context};
use apeiro_compiler::CompilationResult;
use apeiro_internal_api::{
    EngineStatus, ModuleSummary, ProcDetails, ProcGetResponse, ProcStatusDebug, ProcSummary,
    StepResult,
};
use nanoid::nanoid;
use r2d2::Pool;
use r2d2_sqlite::{rusqlite::params, SqliteConnectionManager};
use serde_json;

use crate::{db::ApeiroPersistence, StepResultStatus};

pub struct Db {
    pub pool: Pool<SqliteConnectionManager>,
}

impl Debug for Db {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Db").field("pool", &self.pool).finish()
    }
}

impl ApeiroPersistence for Db {
    fn init(&self) -> Result<(), anyhow::Error> {
        let conn = self.pool.get()?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                created_at DATATIME not null default (datetime('now'))
            );",
            (),
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS modules (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE,
                src TEXT,
                compiled_src TEXT,
                source_map TEXT,
                pc_to_map TEXT,
                hash_sha256 TEXT,
                singleton_version INTEGER,
                created_at DATATIME not null default (datetime('now'))
            );",
            (),
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS plugins (
                id TEXT PRIMARY KEY,
                state TEXT
            );",
            (),
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS procs (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE,
                module_id TEXT,
                state BLOB,
                current_step_id INTEGER,
                singleton_version INTEGER,
                created_at DATATIME not null default (datetime('now'))
            );",
            (),
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS steps (
                proc_id TEXT,
                step_id INTEGER NOT NULL,
                status TEXT,
                val TEXT,
                suspension TEXT,
                snapshot BLOB,
                frames TEXT,
                funcs TEXT,
                PRIMARY KEY (proc_id, step_id)
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

        conn.execute(
            "CREATE TABLE IF NOT EXISTS proc_subscriptions (
                id TEXT PRIMARY KEY,
                proc_id TEXT,
                subscription TEXT
            );",
            (),
        )?;

        Ok(())
    }

    fn plugin_get_state(&self, name: &String) -> Result<serde_json::Value, anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare("SELECT state FROM plugins WHERE id = ?")?;

        let result: serde_json::Value = stmt.query_row(&[name], |row| {
            let val_text: String = row.get(0)?;
            let res = serde_json::from_str(val_text.as_str()).unwrap();
            Ok(res)
        })?;

        Ok(result)
    }

    fn plugin_set_state(
        &self,
        name: &String,
        val: &serde_json::Value,
    ) -> Result<(), anyhow::Error> {
        let conn = self.pool.get()?;

        let val_json = serde_json::to_string(val)?;

        let _stmt = conn.execute(
            "INSERT INTO plugins (id, state) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET state = ?",
            params![name, &val_json, &val_json],
        )?;

        Ok(())
    }

    fn proc_new(&self, module_id: &String, name: &Option<String>) -> Result<String, anyhow::Error> {
        let id = nanoid!();

        let conn = self.pool.get()?;

        conn.execute(
            "INSERT INTO procs (id, name, module_id, current_step_id) VALUES (?, ?, ?, ?)",
            params![&id, name, module_id, 0],
        )
        .unwrap();

        Ok(id)
    }

    fn proc_update(
        &self,
        id: &String,
        state: &StepResult,
        engine_status: &EngineStatus,
    ) -> Result<(), anyhow::Error> {
        let frames_json = serde_json::to_string(&engine_status.frames).unwrap();
        let funcs_json = serde_json::to_string(&engine_status.funcs).unwrap();

        let conn = self.pool.get()?;

        let step_id = conn
            .prepare("SELECT current_step_id FROM procs WHERE id = ?")?
            .query_row(&[id], |row| {
                let current_step_id: i64 = row.get(0)?;
                Ok(current_step_id + 1)
            })?;

        conn.execute(
            "INSERT INTO steps (proc_id, step_id, status, val, suspension, frames, funcs, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                id,
                step_id,
                serde_json::to_string(&state.status).unwrap(),
                state
                    .val
                    .as_ref()
                    .map(|v| serde_json::to_string(&v).unwrap_or("error".to_string())),
                state
                    .suspension
                    .as_ref()
                    .map(|v| serde_json::to_string(&v).unwrap_or("error".to_string())),
                frames_json,
                funcs_json,
                engine_status.snapshot,
            ],
        )?;

        conn.execute(
            "UPDATE procs SET current_step_id=? WHERE id=?",
            params![step_id, id],
        )?;

        Ok(())
    }

    fn proc_get_details(&self, proc_id_or_name: &String) -> Result<ProcDetails, anyhow::Error> {
        let conn = self.pool.get()?;

        let proc = self.proc_get(proc_id_or_name)?;

        let mut stmt =
            conn.prepare("SELECT modules.compiled_src, steps.frames, steps.funcs, steps.snapshot FROM procs JOIN steps ON (steps.step_id = procs.current_step_id AND procs.id = steps.proc_id) JOIN modules ON (modules.id = procs.module_id) WHERE procs.id = ?")
                .context("proc_get_details query failed")?;

        let result = stmt.query_row(&[&proc.proc_id.clone()], |row| {
            let compiled_src: String = row.get(0)?;
            let frames: String = row.get(1)?;
            let frames: Option<serde_json::Value> = serde_json::from_str(&frames).unwrap();
            let funcs: String = row.get(2)?;
            let funcs: Option<serde_json::Value> = serde_json::from_str(&funcs).unwrap();
            let snapshot: Option<Vec<u8>> = row.get(3)?;
            let engine_status = EngineStatus {
                frames,
                funcs,
                snapshot,
            };
            Ok(ProcDetails {
                pid: proc.proc_id,
                module_id: proc.module_id,
                name: proc.name,
                compiled_src,
                engine_status,
                state: proc.step_result,
            })
        })?;

        Ok(result)
    }

    fn proc_get(&self, proc_id_or_name: &String) -> Result<ProcGetResponse, anyhow::Error> {
        let conn = self.pool.get()?;

        let mut stmt = if is_proc_id(proc_id_or_name) {
            conn.prepare(
                "SELECT steps.status, steps.val, steps.suspension, procs.id, procs.name, procs.module_id FROM procs JOIN steps ON (steps.step_id = procs.current_step_id AND procs.id = steps.proc_id) WHERE procs.id = ?",
            )
            .context("proc_get by id query failed")?
        } else {
            conn.prepare(
                "SELECT steps.status, steps.val, steps.suspension, procs.id, procs.name, procs.module_id FROM procs JOIN steps ON (steps.step_id = procs.current_step_id AND procs.id = steps.proc_id) WHERE procs.name = ?",
            )
            .context("proc_get by name query failed")?
        };

        let result = stmt.query_row(&[proc_id_or_name], |row| {
            let status: String = row.get(0)?;
            let status: StepResultStatus = serde_json::from_str(&status).unwrap();
            let val: Result<String, _> = row.get(1);
            let val = if let Ok(val) = val {
                serde_json::from_str(&val).unwrap_or(None)
            } else {
                None
            };
            let suspension: Result<String, _> = row.get(2);
            let suspension = if let Ok(suspension) = suspension {
                serde_json::from_str(&suspension).unwrap_or(None)
            } else {
                None
            };
            let proc_id: String = row.get(3)?;
            let name: Option<String> = row.get(4)?;
            let module_id: String = row.get(5)?;

            Ok(ProcGetResponse {
                proc_id,
                module_id,
                step_result: StepResult {
                    status,
                    val,
                    suspension,
                },
                name,
            })
        })?;

        Ok(result)
    }

    fn proc_delete(&self, id: &String) -> Result<(), anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare("DELETE FROM procs WHERE id = ?")?;

        let count = stmt.execute(params![id])?;

        if count == 1 {
            Ok(())
        } else {
            Err(anyhow!("proc not found"))
        }
    }

    fn proc_inspect(&self, id: &String) -> Result<ProcStatusDebug, anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt = conn
            .prepare("SELECT steps.frames, steps.funcs FROM procs JOIN steps ON (procs.id = steps.proc_id AND procs.current_step_id = steps.step_id) WHERE procs.id = ?")
            .context("proc_inspect query failed")?;

        let result = stmt.query_row(&[id], |row| {
            let frames: String = row.get(0)?;
            let frames = serde_json::from_str(&frames.as_str()).unwrap();
            let funcs: String = row.get(1)?;
            let funcs = serde_json::from_str(&funcs.as_str()).unwrap();

            Ok(ProcStatusDebug { funcs, frames })
        })?;

        Ok(result)
    }

    fn proc_list(&self) -> Result<Vec<ProcSummary>, anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT procs.id, steps.status, steps.suspension, procs.name, length(steps.snapshot), length(steps.funcs) + length(frames) FROM procs JOIN steps ON (procs.id = steps.proc_id AND procs.current_step_id = steps.step_id)",
        ).context("proc_list query failed")?;

        let result = stmt
            .query_map((), |row| {
                let id: String = row.get(0).unwrap();
                let status: String = row.get(1).unwrap_or("\"CRASHED\"".to_string());
                let status: StepResultStatus =
                    serde_json::from_str(&status).expect("invalid status");
                let suspension: Result<String, _> = row.get(2);
                let suspension = if let Ok(suspension) = suspension {
                    serde_json::from_str(&suspension).unwrap_or(None)
                } else {
                    None
                };
                let name: Option<String> = row.get(3).unwrap_or(None);
                let snapshot_size: u32 = row.get(4).unwrap_or(0);
                let snapshot_v2_size: u32 = row.get(5).unwrap_or(0);

                Ok(ProcSummary {
                    id,
                    name,
                    status,
                    suspension,
                    snapshot_size,
                    snapshot_v2_size,
                })
            })?
            .map(Result::unwrap)
            .collect();

        Ok(result)
    }

    fn module_new(
        &self,
        name: &String,
        src: &String,
        compiled_src: &CompilationResult,
        singleton: Option<u32>,
    ) -> Result<String, anyhow::Error> {
        let id = nanoid!();

        let conn = self.pool.get()?;
        use sha256::digest;
        let hash_sha256 = digest(src.clone());
        let source_map = serde_json::to_string(&compiled_src.source_map)?;
        let pc_to_map = serde_json::to_string(&compiled_src.program_counter_mapping)?;

        conn.execute(
            r#"INSERT INTO modules
            (id, name, src, compiled_src, source_map, pc_to_map, hash_sha256, singleton_version)
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?)"#,
            params![
                &id,
                name,
                src,
                compiled_src.compiled_src,
                &source_map,
                &pc_to_map,
                &hash_sha256,
                &singleton
            ],
        )
        .map_err(|e| match e {
            r2d2_sqlite::rusqlite::Error::SqliteFailure(error, _) => {
                if error.code == r2d2_sqlite::rusqlite::ErrorCode::ConstraintViolation {
                    anyhow!("module already exists")
                } else {
                    anyhow!("module_new failed: {}", e)
                }
            }
            _ => anyhow!("module_new failed: {}", e),
        })?;

        Ok(id)
    }

    fn module_find_by_hash(&self, hash_sha256: &String) -> Result<Option<String>, anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare("SELECT id FROM modules WHERE hash_sha256 = ?")?;

        let result = stmt
            .query_row(params![hash_sha256], |row| {
                let id: String = row.get(0)?;
                Ok(Some(id))
            })
            .unwrap_or(None);

        Ok(result)
    }

    fn module_list(&self) -> Result<Vec<ModuleSummary>, anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt =
            conn.prepare("SELECT id, src, compiled_src, name, singleton_version FROM modules")?;

        let result = stmt
            .query_map((), |row| {
                let id: String = row.get(0)?;
                let src: String = row.get(1)?;
                let compiled_src: String = row.get(2)?;
                let name: String = row.get(3)?;
                let singleton: Option<u32> = row.get(4)?;

                Ok(ModuleSummary {
                    id,
                    src,
                    compiled_src,
                    name,
                    procs: vec![],
                    singleton,
                })
            })?
            .map(Result::unwrap)
            .collect();

        Ok(result)
    }

    fn module_edit(
        &self,
        module_id: &String,
        new_src: &String,
        compiled_src: &String,
    ) -> Result<(), anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare("UPDATE modules SET src = ?, compiled_src = ? WHERE id = ?")?;

        stmt.execute(params![new_src, compiled_src, module_id])?;

        Ok(())
    }

    fn module_get(&self, module_id: &String) -> Result<ModuleSummary, anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, src, compiled_src, name, singleton_version FROM modules WHERE id = ?",
        )?;

        let (id, src, compiled_src, name, singleton) = stmt.query_row(&[module_id], |row| {
            let id: String = row.get(0)?;
            let src: String = row.get(1)?;
            let compiled_src: String = row.get(2)?;
            let name: String = row.get(3)?;
            let singleton: Option<u32> = row.get(4)?;

            Ok((id, src, compiled_src, name, singleton))
        })?;

        let mut stmt = conn.prepare("SELECT id FROM procs WHERE module_id = ?")?;
        let procs = stmt.query_map(&[module_id], |row| row.get(0))?;
        let mut proc_vec = Vec::new();
        for proc in procs {
            proc_vec.push(proc?);
        }

        let result = ModuleSummary {
            id,
            src,
            compiled_src,
            name,
            singleton,
            procs: proc_vec,
        };

        Ok(result)
    }

    fn proc_rename_if_exists(
        &self,
        old_name: &String,
        new_name: &String,
    ) -> Result<(), anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare("UPDATE procs SET name = ? WHERE name = ?")?;
        stmt.execute(params![new_name, old_name])?;
        Ok(())
    }

    fn proc_subscriptions_get_all(
        &self,
    ) -> Result<Vec<(String, serde_json::Value)>, anyhow::Error> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare("SELECT proc_id, subscription FROM proc_subscriptions")?;

        let result = stmt
            .query_map((), |row| {
                let proc_id: String = row.get(0)?;
                let subscription: String = row.get(1)?;
                let subscription = serde_json::from_str(subscription.as_str()).unwrap();

                Ok((proc_id, subscription))
            })?
            .map(Result::unwrap)
            .collect();

        Ok(result)
    }

    fn proc_subscription_new(
        &self,
        proc_id: &String,
        subscription: &serde_json::Value,
    ) -> Result<String, anyhow::Error> {
        let id = nanoid!();

        let conn = self.pool.get()?;

        let subscription = serde_json::to_string(subscription)?;

        conn.execute(
            "INSERT INTO proc_subscriptions (id, proc_id, subscription) VALUES (?, ?, ?)",
            params![&id, proc_id, subscription],
        )?;

        Ok(id)
    }
}

fn is_proc_id(s: &String) -> bool {
    s.len() == 21
}
