use crate::StepResultStatus;
use anyhow::anyhow;
use nanoid::nanoid;
use pristine_internal_api::{EngineStatus, ProcStatusDebug, ProcSummary, StepResult};
use r2d2::PooledConnection;
use r2d2_sqlite::rusqlite::params;
use r2d2_sqlite::SqliteConnectionManager;
use serde_json;

pub type Conn = PooledConnection<SqliteConnectionManager>;

pub fn proc_new(
    conn: &Conn,
    src: &String,
    name: &Option<String>,
    compiled_src: &String,
) -> Result<String, anyhow::Error> {
    let id = nanoid!();

    conn.execute(
        "INSERT INTO procs (id, name, src, compiled_src) VALUES (?, ?, ?, ?)",
        params![&id, name, src, compiled_src],
    )?;

    Ok(id)
}

pub fn proc_update(
    conn: &Conn,
    id: &String,
    state: &StepResult,
    engine_status: &EngineStatus,
) -> Result<(), anyhow::Error> {
    let frames_json = serde_json::to_string(&engine_status.frames).unwrap();
    let funcs_json = serde_json::to_string(&engine_status.funcs).unwrap();

    conn.execute(
        "UPDATE procs SET status=?, val=?, suspension=?, frames=?, funcs=? WHERE id=?",
        params![
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
            id
        ],
    )?;

    Ok(())
}

pub struct ProcDetails {
    pub compiled_src: String,
    pub engine_status: EngineStatus,
    pub state: StepResult,
}

pub fn proc_get_details(conn: &Conn, id: &String) -> Result<ProcDetails, anyhow::Error> {
    let mut stmt = conn.prepare("SELECT compiled_src, frames, funcs FROM procs WHERE id = ?")?;

    let state = proc_get(conn, id)?;

    let result = stmt.query_row(&[id], |row| {
        let compiled_src: String = row.get(0)?;
        let frames: String = row.get(1)?;
        let frames: Option<serde_json::Value> = serde_json::from_str(&frames).unwrap();
        let funcs: String = row.get(2)?;
        let funcs: Option<serde_json::Value> = serde_json::from_str(&funcs).unwrap();
        let engine_status = EngineStatus { frames, funcs };
        Ok(ProcDetails {
            compiled_src,
            engine_status,
            state,
        })
    })?;

    Ok(result)
}

pub fn proc_get(conn: &Conn, id: &String) -> Result<StepResult, anyhow::Error> {
    let mut stmt = conn.prepare("SELECT status, val, suspension FROM procs WHERE id = ?")?;
    // frames, funcs

    let result = stmt.query_row(&[id], |row| {
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

        // let frames: Result<String, _> = row.get(3);
        // let frames = if let Ok(frames) = frames {
        //     serde_json::from_str(&frames).unwrap_or(None)
        // } else {
        //     None
        // };
        // let funcs: Result<String, _> = row.get(4);
        // let funcs = if let Ok(funcs) = funcs {
        //     serde_json::from_str(&funcs).unwrap_or(None)
        // } else {
        //     None
        // };

        Ok(StepResult {
            status,
            val,
            suspension,
        })
    })?;

    Ok(result)
}

pub fn proc_delete(conn: &Conn, id: &String) -> Result<(), anyhow::Error> {
    let mut stmt = conn.prepare("DELETE FROM procs WHERE id = ?")?;

    let count = stmt.execute(params![id])?;

    if count == 1 {
        Ok(())
    } else {
        Err(anyhow!("proc not found"))
    }
}

pub fn proc_inspect(conn: &Conn, id: &String) -> Result<ProcStatusDebug, anyhow::Error> {
    let mut stmt = conn.prepare("SELECT frames, compiled_src, funcs FROM procs WHERE id = ?")?;

    let result = stmt.query_row(&[id], |row| {
        let frames: String = row.get(0)?;
        let compiled_src = row.get(1)?;
        let frames = serde_json::from_str(&frames.as_str()).unwrap();
        let funcs: String = row.get(2)?;
        let funcs = serde_json::from_str(&funcs.as_str()).unwrap();

        Ok(ProcStatusDebug {
            funcs,
            frames,
            compiled_src,
        })
    })?;

    Ok(result)
}
pub fn proc_list(conn: &Conn) -> Result<Vec<ProcSummary>, anyhow::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, status, suspension, name, 0, length(funcs) + length(frames) FROM procs",
    )?;

    let result = stmt
        .query_map((), |row| {
            let id: String = row.get(0).unwrap();
            let status: String = row.get(1).unwrap_or("\"CRASHED\"".to_string());
            let status: StepResultStatus = serde_json::from_str(&status).expect("invalid status");
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
