use actix_web::error::{self, ErrorBadRequest};
use actix_web::{get, post, put, web, HttpRequest, HttpResponse, Responder};
use pristine_engine::DEngine;
use pristine_internal_api::*;
use tracing::{event, instrument, Level};

fn pristine_err(e: anyhow::Error) -> PristineError {
    PristineError(e)
}

struct PristineError(anyhow::Error);

impl From<PristineError> for actix_web::Error {
    fn from(e: PristineError) -> Self {
        error::ErrorBadRequest(serde_json::json! {{
            "Err": {
                "error": e.0.to_string()
            }
        }})
    }
}

#[instrument]
#[post("/proc/")]
async fn proc_new(
    _req: HttpRequest,
    body: web::Json<ProcNewRequest>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let res = dengine
        .proc_new(body.into_inner())
        .await
        .map_err(pristine_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[instrument]
#[get("/proc/")]
async fn proc_list(_req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let res = dengine.proc_list().await.map_err(pristine_err)?;
    Ok::<_, actix_web::Error>(web::Json(res))
}

#[instrument]
#[get("/proc/{proc_id}")]
async fn proc_get(req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("proc_id")
        .ok_or(ErrorBadRequest("no mount name"))?
        .parse()?;

    let res = dengine.proc_get(proc_id).await.map_err(pristine_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[instrument]
#[get("/proc/{proc_id}/debug")]
async fn proc_get_debug(req: HttpRequest, dengine: web::Data<DEngine>) -> impl Responder {
    let proc_id: String = req
        .match_info()
        .get("proc_id")
        .ok_or(ErrorBadRequest("no mount name"))?
        .parse()?;

    let res = dengine.proc_get_debug(proc_id).await.map_err(pristine_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[instrument]
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
        .map_err(pristine_err)?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[instrument]
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

    let mut res = dengine
        .proc_watch(proc_id)
        .await
        .map_err(|_e| error::ErrorInternalServerError("db problem"))
        .unwrap();

    let stream = async_stream::stream! {
        while res.changed().await.is_ok() {
            let val = res.borrow().clone();
            event!(Level::INFO, "sending update to sse");
            let mut byt: Vec<u8> = vec![b'd', b'a', b't', b'a', b':', b' '];
            let mut json = serde_json::to_vec(&val).unwrap();
            byt.append(&mut json);
            byt.push(b'\n');
            byt.push(b'\n');

            let byte = web::Bytes::from(byt);

            yield Ok::<web::Bytes, actix_web::Error>(byte)
        };
        event!(Level::INFO, "sse stream ended");
    };

    HttpResponse::Ok()
        .append_header(("content-type", "text/event-stream"))
        .no_chunking(4096)
        .streaming(stream)
    // Ok::<_, actix_web::Error>(web::Json(res))
}
