use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
pub struct AppSelectionState(pub Mutex<String>);

#[tauri::command]
pub fn get_last_selected_text(state: State<AppSelectionState>) -> String {
    state.0.lock().map(|s| s.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn show_main_window(app: tauri::AppHandle) {
    if let Some(window) = tauri::Manager::get_webview_window(&app, "main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn hide_to_tray(app: tauri::AppHandle) {
    if let Some(window) = tauri::Manager::get_webview_window(&app, "main") {
        let _ = window.hide();
    }
}
