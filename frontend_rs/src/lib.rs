use std::string::String;

#[derive(rust_embed::RustEmbed)]
#[folder = "../frontend/out/"]
struct Frontend;

fn nextjs_routing(path: &str) -> String {
    let segments: Vec<&str> = path.trim_matches('/').split('/').collect();
    match segments.as_slice() {
        [] | [""] => "index.html".to_string(),
        [single] => format!("{}.html", single),
        ["procs", _pid] => "procs/[pid].html".to_string(),
        ["modules", "new"] => "modules/new.html".to_string(),
        ["modules", _mid] => "modules/[mid].html".to_string(),
        x => x.join("/"),
    }
}

pub async fn web(addr: impl Into<std::net::SocketAddr>) {
    use warp::{filters::path::Tail, Filter};

    let direct_serve = warp::path::tail().and_then(|tail: Tail| async move {
        let tail = match percent_encoding::percent_decode_str(tail.as_str()).decode_utf8() {
            Result::Ok(x) => x.into_owned(),
            Result::Err(_) => return Result::Err(warp::reject::not_found()),
        };
        let tail = tail.as_str();
        if let Some(x) = Frontend::get(tail) {
            Result::Ok(create_reply(x, tail))
        } else {
            let mapped = nextjs_routing(tail);
            if let Some(x) = Frontend::get(mapped.as_str()) {
                Result::Ok(create_reply(x, tail))
            } else {
                return Result::Err(warp::reject::not_found());
            }
        }
    });

    let data_serve = warp::get().and(direct_serve);

    warp::serve(data_serve).run(addr).await;
}

struct EmbedFile {
    data: std::borrow::Cow<'static, [u8]>,
}

impl warp::reply::Reply for EmbedFile {
    fn into_response(self) -> warp::reply::Response {
        warp::reply::Response::new(self.data.into())
    }
}

fn create_reply(file: rust_embed::EmbeddedFile, actual_name: &str) -> impl warp::reply::Reply {
    // if actual_name ends in .js, or .css or .html, then we can guess the content type
    let mime_type = if actual_name.ends_with(".js") {
        "text/javascript"
    } else if actual_name.ends_with(".css") {
        "text/css"
    } else if actual_name.ends_with(".html") {
        "text/html"
    } else {
        ""
    };
    warp::reply::with_header(
        EmbedFile { data: file.data },
        "Content-Type",
        mime_type.to_string(),
    )
}
