use actix_web::{
    delete,
    error::{self, ErrorBadRequest},
    get, post, put, web, HttpRequest, HttpResponse, Responder,
};
use apeiro_engine::DEngine;
use apeiro_internal_api::*;
use tracing::{event, Level};

fn apeiro_err(e: anyhow::Error) -> ApeiroError {
    ApeiroError(e)
}

pub struct ApeiroError(anyhow::Error);

impl ApeiroError {
    pub fn new(e: anyhow::Error) -> Self {
        ApeiroError(e)
    }
}

impl From<ApeiroError> for actix_web::Error {
    fn from(e: ApeiroError) -> Self {
        let e0_to_string = e.0.to_string();
        let downcasted = e.0.downcast::<apeiro_engine::PristineRunError>();
        if let Ok(runerror) = downcasted {
            error::ErrorBadRequest(serde_json::json! {{
                "Err": {
                    "msg": runerror.msg,
                    "frames": serde_json::to_value(runerror.frames).unwrap(),
                }
            }})
        } else {
            error::ErrorBadRequest(serde_json::json! {{
                "Err": {
                    "error": e0_to_string
                }
            }})
        }
    }
}

#[post("/proc/")]
async fn proc_new(
    _req: HttpRequest,
    body: web::Json<ProcNewRequest>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let res = dengine
        .proc_new(body.into_inner())
        .await
        .map_err(apeiro_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[get("/proc/")]
async fn proc_list(_req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let res = dengine.proc_list().await.map_err(apeiro_err)?;
    Ok::<_, actix_web::Error>(web::Json(res))
}

#[get("/proc/{proc_id}")]
async fn proc_get(req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("proc_id")
        .ok_or(ErrorBadRequest("no module name"))?
        .parse()?;

    let res = dengine.proc_get(proc_id).await.map_err(apeiro_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[delete("/proc/{proc_id}")]
async fn proc_delete(req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("proc_id")
        .ok_or(ErrorBadRequest("no module name"))?
        .parse()?;

    dengine.proc_delete(proc_id).await.map_err(apeiro_err)?;

    Ok::<_, actix_web::Error>("")
}

#[get("/proc/{proc_id}/debug")]
async fn proc_get_debug(req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("proc_id")
        .ok_or(ErrorBadRequest("no module name"))?
        .parse()?;

    let res = dengine.proc_get_debug(proc_id).await.map_err(apeiro_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[put("/proc/{proc_id}")]
async fn proc_send(
    req: HttpRequest,
    body: web::Json<ProcSendRequest>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("proc_id")
        .ok_or(ErrorBadRequest("no proc_id"))?
        .parse()?;

    let res = dengine
        .proc_send_and_watch_step_result(proc_id, body.into_inner())
        .await
        .map_err(apeiro_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[post("/proc/{proc_id}")]
async fn proc_post_send(
    req: HttpRequest,
    body: web::Json<serde_json::Value>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("proc_id")
        .ok_or(ErrorBadRequest("no proc_id"))?
        .parse()?;

    let res = dengine
        .proc_send_and_watch_step_result(
            proc_id,
            ProcSendRequest {
                msg: body.into_inner(),
            },
        )
        .await
        .map_err(apeiro_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[get("/stats")]
async fn stats(_req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let res = dengine.watch_stats().await;
    Ok::<_, actix_web::Error>(web::Json(res))
}

#[get("/proc/{proc_id}/watch")]
async fn proc_watch(
    req: HttpRequest,
    // body: web::Json<ProcSendRequest>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("proc_id")
        .ok_or(ErrorBadRequest("no proc_id"))
        .unwrap()
        .parse()
        .unwrap();

    let stream = async_stream::stream! {
        let mut res = dengine
            .proc_watch(proc_id)
            .await
            .map_err(|_e| error::ErrorInternalServerError("db problem"))?;

        let mut interval = tokio::time::interval(std::time::Duration::from_secs(2));

        loop {
            tokio::select! {
                // workaround for Stream/Recever doesn't get dropped when client disconnects
                _ = interval.tick() => {
                    let mut byt: Vec<u8> = vec![b'e', b'v', b'e', b'n', b't', b':', b' ', b'p', b'i', b'n', b'g'];
                    byt.push(b'\n');
                    byt.push(b'\n');
                    let byte = web::Bytes::from(byt);
                    yield Ok::<web::Bytes, actix_web::Error>(byte)
                }
                changed = res.changed() => {
                    if !changed.is_ok() {
                        event!(Level::ERROR, "changed is not ok");
                        return;
                    }

                    let val = res.borrow().clone();
                    event!(Level::INFO, "sending update to sse");
                    let mut byt: Vec<u8> = vec![b'd', b'a', b't', b'a', b':', b' '];
                    let mut json = serde_json::to_vec(&val).unwrap();
                    byt.append(&mut json);
                    byt.push(b'\n');
                    byt.push(b'\n');

                    let byte = web::Bytes::from(byt);

                    yield Ok::<web::Bytes, actix_web::Error>(byte)
                }
            }
        }
    };

    HttpResponse::Ok()
        .append_header(("content-type", "text/event-stream"))
        .no_chunking(4096)
        .streaming(stream)
    // Ok::<_, actix_web::Error>(web::Json(res))
}

#[get("/module/")]
async fn module_list(_req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let res = dengine.module_list().await.map_err(apeiro_err)?;
    Ok::<_, actix_web::Error>(web::Json(res))
}

#[get("/module/{module_id}")]
async fn module_get(req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let module_id: String = req
        .match_info()
        .get("module_id")
        .ok_or(ErrorBadRequest("no module_id"))?
        .parse()?;

    let res = dengine.module_get(module_id).await.map_err(apeiro_err)?;
    Ok::<_, actix_web::Error>(web::Json(res))
}

#[put("/module/{module_id}")]
async fn module_edit(
    req: HttpRequest,
    body: web::Json<ModuleEditRequest>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let module_id: String = req
        .match_info()
        .get("module_id")
        .ok_or(ErrorBadRequest("no module_id"))?
        .parse()?;

    let res = dengine
        .module_edit(module_id, body.src.clone())
        .await
        .map_err(apeiro_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[post("/module/")]
async fn module_new(
    _req: HttpRequest,
    body: web::Json<ModuleNewRequest>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let module_id = dengine
        .module_new(body.into_inner())
        .await
        .map_err(apeiro_err)?;

    // if body.mode.map_or(false, |x| { x == ModuleMode::Singleton }) {
    //     let res = dengine
    //         .proc_new(ProcNewRequest { module_id: module_id.clone(), name })
    //         .await
    //         .map_err(apeiro_err)?;

    //     Ok::<_, actix_web::Error>(web::Json(serde_json::json!({ "mid": module_id, "pid": res.proc_id })))
    // } else {
    Ok::<_, actix_web::Error>(web::Json(serde_json::json!({ "mid": module_id })))
    // }
}

#[post("/helper_extract_export_name")]
async fn helper_extract_export_name(
    _req: HttpRequest,
    body: String,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let name = dengine.extract_export_name(body);
    Ok::<_, actix_web::Error>(web::Json(serde_json::json!({ "name": name })))
}
