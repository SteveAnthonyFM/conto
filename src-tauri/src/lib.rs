mod credentials;
mod local;
mod settings;
mod store;
mod tray;
mod usage;

use credentials::CredError;
use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Manager, WindowEvent};
use usage::{FetchError, Usage};

/// Manual refreshes within this window return the cached reading instead of re-calling the API.
const MIN_REFETCH: Duration = Duration::from_secs(15);

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", content = "message", rename_all = "snake_case")]
pub enum Status {
    Ok,
    /// Claude Code isn't signed in on this machine.
    NoCredentials,
    /// Token expired; opening Claude Code renews it.
    TokenExpired,
    RateLimited,
    Offline(String),
    Error(String),
}

#[derive(Serialize, Clone, Debug)]
pub struct UsageReport {
    pub status: Status,
    /// Last good reading, kept while stale so the UI can still show it.
    pub usage: Option<Usage>,
    /// Unix seconds of `usage`
    pub fetched_at: Option<i64>,
    /// Plan reported by Claude Code's credentials ("pro", "max", ...), if present.
    pub subscription_type: Option<String>,
    pub retry_in_secs: Option<u64>,
}

#[derive(Default)]
struct Cache {
    usage: Option<Usage>,
    fetched_at: Option<i64>,
    subscription_type: Option<String>,
    last_attempt: Option<Instant>,
    blocked_until: Option<Instant>,
}

#[derive(Default)]
struct AppState {
    cache: Mutex<Cache>,
    tray: Mutex<Option<tauri::tray::TrayIcon>>,
}

fn now_secs() -> i64 {
    chrono::Utc::now().timestamp()
}

fn report(c: &Cache, status: Status) -> UsageReport {
    let retry_in_secs = c.blocked_until.and_then(|t| t.checked_duration_since(Instant::now())).map(|d| d.as_secs());
    UsageReport {
        status,
        usage: c.usage.clone(),
        fetched_at: c.fetched_at,
        subscription_type: c.subscription_type.clone(),
        retry_in_secs,
    }
}

/// One poll: read token -> call API -> cache + snapshot. Never panics; failures become a
/// `Status` so the UI shows a stale state with the last good numbers.
fn refresh(state: &AppState, snapshot_file: &std::path::Path, force: bool) -> UsageReport {
    let mut c = state.cache.lock().unwrap();

    if c.blocked_until.is_some_and(|t| Instant::now() < t) {
        return report(&c, Status::RateLimited);
    }
    if force && c.last_attempt.is_some_and(|t| t.elapsed() < MIN_REFETCH) && c.usage.is_some() {
        return report(&c, Status::Ok);
    }
    c.last_attempt = Some(Instant::now());

    let token = match credentials::read_token() {
        Ok(t) => t,
        Err(CredError::NotFound) => return report(&c, Status::NoCredentials),
        Err(CredError::Unreadable(m)) => return report(&c, Status::Error(m)),
    };
    c.subscription_type = token.subscription_type.clone();
    if token.expires_at_ms.is_some_and(|ms| ms <= now_secs() * 1000) {
        return report(&c, Status::TokenExpired);
    }

    match usage::fetch_usage(&token.access_token) {
        Ok(u) => {
            let ts = now_secs();
            let _ = store::append(snapshot_file, &store::Snapshot::from_usage(ts, &u));
            c.usage = Some(u);
            c.fetched_at = Some(ts);
            c.blocked_until = None;
            report(&c, Status::Ok)
        }
        Err(FetchError::Unauthorized) => report(&c, Status::TokenExpired),
        Err(FetchError::RateLimited { retry_after_secs }) => {
            c.blocked_until = Some(Instant::now() + Duration::from_secs(retry_after_secs.max(60)));
            report(&c, Status::RateLimited)
        }
        Err(FetchError::Network(m)) => report(&c, Status::Offline(m)),
        Err(FetchError::BadResponse(m)) => report(&c, Status::Error(m)),
    }
}

fn data_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir().join("conto"))
}

