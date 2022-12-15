use crate::db;
use crate::db::DbPool;
use actix_web::error::{self, ErrorBadRequest};
use actix_web::{get, post, put, web, HttpRequest, Responder};
use pristine_engine::pristine_bundle_and_compile;
use pristine_internal_api::*;

#[post("/proc/")]
async fn proc_new(
    _req: HttpRequest,
    body: web::Json<ProcNewRequest>,
    pool: web::Data<DbPool>,
) -> impl Responder {
    let conn = pool.get().map_err(|_e| error::ErrorBadRequest("no conn"))?;

    let src = body.src.clone();
    let compiled_src =
        tokio::task::spawn_blocking(move || pristine_bundle_and_compile(src).unwrap())
            .await
            .unwrap();
    println!("compiled_src: {}", compiled_src);
    // let compiled_src = pristine_compile(body.src.clone()).unwrap();

    let proc_id = db::proc_new(&conn, &body.src, &compiled_src).unwrap();

    let mut engine = pristine_engine::Engine::new(Some(pristine_engine::get_engine_runtime));

    let (res, snapshot) = engine
        .step_process(
            Some(compiled_src),
            None,
            "$step($usercode().default)".into(),
        )
        .await
        .unwrap();

    db::proc_update(&conn, &proc_id, &res, &snapshot).unwrap();

    Ok::<_, actix_web::Error>(web::Json(ProcNewOutput {
        id: proc_id,
        state: res,
    }))
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

#[put("/proc/{pid}")]
async fn proc_send(
    req: HttpRequest,
    body: web::Json<ProcSendRequest>,
    pool: web::Data<DbPool>,
) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("pid")
        .ok_or(ErrorBadRequest("no mount name"))?
        .parse()?;

    let conn = pool.get().map_err(|_e| error::ErrorBadRequest("no conn"))?;

    let proc = db::proc_get_details(&conn, &proc_id)
        .map_err(|_e| error::ErrorInternalServerError("db problem"))?;

    if proc.state.status != StepResultStatus::SUSPEND {
        Err(error::ErrorBadRequest("can only send to suspended procs"))
    } else {
        let mut engine = pristine_engine::Engine::new_with_name(Some(pristine_engine::get_engine_runtime), proc_id.clone());

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

        Ok::<_, actix_web::Error>(web::Json(res))
    }
}
