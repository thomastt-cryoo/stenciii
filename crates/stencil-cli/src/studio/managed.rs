//! Read-only loopback hosting for the packaged browser edition.
//! The launcher's stdin pipe is the lifetime owner, including after a crash.
use std::{collections::{HashMap,HashSet}, io::{Read, Write}, sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}}, time::{Duration, Instant}};
use tiny_http::{Header, Method, Request, Response, Server};

struct Session {
    id: String,
    clients: HashSet<u64>,
    next_client: u64,
    ever_connected: bool,
    last_page: Instant,
    idle: Duration,
}

struct Lease { session: Arc<Mutex<Session>>, client: u64 }
impl Drop for Lease {
    fn drop(&mut self) {
        let mut session=self.session.lock().unwrap();
        session.clients.remove(&self.client);session.last_page=Instant::now();
    }
}

pub(super) fn run(arguments: &[String]) {
    let mut preferred = 5173u16;
    let mut idle = 8u64;
    let mut it = arguments.iter();
    while let Some(argument) = it.next() {
        match argument.as_str() {
            "--managed" | "--no-open" => {},
            "--port" | "-p" => preferred = it.next().and_then(|v| v.parse().ok()).unwrap_or_else(|| super::super::fail("--port needs a number")),
            "--idle-timeout" => idle = it.next().and_then(|v| v.parse().ok()).filter(|v| *v <= 3600).unwrap_or_else(|| super::super::fail("--idle-timeout needs 0..3600 seconds")),
            _ => super::super::fail("usage: stencil studio --managed [--port N] [--idle-timeout SECONDS]"),
        }
    }
    // Binding is atomic: a port is never probed, released, and raced by a child.
    let server = Arc::new(Server::http(("127.0.0.1", preferred)).or_else(|_| Server::http(("127.0.0.1", 0))).unwrap_or_else(|error| super::super::fail(&format!("Studio cannot open a local address: {error}"))));
    let port = server.server_addr().to_ip().unwrap().port();
    let mut random = [0u8; 24];
    getrandom::fill(&mut random).unwrap_or_else(|error| super::super::fail(&format!("Studio cannot create a local session: {error}")));
    let id: String = random.iter().map(|byte| format!("{byte:02x}")).collect();
    let session = Arc::new(Mutex::new(Session {id, clients: HashSet::new(), next_client:0, ever_connected: false, last_page: Instant::now(), idle: Duration::from_secs(idle)}));
    let stop = Arc::new(AtomicBool::new(false));
    let parent_stop = stop.clone();
    std::thread::spawn(move || {
        let mut input = std::io::stdin().lock();
        let mut buffer = [0; 256];
        while let Ok(count) = input.read(&mut buffer) { if count == 0 { break; } }
        parent_stop.store(true, Ordering::Release);
    });
    let packed: Arc<Mutex<HashMap<String, Arc<Vec<u8>>>>> = Default::default();
    let mut workers = Vec::new();
    for _ in 0..4 {
        let (server, session, stop, packed) = (server.clone(), session.clone(), stop.clone(), packed.clone());
        workers.push(std::thread::spawn(move || {
            while !stop.load(Ordering::Acquire) {
                match server.recv_timeout(Duration::from_millis(150)) {
                    Ok(Some(request)) => serve(request, port, &session, &packed),
                    Ok(None) => {},
                    Err(_) => break,
                }
            }
        }));
    }
    println!("{}", serde_json::json!({"schema":1,"studio":"stencil-studio","version":env!("CARGO_PKG_VERSION"),"pid":std::process::id(),"port":port,"preferredPort":preferred,"url":format!("http://localhost:{port}/"),"fallback":preferred!=0 && preferred!=port}));
    let _ = std::io::stdout().flush();
    while !stop.load(Ordering::Acquire) {
        std::thread::sleep(Duration::from_millis(150));
        let state = session.lock().unwrap();
        let lifetime = state.idle;
        if !lifetime.is_zero() && state.ever_connected && state.clients.is_empty() && state.last_page.elapsed() >= lifetime {
            stop.store(true, Ordering::Release);
        }
    }
    // A paused/disconnected browser must not keep a managed server alive forever
    // in a blocked socket write. This child owns no customer files.
    let deadline = Instant::now() + Duration::from_secs(2);
    while workers.iter().any(|worker| !worker.is_finished()) && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(25));
    }
    for worker in workers { if worker.is_finished() { let _ = worker.join(); } }
}