#[tauri::command]
async fn refresh_usage(app: tauri::AppHandle, force: bool) -> Result<UsageReport, String> {
    let file = store::file_in(&data_dir(&app));
    let app2 = app.clone();
    let report = tauri::async_runtime::spawn_blocking(move || refresh(&app2.state::<AppState>(), &file, force))
        .await
        .map_err(|e| e.to_string())?;

    if let Some(t) = app.state::<AppState>().tray.lock().unwrap().as_ref() {
        tray::update(t, &report);
    }
    Ok(report)
}

#[tauri::command]
async fn get_settings(app: tauri::AppHandle) -> settings::Settings {
    settings::load(&settings::file_in(&data_dir(&app)))
}

/// Applies and persists the Always on Top preference in one step, so the toggle survives
/// a relaunch (window position/size are handled separately by tauri-plugin-window-state).
#[tauri::command]
async fn set_always_on_top(app: tauri::AppHandle, value: bool) -> Result<settings::Settings, String> {
    let window = app.get_webview_window("main").ok_or("main window not found")?;
    window.set_always_on_top(value).map_err(|e| e.to_string())?;

    let file = settings::file_in(&data_dir(&app));
    let mut s = settings::load(&file);
    s.always_on_top = value;
    settings::save(&file, &s).map_err(|e| e.to_string())?;
    Ok(s)
}

/// Saved readings (utilization % over time) at or after `since` unix seconds.
#[tauri::command]
async fn get_snapshots(app: tauri::AppHandle, since: i64) -> Vec<store::Snapshot> {
    store::read_since(&store::file_in(&data_dir(&app)), since)
}

/// Hourly per-model token totals from local Claude Code logs at or after `since` unix seconds.
#[tauri::command]
async fn get_local_usage(since: i64) -> Result<Vec<local::Bucket>, String> {
    tauri::async_runtime::spawn_blocking(move || local::scan(&local::project_roots(), since))
        .await
        .map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        // Only position/size are restored across launches — not visibility, so quitting
        // while the window is hidden in the tray doesn't leave it hidden on next launch.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(tauri_plugin_window_state::StateFlags::POSITION | tauri_plugin_window_state::StateFlags::SIZE)
                .build(),
        )
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle();
            store::prune(&store::file_in(&data_dir(handle)), now_secs());

            let saved = settings::load(&settings::file_in(&data_dir(handle)));
            let window = handle.get_webview_window("main").expect("main window must exist");
            let _ = window.set_always_on_top(saved.always_on_top);

            // The card's own Close button and the window's native close control both hide
            // the window rather than quitting — CONTO keeps running via the tray icon,
            // which is what brings it back (see tray.rs).
            let win_to_hide = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win_to_hide.hide();
                }
            });

            let tray_icon = tray::build(handle)?;
            *app.state::<AppState>().tray.lock().unwrap() = Some(tray_icon);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            refresh_usage,
            get_snapshots,
            get_local_usage,
            get_settings,
            set_always_on_top
        ])
        .run(tauri::generate_context!())
        .expect("error while running CONTO");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Live smoke test against your real login. Prints percentages only, never the token.
    /// Run: cargo test live_ -- --ignored --nocapture
    #[test]
    #[ignore]
    fn live_refresh_and_local_scan() {
        let dir = std::env::temp_dir().join("conto-live-test");
        let state = AppState::default();
        let r = refresh(&state, &store::file_in(&dir), false);
        println!("status: {:?}", r.status);
        println!("plan: {:?}", r.subscription_type);
        if let Some(u) = &r.usage {
            println!("five_hour: {:?}", u.five_hour);
            println!("seven_day: {:?}", u.seven_day);
            println!("opus: {:?} sonnet: {:?}", u.seven_day_opus, u.seven_day_sonnet);
        }
        let since = now_secs() - 7 * 24 * 3600;
        let buckets = local::scan(&local::project_roots(), since);
        let reqs: u64 = buckets.iter().map(|b| b.requests).sum();
        println!("local: {} hourly buckets, {} requests in last 7d", buckets.len(), reqs);
    }
}

