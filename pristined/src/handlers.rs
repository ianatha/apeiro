use std::pin::Pin;
use std::task::Poll;

use actix_web::error::{self, ErrorBadRequest};
use actix_web::{get, post, put, web, HttpRequest, HttpResponse, Responder};
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
    let pid: String = req
        .match_info()
        .get("pid")
        .ok_or(ErrorBadRequest("no pid"))?
        .parse()?;

    let res = dengine
        .proc_send_and_watch_step_result(pid, body.into_inner())
        .await
        .map_err(|_e| error::ErrorInternalServerError("db problem"))?;

    Ok::<_, actix_web::Error>(web::Json(res))
}

#[get("/proc/{pid}/watch")]
async fn proc_watch(
    req: HttpRequest,
    // body: web::Json<ProcSendRequest>,
    dengine: web::Data<DEngine>,
) -> impl Responder {
    let pid: String = req
        .match_info()
        .get("pid")
        .ok_or(ErrorBadRequest("no pid"))
        .unwrap()
        .parse()
        .unwrap();

    let mut res = dengine
        .proc_watch(pid)
        .await
        .map_err(|_e| error::ErrorInternalServerError("db problem"))
        .unwrap();

    let stream = async_stream::stream! {
        while res.changed().await.is_ok() {
            let val = res.borrow().clone();
            println!("sending update to sse");
            let mut byt: Vec<u8> = vec![b'd', b'a', b't', b'a', b':', b' '];
            let mut json = serde_json::to_vec(&val).unwrap();
            byt.append(&mut json);
            byt.push(b'\n');
            byt.push(b'\n');

            let byte = web::Bytes::from(byt);

            yield Ok::<web::Bytes, actix_web::Error>(byte)
        };
        println!("sse stream ended");
    };

    HttpResponse::Ok()
        .append_header(("content-type", "text/event-stream"))
        .no_chunking(4096)
        .streaming(stream)
    // Ok::<_, actix_web::Error>(web::Json(res))
}