fn header(name: &str, value: &str) -> Header { Header::from_bytes(name, value).unwrap() }
fn request_header(request: &Request, name: &'static str) -> Option<String> {
    request.headers().iter().find(|h| h.field.equiv(name)).map(|h| h.value.as_str().to_owned())
}
fn headers() -> Vec<Header> {
    [
        ("Cross-Origin-Opener-Policy", "same-origin"),
        ("Cross-Origin-Embedder-Policy", "require-corp"),
        ("Cross-Origin-Resource-Policy", "same-origin"),
        ("X-Content-Type-Options", "nosniff"),
        ("X-Frame-Options", "DENY"),
        ("Referrer-Policy", "no-referrer"),
        ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
        ("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' blob: ws://localhost:* ws://127.0.0.1:*; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"),
    ].iter().map(|(name, value)| header(name, value)).collect()
}
fn reply(request: Request, status: u16, body: Vec<u8>, mime: &str, extra: Vec<Header>) {
    let mut response = Response::from_data(body).with_status_code(status).with_header(header("Content-Type", mime));
    for h in headers().into_iter().chain(extra) { response.add_header(h); }
    let _ = request.respond(response);
}
fn reject(request: Request, status: u16, text: &str) { reply(request, status, text.as_bytes().to_vec(), "text/plain; charset=utf-8", vec![header("Cache-Control", "no-store")]); }

