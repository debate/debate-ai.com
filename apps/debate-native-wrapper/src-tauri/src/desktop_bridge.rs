// The desktop bridge: a tiny HTTP server on the loopback interface that lets
// the wrapped site, open in an ordinary browser, find out that the desktop app
// is installed and running, and hand work to it. For debate-ai that work is
// the mini player: the videos page's "Pop out mini player" button asks the
// app to open its always-on-top mini window (see mini_player.rs) instead of a
// browser popup, which no browser lets a page keep above other apps.
//
// It listens on 127.0.0.1 only, on the profile's `desktopBridgePort` (no
// bridge when that is unset), and answers just two requests:
//
//   GET  /status       {"app": "<name>", "version": "<version>"}
//   POST /mini-player  body {"path": "/videos/mini/<id>?t=12", "alwaysOnTop": true}
//
// Only pages on the app's own sites (the same check camera access uses, see
// media::is_trusted) may call it: anything else gets a 403 and no CORS
// headers, so an unrelated site can neither drive the app nor learn that it
// is installed. The mini player only ever opens a *path* on the main window's
// current site, so the bridge cannot be used to load another site in a
// window that has the app's IPC access.
//
// The site sends the POST as a `text/plain` "simple" request so the browser
// sends it without a preflight round trip; OPTIONS is still answered for
// browsers that preflight loopback requests anyway.
//
// Desktop only; the mobile builds never start it.

use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::time::Duration;

use tauri::{AppHandle, Manager, Url};

use crate::generated_scheme::{APP_NAME, DESKTOP_BRIDGE_PORT};
use crate::{media, mini_player};

/// Bodies are a short JSON object; anything bigger is not ours.
const MAX_BODY: usize = 4096;
/// Header lines are short too; a client sending more is cut off.
const MAX_HEADER_LINES: usize = 64;

/// The parts of a request the bridge reads.
#[derive(Debug, Default, PartialEq)]
struct Request {
    method: String,
    path: String,
    origin: Option<String>,
    body: String,
}

/// What the bridge answers.
#[derive(Debug, PartialEq)]
struct Response {
    status: u16,
    body: String,
    /// The request's origin, echoed back in CORS headers when it is trusted.
    allow_origin: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MiniPlayerRequest {
    path: String,
    #[serde(default = "default_on_top")]
    always_on_top: bool,
}

fn default_on_top() -> bool {
    true
}

/// Starts the bridge on a background thread, unless the profile leaves it
/// off or the port is taken (a second copy of the app, or another program).
pub fn start(app: &AppHandle) {
    if DESKTOP_BRIDGE_PORT == 0 {
        return;
    }
    let listener = match TcpListener::bind((Ipv4Addr::LOCALHOST, DESKTOP_BRIDGE_PORT)) {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("desktop bridge: cannot listen on 127.0.0.1:{DESKTOP_BRIDGE_PORT}: {error}");
            return;
        }
    };
    let app = app.clone();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let app = app.clone();
            std::thread::spawn(move || {
                let _ = serve(&app, stream);
            });
        }
    });
}

fn serve(app: &AppHandle, mut stream: TcpStream) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    let response = match read_request(&mut stream) {
        Some(request) => handle(app, &request),
        None => plain(400, "bad request", None),
    };
    stream.write_all(render(&response).as_bytes())?;
    stream.flush()
}

/// Reads one HTTP/1.1 request, or `None` if it is malformed or too large.
fn read_request(stream: &mut TcpStream) -> Option<Request> {
    let mut reader = BufReader::new(stream);
    parse_request(&mut reader)
}

fn parse_request(reader: &mut impl BufRead) -> Option<Request> {
    let mut line = String::new();
    reader.read_line(&mut line).ok()?;
    let mut parts = line.split_whitespace();
    let method = parts.next()?.to_owned();
    let path = parts.next()?.to_owned();

    let mut origin = None;
    let mut length = 0usize;
    for _ in 0..MAX_HEADER_LINES {
        line.clear();
        reader.read_line(&mut line).ok()?;
        let header = line.trim_end();
        if header.is_empty() {
            let mut body = vec![0; length];
            reader.read_exact(&mut body).ok()?;
            let body = String::from_utf8(body).ok()?;
            return Some(Request { method, path, origin, body });
        }
        let (name, value) = header.split_once(':')?;
        let value = value.trim();
        if name.eq_ignore_ascii_case("origin") {
            origin = Some(value.to_owned());
        } else if name.eq_ignore_ascii_case("content-length") {
            length = value.parse().ok()?;
            if length > MAX_BODY {
                return None;
            }
        }
    }
    None
}

/// The request's `Origin`, when it is one of the app's own sites.
fn trusted_origin(request: &Request) -> Option<String> {
    let origin = request.origin.as_deref()?;
    let url = Url::parse(origin).ok()?;
    media::is_trusted(&url).then(|| origin.to_owned())
}

/// A path on the site, never a URL of its own: `/x`, not `//host/x` or `https://…`.
fn is_site_path(path: &str) -> bool {
    path.starts_with('/') && !path.starts_with("//") && !path.contains('\\')
}

