//! Usage via the user's claude.ai web login (the same session the website uses), instead of
//! Claude Code's ~1-hour OAuth token. Proven approach: sign in once in a real login window;
//! the webview's own cookie store keeps the session (~4 weeks) across launches.
//!
//! CONTO never stores the session cookie itself — it lives only in the OS webview's cookie
//! store and is read on demand, held in memory just long enough to make the request, and
//! sent only to claude.ai. It is never logged. The endpoint is unofficial and may change.

use crate::usage::{parse_usage, FetchError, Usage};
use std::sync::{mpsc, Mutex};
use std::time::{Duration, Instant};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

const BASE: &str = "https://claude.ai";
const LOGIN_LABEL: &str = "web-login";
const CALLBACK_HOST: &str = "conto-callback.invalid";
/// Fallback only; the real one comes from the webview via `set_user_agent`.
const FALLBACK_USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/// The webview's own User-Agent. Cloudflare ties its clearance cookie to the browser's UA,
/// so plain HTTP requests must send the same one the webview used to earn it.
static WEBVIEW_UA: Mutex<Option<String>> = Mutex::new(None);

pub fn set_user_agent(ua: &str) {
    let ua = ua.trim();
    if ua.is_empty() || ua.len() > 400 || !ua.chars().all(|c| (' '..='~').contains(&c)) {
        return;
    }
    *WEBVIEW_UA.lock().unwrap() = Some(ua.to_string());
}

fn user_agent() -> String {
    WEBVIEW_UA.lock().unwrap().clone().unwrap_or_else(|| FALLBACK_USER_AGENT.to_string())
}

#[derive(Debug)]
pub enum WebError {
    /// No claude.ai session in the cookie store — the user has never signed in (or signed out).
    NotSignedIn,
    /// A session exists but claude.ai rejected it (expired or revoked).
    Rejected,
    Other(FetchError),
}

impl From<FetchError> for WebError {
    fn from(e: FetchError) -> Self {
        WebError::Other(e)
    }
}

fn base_url() -> Url {
    BASE.parse().expect("static url")
}

/// (Cookie header, `lastActiveOrg` cookie if present), or None when there's no session.
fn read_session(app: &AppHandle) -> Option<(String, Option<String>)> {
    let win = app.get_webview_window("main")?;
    let cookies = win.cookies_for_url(base_url()).ok()?;
    if !cookies.iter().any(|c| c.name() == "sessionKey") {
        return None;
    }
    let org = cookies.iter().find(|c| c.name() == "lastActiveOrg").map(|c| c.value().to_string());
    let header = cookies.iter().map(|c| format!("{}={}", c.name(), c.value())).collect::<Vec<_>>().join("; ");
    Some((header, org))
}

enum Get {
    Json(String),
    /// Cloudflare/HTML challenge page instead of JSON.
    Blocked,
    Rejected,
}

fn http_get(url: &str, cookie: &str) -> Result<Get, FetchError> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .timeout_global(Some(Duration::from_secs(20)))
        .build()
        .into();
    let mut resp = agent
        .get(url)
        .header("Cookie", cookie)
        .header("User-Agent", user_agent())
        .header("Accept", "application/json")
        .call()
        .map_err(|e| FetchError::Network(e.to_string()))?;
    let status = resp.status().as_u16();
    let retry_after = resp.headers().get("retry-after").and_then(|v| v.to_str().ok()).and_then(|v| v.parse().ok()).unwrap_or(300);
    let body = resp.body_mut().read_to_string().unwrap_or_default();
    match status {
        200 if serde_json::from_str::<serde_json::Value>(&body).is_ok() => Ok(Get::Json(body)),
        200 => Ok(Get::Blocked),
        401 => Ok(Get::Rejected),
        403 if body.trim_start().starts_with('{') => Ok(Get::Rejected),
        403 => Ok(Get::Blocked),
        429 => Err(FetchError::RateLimited { retry_after_secs: retry_after }),
        s => Err(FetchError::BadResponse(format!("HTTP {s}"))),
    }
}

/// Loads `url` in a hidden webview (sharing the login's cookie store, so it passes Cloudflare
/// like a real browser) and returns the page text. Fallback for when plain HTTP is blocked.
/// The page returns its text by navigating to a fake host that `on_navigation` intercepts.
fn get_via_webview(app: &AppHandle, url: &str) -> Result<Get, FetchError> {
    let (tx, rx) = mpsc::channel::<String>();
    let target: Url = url.parse().map_err(|e| FetchError::BadResponse(format!("bad url: {e}")))?;
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let label = format!("web-fetch-{nanos}");
    let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(target))
        .visible(false)
        .on_navigation(move |u| {
            if u.host_str() == Some(CALLBACK_HOST) {
                let body = u.query_pairs().find(|(k, _)| k == "d").map(|(_, v)| v.into_owned()).unwrap_or_default();
                let _ = tx.send(body);
                return false;
            }
            true
        })
        .on_page_load(|w, p| {
            if matches!(p.event(), PageLoadEvent::Finished) && p.url().host_str() != Some(CALLBACK_HOST) {
                let _ = w.eval(format!(
                    "(function(){{var t=document.body?document.body.innerText:'';location.href='https://{CALLBACK_HOST}/?d='+encodeURIComponent(t.slice(0,200000));}})()"
                ));
            }
        })
        .build()
        .map_err(|e| FetchError::Network(e.to_string()))?;
    let out = rx.recv_timeout(Duration::from_secs(30));
    let _ = win.close();
    let body = out.map_err(|_| FetchError::Network("timed out loading claude.ai".into()))?;
    match serde_json::from_str::<serde_json::Value>(&body) {
        // A JSON error object (e.g. permission_error) means the session was rejected.
        Ok(v) if v.get("error").is_some() => Ok(Get::Rejected),
        Ok(_) => Ok(Get::Json(body)),
        Err(_) => Ok(Get::Blocked),
    }
}

