// Where the main window loads the app from: one of the profile's `sources`
// (generated_scheme::SOURCES) — for debate-ai, the live site, the beta site,
// or the offline build bundled into dist/. The user's pick is saved in the
// app's config directory so it survives restarts; until they pick, the
// profile's `defaultSource` is used.
//
// The launch splash (dist/index.html) asks `get_app_source` where to go, and
// the settings page (dist/settings.html), the tray's "Load From" menu and the
// wrapped site itself change it with `set_app_source`, which also reloads the
// window onto the new source.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State, Url};

use crate::generated_scheme::{APP_URL, DEFAULT_SOURCE, SOURCES};

const STORE_FILE: &str = "app-source.json";

/// The id of the source currently chosen.
pub struct AppSourceState(pub Mutex<String>);

#[derive(Serialize)]
pub struct SourceOption {
    pub id: &'static str,
    pub label: &'static str,
    pub url: &'static str,
    /// True for a page shipped inside the app (works without a network).
    pub bundled: bool,
}

#[derive(Serialize)]
pub struct AppSourceInfo {
    pub current: String,
    pub default: &'static str,
    pub options: Vec<SourceOption>,
}

/// A source URL without a scheme is a path inside the bundled frontend.
pub fn is_bundled(url: &str) -> bool {
    !url.contains("://")
}

fn find(id: &str) -> Option<&'static (&'static str, &'static str, &'static str)> {
    SOURCES.iter().find(|(source_id, _, _)| *source_id == id)
}

/// The website behind a source, for things that need a real site even when
/// the UI is the offline build (the OAuth callback): the source's own URL, or
/// the profile's `url` for a bundled source.
pub fn site_url(id: &str) -> &'static str {
    match find(id) {
        Some((_, _, url)) if !is_bundled(url) => url,
        _ => APP_URL,
    }
}

/// The id currently chosen, for callers outside a command.
pub fn current<R: Runtime>(app: &AppHandle<R>) -> String {
    app.try_state::<AppSourceState>()
        .and_then(|state| state.0.lock().ok().map(|id| id.clone()))
        .unwrap_or_else(|| DEFAULT_SOURCE.to_string())
}

fn store_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(STORE_FILE))
}

/// The saved choice, or the profile default when nothing (valid) is saved.
pub fn load<R: Runtime>(app: &AppHandle<R>) -> String {
    store_path(app)
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|value| value.get("source")?.as_str().map(str::to_string))
        .filter(|id| find(id).is_some())
        .unwrap_or_else(|| DEFAULT_SOURCE.to_string())
}

fn save<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<(), String> {
    let path = store_path(app).ok_or("no config directory to save the setting in")?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let body = serde_json::json!({ "source": id }).to_string();
    std::fs::write(path, body).map_err(|e| e.to_string())
}

fn info(current: String) -> AppSourceInfo {
    AppSourceInfo {
        current,
        default: DEFAULT_SOURCE,
        options: SOURCES
            .iter()
            .map(|(id, label, url)| SourceOption {
                id,
                label,
                url,
                bundled: is_bundled(url),
            })
            .collect(),
    }
}

/// The origin Tauri serves the bundled frontend (dist/) from.
pub fn bundled_origin() -> &'static str {
    if cfg!(any(target_os = "windows", target_os = "android")) {
        "http://tauri.localhost/"
    } else {
        "tauri://localhost/"
    }
}

/// Sends the main window back through the splash page, skipping the video,
/// so it lands on the chosen source the same way a fresh launch does
/// (including the fallback when the offline build isn't bundled).
pub fn reload_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Ok(url) = Url::parse(&format!("{}index.html#skip-splash", bundled_origin())) {
        let _ = window.navigate(url);
    }
}

/// Records `id` as the chosen source and reloads the window onto it.
pub fn select<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<(), String> {
    if find(id).is_none() {
        return Err(format!("unknown source \"{id}\""));
    }
    save(app, id)?;
    if let Some(state) = app.try_state::<AppSourceState>() {
        if let Ok(mut lock) = state.0.lock() {
            *lock = id.to_string();
        }
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    crate::sync_tray_source_checks(app, id);
    reload_main_window(app);
    Ok(())
}

#[tauri::command]
pub fn get_app_source(state: State<AppSourceState>) -> AppSourceInfo {
    let current = state
        .0
        .lock()
        .map(|id| id.clone())
        .unwrap_or_else(|_| DEFAULT_SOURCE.to_string());
    info(current)
}

#[tauri::command]
pub fn set_app_source(app: AppHandle, source: String) -> Result<AppSourceInfo, String> {
    select(&app, &source)?;
    Ok(info(source))
}
