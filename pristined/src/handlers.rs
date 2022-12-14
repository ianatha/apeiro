use crate::db;
use crate::db::DbPool;
use actix_web::error::{self, ErrorBadRequest};
use actix_web::{get, post, web, HttpRequest, Responder};
use pristine_engine::pristine_compile;
use pristine_internal_api::*;

#[post("/proc/")]
async fn proc_new(
    _req: HttpRequest,
    body: web::Json<ProcNewRequest>,
    pool: web::Data<DbPool>,
) -> impl Responder {
    let conn = pool.get().map_err(|_e| error::ErrorBadRequest("no conn"))?;

    let compiled_src = pristine_compile(body.src.clone()).unwrap();

    let proc_id = db::proc_new(&conn, &body.src, &compiled_src).unwrap();

    let mut engine = pristine_engine::Engine::new(Some(pristine_engine::get_engine_runtime));

    let (res, snapshot) = engine
        .step_process(Some(compiled_src), None, "$step(main)".into())
        .await
        .unwrap();

    db::proc_update(&conn, &proc_id, &res, &snapshot).unwrap();

    Ok::<_, actix_web::Error>(web::Json((proc_id, res)))
}

#[get("/proc/")]
async fn proc_list(_req: HttpRequest, pool: web::Data<DbPool>) -> impl Responder {
    let conn = pool.get().map_err(|_e| error::ErrorBadRequest("no conn"))?;
    let procs = db::proc_list(&conn).map_err(|_e| error::ErrorInternalServerError("db problem"))?;

    Ok::<_, actix_web::Error>(web::Json(ProcListOutput { procs }))
}

#[get("/proc/{pid}")]
async fn proc_get(req: HttpRequest, pool: web::Data<DbPool>) -> impl Responder {
    let pid: String = req
        .match_info()
        .get("pid")
        .ok_or(ErrorBadRequest("no mount name"))?
        .parse()?;

    let conn = pool.get().map_err(|_e| error::ErrorBadRequest("no conn"))?;
    let res =
        db::proc_get(&conn, &pid).map_err(|_e| error::ErrorInternalServerError("db problem"))?;

    Ok::<_, actix_web::Error>(web::Json(res))
}