/// GET with plain HTTP first; if Cloudflare gets in the way, retry through the webview.
fn get(app: &AppHandle, url: &str, cookie: &str) -> Result<Get, FetchError> {
    match http_get(url, cookie)? {
        Get::Blocked => get_via_webview(app, url),
        other => Ok(other),
    }
}

/// Picks the chat-enabled org from `/api/organizations`.
fn find_org(app: &AppHandle, cookie: &str) -> Result<String, WebError> {
    let body = match get(app, &format!("{BASE}/api/organizations"), cookie)? {
        Get::Json(b) => b,
        Get::Rejected => return Err(WebError::Rejected),
        Get::Blocked => return Err(FetchError::BadResponse("claude.ai blocked the request".into()).into()),
    };
    let v: serde_json::Value = serde_json::from_str(&body).map_err(|e| FetchError::BadResponse(e.to_string()))?;
    let orgs = v.as_array().ok_or_else(|| FetchError::BadResponse("unexpected organizations response".into()))?;
    let has_chat = |o: &serde_json::Value| o.get("capabilities").and_then(|c| c.as_array()).is_some_and(|c| c.iter().any(|x| x.as_str() == Some("chat")));
    orgs.iter()
        .find(|o| has_chat(o))
        .or_else(|| orgs.first())
        .and_then(|o| o.get("uuid").and_then(|u| u.as_str()))
        .map(str::to_string)
        .ok_or_else(|| FetchError::BadResponse("no organization found".into()).into())
}

fn fetch_usage_for_org(app: &AppHandle, cookie: &str, org: &str) -> Result<Option<Usage>, WebError> {
    match get(app, &format!("{BASE}/api/organizations/{org}/usage"), cookie)? {
        Get::Json(b) => Ok(Some(parse_usage(&b)?)),
        Get::Rejected => Ok(None),
        Get::Blocked => Err(FetchError::BadResponse("claude.ai blocked the request".into()).into()),
    }
}

/// One usage reading via the web session. `org_cache` remembers the organization id.
pub fn fetch_usage(app: &AppHandle, org_cache: &mut Option<String>) -> Result<Usage, WebError> {
    let (cookie, cookie_org) = read_session(app).ok_or(WebError::NotSignedIn)?;

    let org = match org_cache.clone().or(cookie_org) {
        Some(o) => o,
        None => find_org(app, &cookie)?,
    };
    match fetch_usage_for_org(app, &cookie, &org)? {
        Some(u) => {
            *org_cache = Some(org);
            Ok(u)
        }
        None => {
            // Could be a stale org id rather than a dead session — re-discover once.
            *org_cache = None;
            let fresh = find_org(app, &cookie)?;
            match fetch_usage_for_org(app, &cookie, &fresh)? {
                Some(u) => {
                    *org_cache = Some(fresh);
                    Ok(u)
                }
                None => Err(WebError::Rejected),
            }
        }
    }
}

/// Opens claude.ai's real login page in its own window and waits until a session appears
/// (or the user closes the window). Blocking — call from a worker thread.
pub fn sign_in(app: &AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(LOGIN_LABEL) {
        let _ = existing.set_focus();
        return Err("already open".into());
    }
    let login = WebviewWindowBuilder::new(app, LOGIN_LABEL, WebviewUrl::External(format!("{BASE}/login").parse().unwrap()))
        .title("Sign in to Claude")
        .inner_size(480.0, 760.0)
        .center()
        // Only ever browse the web; block custom schemes a hostile page might try to open.
        .on_navigation(|u| matches!(u.scheme(), "https" | "http" | "about"))
        .build()
        .map_err(|e| e.to_string())?;

    let started = Instant::now();
    let result = loop {
        std::thread::sleep(Duration::from_millis(800));
        if app.get_webview_window(LOGIN_LABEL).is_none() {
            break Err("cancelled".to_string());
        }
        if started.elapsed() > Duration::from_secs(900) {
            break Err("timed out".to_string());
        }
        if let Ok(cookies) = login.cookies_for_url(base_url()) {
            if cookies.iter().any(|c| c.name() == "sessionKey") {
                break Ok(());
            }
        }
    };
    let _ = login.close();
    result
}

/// Removes every claude.ai cookie from CONTO's webview store.
pub fn sign_out(app: &AppHandle) -> Result<(), String> {
    let win = app.get_webview_window("main").ok_or("main window not found")?;
    for c in win.cookies_for_url(base_url()).map_err(|e| e.to_string())? {
        let _ = win.delete_cookie(c);
    }
    Ok(())
}