fn handle(app: &AppHandle, request: &Request) -> Response {
    let Some(origin) = trusted_origin(request) else {
        return plain(403, "forbidden", None);
    };
    let route = request.path.split('?').next().unwrap_or_default();
    match (request.method.as_str(), route) {
        ("OPTIONS", _) => plain(204, "", Some(origin)),
        ("GET", "/status") => Response {
            status: 200,
            body: serde_json::json!({ "app": APP_NAME, "version": app.package_info().version.to_string() }).to_string(),
            allow_origin: Some(origin),
        },
        ("POST", "/mini-player") => open_mini_player(app, &request.body, origin),
        _ => plain(404, "not found", Some(origin)),
    }
}

fn open_mini_player(app: &AppHandle, body: &str, origin: String) -> Response {
    let Ok(request) = serde_json::from_str::<MiniPlayerRequest>(body) else {
        return plain(400, "expected {\"path\": \"/…\"}", Some(origin));
    };
    if !is_site_path(&request.path) {
        return plain(400, "path must be a path on the site", Some(origin));
    }
    let url = match main_site_url(app, &request.path) {
        Ok(url) => url,
        Err(error) => return plain(503, &error, Some(origin)),
    };
    let result = tauri::async_runtime::block_on(mini_player::open_mini_player(
        app.clone(),
        url.to_string(),
        request.always_on_top,
    ));
    match result {
        Ok(()) => plain(200, "ok", Some(origin)),
        Err(error) => plain(500, &error, Some(origin)),
    }
}

/// `path` on the site the main window is showing, so the mini window follows
/// the user's choice of source (live, beta) rather than the caller's.
fn main_site_url(app: &AppHandle, path: &str) -> Result<Url, String> {
    let main = app.get_webview_window("main").ok_or("the main window is gone")?;
    let site = main.url().map_err(|error| error.to_string())?;
    site.join(path).map_err(|error| error.to_string())
}

fn plain(status: u16, body: &str, allow_origin: Option<String>) -> Response {
    Response { status, body: body.to_owned(), allow_origin }
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        503 => "Service Unavailable",
        _ => "Internal Server Error",
    }
}

fn render(response: &Response) -> String {
    let mut head = format!("HTTP/1.1 {} {}\r\n", response.status, reason(response.status));
    let content_type = if response.body.starts_with('{') { "application/json" } else { "text/plain" };
    head.push_str(&format!("Content-Type: {content_type}; charset=utf-8\r\n"));
    head.push_str(&format!("Content-Length: {}\r\n", response.body.len()));
    head.push_str("Cache-Control: no-store\r\nConnection: close\r\n");
    if let Some(origin) = &response.allow_origin {
        head.push_str(&format!("Access-Control-Allow-Origin: {origin}\r\n"));
        head.push_str("Vary: Origin\r\n");
        head.push_str("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
        head.push_str("Access-Control-Allow-Headers: Content-Type\r\n");
        // Chrome's older Private Network Access preflight asks for this.
        head.push_str("Access-Control-Allow-Private-Network: true\r\n");
        head.push_str("Access-Control-Max-Age: 600\r\n");
    }
    head.push_str("\r\n");
    head.push_str(&response.body);
    head
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(raw: &str) -> Option<Request> {
        parse_request(&mut std::io::Cursor::new(raw.as_bytes()))
    }

    #[test]
    fn reads_method_path_origin_and_body() {
        let body = r#"{"path":"/videos/mini/abc"}"#;
        let raw = format!(
            "POST /mini-player HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: https://debate-ai.com\r\ncontent-length: {}\r\n\r\n{body}",
            body.len()
        );
        assert_eq!(
            parse(&raw),
            Some(Request {
                method: "POST".into(),
                path: "/mini-player".into(),
                origin: Some("https://debate-ai.com".into()),
                body: body.into(),
            })
        );
    }

    #[test]
    fn rejects_oversized_and_malformed_requests() {
        assert_eq!(parse(&format!("POST / HTTP/1.1\r\nContent-Length: {}\r\n\r\n", MAX_BODY + 1)), None);
        assert_eq!(parse("GET / HTTP/1.1\r\nno colon here\r\n\r\n"), None);
        assert_eq!(parse(""), None);
    }

    #[test]
    fn trusts_only_the_apps_own_sites() {
        let with = |origin: &str| Request { origin: Some(origin.into()), ..Request::default() };
        let (_, _, live) = crate::generated_scheme::SOURCES[0];
        assert_eq!(trusted_origin(&with(live)), Some(live.to_owned()));
        assert_eq!(trusted_origin(&with("https://example.com")), None);
        assert_eq!(trusted_origin(&with("null")), None);
        assert_eq!(trusted_origin(&Request::default()), None);
    }

    #[test]
    fn only_site_paths_are_accepted() {
        assert!(is_site_path("/videos/mini/abc?t=5"));
        assert!(!is_site_path("//evil.example/x"));
        assert!(!is_site_path("https://evil.example/x"));
        assert!(!is_site_path("/\\evil.example"));
        assert!(!is_site_path("videos"));
    }

    #[test]
    fn cors_headers_only_for_trusted_callers() {
        let open = render(&plain(200, "ok", Some("https://debate-ai.com".into())));
        assert!(open.contains("Access-Control-Allow-Origin: https://debate-ai.com\r\n"));
        let closed = render(&plain(403, "forbidden", None));
        assert!(!closed.contains("Access-Control"));
        assert!(closed.starts_with("HTTP/1.1 403 Forbidden\r\n"));
    }
}
