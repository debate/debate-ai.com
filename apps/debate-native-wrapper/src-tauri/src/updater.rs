// Desktop auto-update (tauri-plugin-updater): checks the profile's update
// feed (`plugins.updater` in tauri.conf.json, written by scripts/configure.mjs
// from the profile's `updater` block) at launch and then once a day, downloads
// a newer signed build, installs it, and restarts.
//
// - A profile without an updater public key gets no `plugins.updater` block,
//   and the plugin is not registered at all: no checks, no errors.
// - The download happens in the background whenever an update is found, but
//   installing it does not: on Windows the installer closes the running app,
//   and everywhere the restart drops whatever page is open. So the install
//   waits until no window is showing (the app is in the tray), which on a
//   launch at login is straight away.
// - The restarted app goes back to the tray, as it was, instead of opening
//   its window (`background::start_hidden_next_launch`).
// - Every update is verified against the profile's public key before it is
//   installed; an unsigned or wrongly signed build is refused by the plugin.
// - The wrapped site has no IPC access to any of this (capabilities/*.json
//   grant no `updater:` permission); it is driven from Rust only.

use std::time::Duration;

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_updater::UpdaterExt;

use crate::background;

/// How long one check of the update feed may take.
const CHECK_TIMEOUT: Duration = Duration::from_secs(15);
/// How often a long-running (tray) app checks again after the launch check.
const RECHECK_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);
/// How often a downloaded update looks for a moment with no window showing.
const INSTALL_POLL_INTERVAL: Duration = Duration::from_secs(60);

/// Registers the updater and starts the background check loop, when the
/// profile configures an update feed.
pub fn init<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    if !app.config().plugins.0.contains_key("updater") {
        return Ok(());
    }
    app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        loop {
            // An unreachable feed or a failed download must never stop the
            // app; the next check tries again.
            if let Err(err) = check_and_install(&handle).await {
                eprintln!("update check failed: {err}");
            }
            tokio::time::sleep(RECHECK_INTERVAL).await;
        }
    });
    Ok(())
}

async fn check_and_install<R: Runtime>(app: &AppHandle<R>) -> tauri_plugin_updater::Result<()> {
    let Some(update) = app.updater_builder().timeout(CHECK_TIMEOUT).build()?.check().await? else {
        return Ok(());
    };
    eprintln!("downloading update {} (running {})", update.version, update.current_version);
    let bytes = update.download(|_, _| {}, || {}).await?;

    while any_window_visible(app) {
        tokio::time::sleep(INSTALL_POLL_INTERVAL).await;
    }

    eprintln!("installing update {}", update.version);
    background::start_hidden_next_launch(app);
    // On Windows this hands over to the installer, which closes this process
    // and starts the new version itself; elsewhere it replaces the app in place.
    if let Err(err) = update.install(bytes) {
        background::cancel_start_hidden(app);
        return Err(err);
    }
    app.restart();
}

/// Whether the user can see any of the app's windows (the main window or the
/// mini player), i.e. whether a restart now would interrupt them.
fn any_window_visible<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.webview_windows()
        .values()
        .any(|window| window.is_visible().unwrap_or(false))
}
