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
// - A restart after an auto-update (updater.rs) also starts in the tray,
//   through a one-shot marker file rather than a flag.
// - "Run on Startup" is turned on once, on the first launch, then left to
//   the user's choice in the tray menu.

use tauri::{AppHandle, Manager, Runtime};

/// Command-line flags that mean "start in the background".
const BACKGROUND_FLAGS: [&str; 3] = ["--minimized", "--hidden", "--background"];

/// Marker file (in the app config dir) that makes the next launch start in
/// the background once, for a restart the user did not ask for.
const START_HIDDEN_MARKER: &str = "start-hidden-once";

/// Whether this process was launched to run in the background: at login, or
/// as the restart after an update installed while the app was in the tray.
pub fn launched_in_background<R: Runtime>(app: &AppHandle<R>) -> bool {
    let marker = app.path().app_config_dir().map(|dir| dir.join(START_HIDDEN_MARKER));
    let after_update = marker.is_ok_and(|marker| std::fs::remove_file(marker).is_ok());
    after_update || std::env::args().any(|arg| BACKGROUND_FLAGS.contains(&arg.as_str()))
}

/// Makes the next launch start in the tray, whatever its command line says.
/// Used before the updater restarts the app (see updater.rs).
pub fn start_hidden_next_launch<R: Runtime>(app: &AppHandle<R>) {
    let Ok(dir) = app.path().app_config_dir() else {
        return;
    };
    let _ = std::fs::create_dir_all(&dir);
    let _ = std::fs::write(dir.join(START_HIDDEN_MARKER), b"1");
}

/// Undoes `start_hidden_next_launch` when the restart is not happening after all.
pub fn cancel_start_hidden<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(dir) = app.path().app_config_dir() {
        let _ = std::fs::remove_file(dir.join(START_HIDDEN_MARKER));
    }
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
