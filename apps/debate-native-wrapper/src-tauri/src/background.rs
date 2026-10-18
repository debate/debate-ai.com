// Desktop background service: the app keeps running with its window hidden,
// living only in the tray (the menu bar on macOS, the notification area on
// Windows, the status area on Linux), so bringing it up is a show() on a
// window whose page has already loaded rather than a cold start.
//
// - Launched at login with `--minimized` (or `--hidden` / `--background`),
//   the window never appears; otherwise it is shown once setup finishes.
//   It is created hidden (`"visible": false` in tauri.conf.json) either way,
//   so a background launch never flashes on screen.
// - On macOS a hidden window also drops the Dock icon (Accessory activation
//   policy), leaving the menu-bar icon as the app's only presence.
// - "Run on Startup" is turned on once, on the first launch, then left to
//   the user's choice in the tray menu.

use tauri::{AppHandle, Manager, Runtime};

/// Command-line flags that mean "start in the background".
const BACKGROUND_FLAGS: [&str; 3] = ["--minimized", "--hidden", "--background"];

/// Whether this process was launched to run in the background (at login).
pub fn launched_in_background() -> bool {
    std::env::args().any(|arg| BACKGROUND_FLAGS.contains(&arg.as_str()))
}

/// Shows, unminimizes and focuses the main window.
pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Hides the main window, leaving the app running in the tray.
pub fn hide_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}

/// Shows the main window if it is hidden, hides it if it is showing.
pub fn toggle_main<R: Runtime>(app: &AppHandle<R>) {
    let visible = app
        .get_webview_window("main")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);
    if visible {
        hide_main(app);
    } else {
        show_main(app);
    }
}

/// Turns "Run on Startup" on the first time the app ever runs, and leaves it
/// alone afterwards so turning it off in the tray sticks across restarts.
pub fn enable_autostart_on_first_run<R: Runtime>(app: &AppHandle<R>) {
    use tauri_plugin_autostart::ManagerExt;

    let Ok(dir) = app.path().app_config_dir() else {
        return;
    };
    let marker = dir.join("autostart-initialized");
    if marker.exists() {
        return;
    }
    if app.autolaunch().enable().is_ok() {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(&marker, b"1");
    }
}

/// Whether the app is currently registered to run at login.
pub fn autostart_enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// Turns "Run on Startup" on or off; returns the state the OS now reports.
pub fn set_autostart<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    let launcher = app.autolaunch();
    let _ = if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    };
    autostart_enabled(app)
}
