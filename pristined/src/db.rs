use nanoid::nanoid;
use pristine_engine::StepResultStatus;
use pristine_internal_api::{ProcSummary, StepResult};
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::rusqlite::{params};
use r2d2_sqlite::SqliteConnectionManager;
use serde_json;

pub type DbPool = Pool<SqliteConnectionManager>;
pub type Conn = PooledConnection<SqliteConnectionManager>;

pub fn establish_connection(file: String) -> Result<DbPool, anyhow::Error> {
    let manager = SqliteConnectionManager::file(file);
    let pool = Pool::builder().build(manager)?;
    Ok(pool)
}

#[cfg(test)]
pub fn establish_connection_memory() -> Result<DbPool, anyhow::Error> {
    let manager = SqliteConnectionManager::memory();
    let pool = Pool::builder().build(manager)?;
    Ok(pool)
}

pub fn init_db(pool: &DbPool) -> Result<(), anyhow::Error> {
    let conn = pool.get()?;

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

pub fn proc_get(conn: &Conn, id: &String) -> Result<StepResult, anyhow::Error> {
    let mut stmt = conn.prepare("SELECT status, val, suspension FROM procs WHERE id = ?")?;

    let result = stmt.query_row(&[id], |row| {
        let status: String = row.get(0).unwrap();
        println!("status: {}", status);
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
        })
    })?;

    Ok(result)
}

pub fn proc_list(conn: &Conn) -> Result<Vec<ProcSummary>, anyhow::Error> {
    let mut stmt = conn.prepare("SELECT id FROM procs")?;

    let result = stmt
        .query_map((), |row| {
            let id: String = row.get(0).unwrap();
            Ok(ProcSummary { id })
        })?
        .map(Result::unwrap)
        .collect();

    Ok(result)
}
