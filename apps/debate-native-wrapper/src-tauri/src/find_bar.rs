// Find in page (Ctrl+F / Cmd+F). A WebView has no find bar of its own, so the
// key did nothing in the app. `find_bar.js` adds one; this plugin injects it as
// an initialization script, which runs at the start of every page load in
// every window (the splash, the settings page, any source the app loads from,
// the mini player), so it needs no help from the site itself.

use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

/// The find bar script, run in each window's top frame.
pub const SCRIPT: &str = include_str!("find_bar.js");

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("find-bar").js_init_script(SCRIPT.to_string()).build()
}
