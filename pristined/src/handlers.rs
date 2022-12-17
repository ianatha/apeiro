use actix_web::error::{self, ErrorBadRequest};
use actix_web::{get, post, put, web, HttpRequest, Responder};
use pristine_engine::DEngine;
use pristine_internal_api::*;

#[post("/proc/")]
async fn proc_new(
    _req: HttpRequest,
    body: web::Json<ProcNewRequest>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let res = dengine
        .proc_new(body.into_inner())
        .await
        .expect("failed to run");
    Ok::<_, actix_web::Error>(web::Json(res))
}

#[get("/proc/")]
async fn proc_list(_req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let res = dengine.proc_list().await;
    Ok::<_, actix_web::Error>(web::Json(res))
}

#[get("/proc/{pid}")]
async fn proc_get(req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let pid: String = req
        .match_info()
        .get("pid")
        .ok_or(ErrorBadRequest("no mount name"))?
        .parse()?;

    let res = dengine
        .proc_get(pid)
        .await
        .map_err(|_e| error::ErrorInternalServerError("db problem"))?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[put("/proc/{pid}")]
async fn proc_send(
    req: HttpRequest,
    body: web::Json<ProcSendRequest>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("pid")
        .ok_or(ErrorBadRequest("no mount name"))?
        .parse()?;

    let res = dengine
        .proc_send(proc_id, body.into_inner())
        .await
        .map_err(|_e| error::ErrorInternalServerError("db problem"))?;
    Ok::<_, actix_web::Error>(web::Json(res))
}
