use crate::StepResultStatus;
use nanoid::nanoid;
use pristine_internal_api::{ProcSummary, StepResult};
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::rusqlite::params;
use r2d2_sqlite::SqliteConnectionManager;
use serde_json;

pub type DbPool = Pool<SqliteConnectionManager>;
pub type Conn = PooledConnection<SqliteConnectionManager>;

pub fn proc_new(conn: &Conn, src: &String, compiled_src: &String) -> Result<String, anyhow::Error> {
    let id = nanoid!();

    conn.execute(
        "INSERT INTO procs (id, src, compiled_src) VALUES (?, ?, ?)",
        &[&id, src, compiled_src],
    )?;

    Ok(id)
}

pub fn proc_update(
    conn: &Conn,
    id: &String,
    state: &StepResult,
    snapshot: &Vec<u8>,
) -> Result<(), anyhow::Error> {
    conn.execute(
        "UPDATE procs SET status=?, val=?, suspension=?, snapshot=? WHERE id=?",
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
            snapshot,
            id
        ],
    )?;

    Ok(())
}

pub struct ProcDetails {
    pub compiled_src: String,
    pub snapshot: Vec<u8>,
    pub state: StepResult,
}

pub fn proc_get_details(conn: &Conn, id: &String) -> Result<ProcDetails, anyhow::Error> {
    let mut stmt = conn.prepare("SELECT compiled_src, snapshot FROM procs WHERE id = ?")?;

    let state = proc_get(conn, id)?;

    let result = stmt.query_row(&[id], |row| {
        let compiled_src: String = row.get(0)?;
        let snapshot: Vec<u8> = row.get(1)?;
        Ok(ProcDetails {
            compiled_src,
            snapshot,
            state,
        })
    })?;

    Ok(result)
}

pub fn proc_get(conn: &Conn, id: &String) -> Result<StepResult, anyhow::Error> {
    let mut stmt = conn.prepare("SELECT status, val, suspension FROM procs WHERE id = ?")?;

    let result = stmt.query_row(&[id], |row| {
        let status: String = row.get(0).unwrap();
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

        Ok(StepResult {
            status,
            val,
            suspension,
            ..Default::default()
        })
    })?;

    Ok(result)
}

pub fn proc_list(conn: &Conn) -> Result<Vec<ProcSummary>, anyhow::Error> {
    let mut stmt = conn.prepare("SELECT id, status, suspension FROM procs")?;

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
    
            Ok(ProcSummary { id, status, suspension })
        })?
        .map(Result::unwrap)
        .collect();

    Ok(result)
}
