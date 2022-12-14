use actix_web::{get, web, HttpRequest, Responder};
use pristine_internal_api::ProcListOutput;

#[get("/proc/")]
async fn proc_list(_req: HttpRequest) -> impl Responder {
    web::Json(ProcListOutput { procs: vec![] })
}