fn serve(request: Request, port: u16, session: &Arc<Mutex<Session>>, packed: &Mutex<HashMap<String, Arc<Vec<u8>>>>) {
    let allowed_hosts = [format!("localhost:{port}"), format!("127.0.0.1:{port}")];
    if !request_header(&request, "Host").is_some_and(|host| allowed_hosts.iter().any(|allowed| host.eq_ignore_ascii_case(allowed))) {
        reject(request, 403, "This Studio address is local only."); return;
    }
    let origins = [format!("http://localhost:{port}"), format!("http://127.0.0.1:{port}")];
    if request_header(&request, "Origin").is_some_and(|origin| !origins.contains(&origin)) {
        reject(request, 403, "A different website cannot access Studio."); return;
    }
    let raw = request.url().split(['?', '#']).next().unwrap_or("/");
    let Ok(path) = percent_encoding::percent_decode_str(raw).decode_utf8() else { reject(request, 400, "Invalid local path."); return; };
    let path = path.into_owned();
    if !path.starts_with('/') || path.starts_with("//") || path.contains(['\\', '\0', ':']) || path.split('/').any(|p| p==".." || p==".") {
        reject(request, 400, "Unsafe local path."); return;
    }
    if path == "/__studio/session" && request.method() == &Method::Get {
        let state = session.lock().unwrap();
        let body = serde_json::to_vec(&serde_json::json!({"schema":1,"managed":true,"transport":"websocket","session":state.id,"version":env!("CARGO_PKG_VERSION")})).unwrap();
        reply(request, 200, body, "application/json", vec![header("Cache-Control", "no-store")]); return;
    }
    if path == "/__studio/lease" && request.method() == &Method::Get {
        // A connection, rather than a short heartbeat timeout, keeps background
        // tabs and long batches alive even when a browser throttles its timers.
        let token=request.url().split_once('?').and_then(|(_,q)|q.split('&').find_map(|part|part.strip_prefix("session=")));
        let key=request_header(&request,"Sec-WebSocket-Key");
        let valid_key=key.as_ref().is_some_and(|key|base64::Engine::decode(&base64::engine::general_purpose::STANDARD,key).is_ok_and(|bytes|bytes.len()==16));
        let mut state=session.lock().unwrap();
        if request_header(&request,"Origin").is_none() || token!=Some(state.id.as_str()) || !valid_key || request_header(&request,"Sec-WebSocket-Version").as_deref()!=Some("13") || !request_header(&request,"Upgrade").is_some_and(|v|v.eq_ignore_ascii_case("websocket")) || state.clients.len()>=16 {
            drop(state);reject(request,403,"Invalid local Studio connection.");return;
        }
        state.next_client+=1;let client=state.next_client;state.clients.insert(client);state.ever_connected=true;drop(state);
        let lease=Lease {session:session.clone(),client};
        let accept=tungstenite::handshake::derive_accept_key(key.unwrap().as_bytes());
        let mut response=Response::empty(101).with_header(header("Sec-WebSocket-Accept",&accept));
        for h in headers(){response.add_header(h);}
        let stream=request.upgrade("websocket",response);
        std::thread::spawn(move || {
            let _lease=lease;
            let mut config=tungstenite::protocol::WebSocketConfig::default();config.max_message_size=Some(128);config.max_frame_size=Some(128);config.read_buffer_size=1024;config.write_buffer_size=1024;config.max_write_buffer_size=4096;
            let mut socket=tungstenite::WebSocket::from_raw_socket(stream,tungstenite::protocol::Role::Server,Some(config));
            loop {match socket.read(){Ok(tungstenite::Message::Close(_))|Err(_)=>{let _=socket.flush();break},Ok(tungstenite::Message::Ping(_))|Ok(tungstenite::Message::Pong(_))=>{let _=socket.flush();},Ok(_)=>{let _=socket.close(None);break}}}
        });
        return;
    }
    if request.method()!=&Method::Get && request.method()!=&Method::Head {
        reply(request, 405, b"Only local asset downloads are supported.".to_vec(), "text/plain", vec![header("Allow", "GET, HEAD")]); return;
    }
    if path.starts_with("/__studio/") { reject(request, 404, "Unknown local endpoint."); return; }
    let key = if path=="/" { "index.html" } else { path.trim_start_matches('/') };
    let Some(file) = super::Site::get(key) else { reject(request, 404, "Not found."); return; };
    if key=="index.html" { session.lock().unwrap().last_page = Instant::now(); }
    let etag = format!("\"{}\"", file.metadata.sha256_hash().iter().map(|b| format!("{b:02x}")).collect::<String>());
    let cache = if key.starts_with("assets/") { "public, max-age=31536000, immutable" } else { "no-cache" };
    let mut extra = vec![header("ETag", &etag), header("Cache-Control", cache), header("Vary", "Accept-Encoding")];
    if request_header(&request, "If-None-Match").as_deref()==Some(etag.as_str()) {
        reply(request, 304, Vec::new(), file.metadata.mimetype(), extra); return;
    }
    let mime = file.metadata.mimetype();
    let compressible = mime.starts_with("text/") || ["javascript", "json", "wasm", "svg"].iter().any(|kind| mime.contains(kind));
    let gzip = request_header(&request, "Accept-Encoding").is_some_and(|value| value.split(',').any(|entry| {
        let mut pieces=entry.trim().split(';'); pieces.next()==Some("gzip") && !pieces.any(|p| p.trim().strip_prefix("q=").and_then(|q| q.parse::<f32>().ok())==Some(0.0))
    }));
    let body = if compressible && gzip {
        let cached = packed.lock().unwrap().get(key).cloned();
        let data = cached.unwrap_or_else(|| {
            let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::new(6));
            encoder.write_all(&file.data).unwrap();
            let body=Arc::new(encoder.finish().unwrap()); packed.lock().unwrap().insert(key.to_owned(), body.clone()); body
        });
        extra.push(header("Content-Encoding", "gzip")); (*data).clone()
    } else { file.data.into_owned() };
    reply(request, 200, body, mime, extra);
}
