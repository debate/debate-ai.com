// The mini player: a small second window the wrapped site can pop a page out
// into — for debate-ai, one video and its speech switcher — which can float
// above every other window on the desktop ("always on top") so it stays in
// view while the user works in other apps.
//
// Tauri's always-on-top is a window property: `alwaysOnTop` in a window's
// config, `WebviewWindowBuilder::always_on_top` when a window is built in
// Rust, and `Window::set_always_on_top` to flip it later. The JS equivalent
// (`getCurrentWindow().setAlwaysOnTop`) needs the
// `core:window:allow-set-always-on-top` permission; the wrapped site calls the
// commands below instead, which `permissions/allow-mini-player.toml` grants.
//
// Only pages on the main window's own site can be popped out: the URL is
// checked against the main window's current origin, so a page can't use the
// mini window to open some other site with the app's IPC access.
//
// Desktop only. On Android and iOS every command reports that it is
// unsupported, and the site never offers the control there.

use tauri::{AppHandle, Url, WebviewWindow};

/// The mini window's label; the capabilities grant it the remote IPC scope.
pub const LABEL: &str = "mini-player";

/// The mini window's opening size, in logical pixels: a 16:9 video plus a
/// title bar and a strip of speech buttons.
#[cfg(desktop)]
const WIDTH: f64 = 480.0;
#[cfg(desktop)]
const HEIGHT: f64 = 340.0;
/// Gap left between the window and the screen's right and bottom edges.
#[cfg(desktop)]
const MARGIN: f64 = 24.0;
/// Extra room at the bottom for a taskbar or dock.
#[cfg(desktop)]
const BOTTOM_RESERVE: f64 = 56.0;

/// True when two URLs share a scheme, host and port. Compared by hand rather
/// than through `Url::origin`, which makes every custom-scheme origin (the
/// bundled offline build's) opaque and unequal to everything.
fn same_origin(a: &Url, b: &Url) -> bool {
    a.scheme() == b.scheme() && a.host_str() == b.host_str() && a.port_or_known_default() == b.port_or_known_default()
}

/// Parses `raw` and accepts it only when it is on the main window's site.
fn checked_url(app: &AppHandle, raw: &str) -> Result<Url, String> {
    use tauri::Manager;

    let url = Url::parse(raw).map_err(|error| format!("invalid url: {error}"))?;
    let main = app.get_webview_window("main").ok_or("the main window is gone")?;
    let site = main.url().map_err(|error| error.to_string())?;
    if !same_origin(&url, &site) {
        return Err("only pages on the app's own site can be popped out".into());
    }
    Ok(url)
}

/// Pins or unpins `window` above other windows. Pinned, it also follows the
/// user across virtual desktops (macOS Spaces, Linux workspaces), so switching
/// desktop to do something else doesn't leave it behind.
#[cfg(desktop)]
fn apply_on_top(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    window.set_always_on_top(enabled).map_err(|error| error.to_string())?;
    let _ = window.set_visible_on_all_workspaces(enabled);
    Ok(())
}

/// The bottom-right corner of the monitor the main window is on, where a
/// picture-in-picture window is expected to appear.
#[cfg(desktop)]
fn corner_position(app: &AppHandle) -> Option<(f64, f64)> {
    use tauri::Manager;

    let monitor = app.get_webview_window("main")?.current_monitor().ok()??;
    let scale = monitor.scale_factor();
    let origin = monitor.position().to_logical::<f64>(scale);
    let size = monitor.size().to_logical::<f64>(scale);
    Some((
        (origin.x + size.width - WIDTH - MARGIN).max(origin.x),
        (origin.y + size.height - HEIGHT - MARGIN - BOTTOM_RESERVE).max(origin.y),
    ))
}

/// Opens the mini window on `url`, or points the open one at it.
///
/// Async because building a window from a synchronous command deadlocks on
/// Windows (the command runs on the main thread the window needs).
#[tauri::command]
pub async fn open_mini_player(app: AppHandle, url: String, always_on_top: bool) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

        let url = checked_url(&app, &url)?;

        if let Some(window) = app.get_webview_window(LABEL) {
            window.navigate(url).map_err(|error| error.to_string())?;
            apply_on_top(&window, always_on_top)?;
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
            return Ok(());
        }

        let mut builder = WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::External(url))
            .title(format!("{} — Mini Player", app.package_info().name))
            .inner_size(WIDTH, HEIGHT)
            .min_inner_size(280.0, 180.0)
            .resizable(true)
            .always_on_top(always_on_top)
            .visible_on_all_workspaces(always_on_top);
        if let Some((x, y)) = corner_position(&app) {
            builder = builder.position(x, y);
        }
        let window = builder.build().map_err(|error| error.to_string())?;
        let _ = window.set_focus();
        Ok(())
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, url, always_on_top);
        Err("the mini player is only available on desktop".into())
    }
}

/// Pins the calling window above other windows, or unpins it.
#[tauri::command]
pub fn set_always_on_top(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    #[cfg(desktop)]
    {
        apply_on_top(&window, enabled)
    }
    #[cfg(not(desktop))]
    {
        let _ = (window, enabled);
        Err("always on top is only available on desktop".into())
    }
}

/// Sends the main window to `url` (the full page for what the mini window was
/// showing), brings it forward, and closes the mini window.
#[tauri::command]
pub async fn restore_from_mini_player(app: AppHandle, url: String) -> Result<(), String> {
    use tauri::Manager;

    let url = checked_url(&app, &url)?;
    let main = app.get_webview_window("main").ok_or("the main window is gone")?;
    main.navigate(url).map_err(|error| error.to_string())?;
    let _ = main.show();
    #[cfg(desktop)]
    let _ = main.unminimize();
    let _ = main.set_focus();
    if let Some(mini) = app.get_webview_window(LABEL) {
        let _ = mini.close();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::same_origin;
    use tauri::Url;

    fn url(raw: &str) -> Url {
        Url::parse(raw).unwrap()
    }

    #[test]
    fn same_site_pages_match() {
        assert!(same_origin(&url("https://debate-ai.com/videos/mini/abc"), &url("https://debate-ai.com/videos")));
        assert!(same_origin(&url("https://debate-ai.com:443/a"), &url("https://debate-ai.com/b")));
    }

    #[test]
    fn other_sites_do_not() {
        assert!(!same_origin(&url("https://evil.example/videos"), &url("https://debate-ai.com/videos")));
        assert!(!same_origin(&url("http://debate-ai.com/videos"), &url("https://debate-ai.com/videos")));
        assert!(!same_origin(&url("https://beta.debate-ai.com/"), &url("https://debate-ai.com/")));
    }

    #[test]
    fn the_bundled_build_matches_itself() {
        assert!(same_origin(&url("tauri://localhost/videos/mini/abc"), &url("tauri://localhost/index.html")));
    }
}
