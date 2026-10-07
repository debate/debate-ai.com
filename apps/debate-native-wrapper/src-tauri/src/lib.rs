// Generic Tauri wrapper: plays the bundled launch splash (dist/index.html),
// which then opens `generated_scheme::APP_URL` as the main window's content,
// and provides:
// 1. Google OAuth deep-link handoff (`<scheme>://auth-callback?token=...`)
// 2. Desktop background service with system tray + minimize-to-tray on close
// 3. Autostart on system boot (LaunchAgent on macOS, Registry on Windows, autostart on Linux)
// 4. Global shortcut `Ctrl+`` / `Cmd+`` that captures active selection / clipboard text
//    and brings the window into focus with the selected text as input
// 5. Fullscreen toggle shortcut (F11 / CmdOrCtrl+Shift+F)
// 6. Native machine diagnostics (`system_info`)
// 7. A choice of where the app loads from (`app_source`): for debate-ai, the
//    live site, the beta site, or the offline build bundled in dist/
// 8. Camera and microphone access for the app's own pages (`media`)

mod app_source;
mod commands;
mod generated_scheme;
mod media;
mod system_info;

use tauri::{Emitter, Manager, Url};
use tauri_plugin_deep_link::DeepLinkExt;

pub use commands::AppSelectionState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Manage selection state for frontend queries
    builder = builder.manage(AppSelectionState::default());

    // Desktop-specific plugins & background service configuration
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Forward deep-link or show window on duplicate launch
            let scheme_prefix = format!("{}://", generated_scheme::DEEP_LINK_SCHEME);
            if let Some(url) = argv.iter().find(|arg| arg.starts_with(&scheme_prefix)) {
                handle_deep_link(app, url);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));

        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ));

        builder = builder.plugin(desktop_shortcuts_plugin());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            system_info::system_info,
            app_source::get_app_source,
            app_source::set_app_source,
            commands::get_last_selected_text,
            commands::show_main_window,
            commands::hide_to_tray,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .on_permission_request(|webview, kind| media::permission_response(&webview, kind))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                media::enable_media(&window);
            }

            let saved_source = app_source::load(app.handle());
            app.manage(app_source::AppSourceState(std::sync::Mutex::new(saved_source)));

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    handle_deep_link(&handle, url.as_str());
                }
            });

            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let _ = app.deep_link().register_all();

                // Setup system tray icon and background persistence
                setup_tray_and_background(app)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running @debate/native-wrapper");
}

/// Sets up the system tray and configures the window to hide to background
/// on close instead of exiting.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn setup_tray_and_background(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    use tauri_plugin_autostart::ManagerExt;

    // Enable autostart on system boot by default
    let _ = app.autolaunch().enable();

    // Tray context menu
    let show_item = MenuItemBuilder::with_id("show", "Show Debate AI").build(app)?;
    let hide_item = MenuItemBuilder::with_id("hide", "Hide to Background").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit Debate AI").build(app)?;

    // "Load From": one checkable entry per profile source; the checked one is
    // where the window loads the app from (see app_source.rs).
    let current_source = app_source::current(app.handle());
    let mut source_items = Vec::new();
    let mut source_menu = SubmenuBuilder::new(app, "Load From");
    for (id, label, _) in generated_scheme::SOURCES {
        let item = CheckMenuItemBuilder::with_id(format!("{SOURCE_MENU_PREFIX}{id}"), *label)
            .checked(*id == current_source)
            .build(app)?;
        source_menu = source_menu.item(&item);
        source_items.push((id.to_string(), item));
    }
    let source_menu = source_menu
        .separator()
        .item(&MenuItemBuilder::with_id("source-settings", "Settings…").build(app)?)
        .build()?;
    app.manage(TraySourceItems(std::sync::Mutex::new(source_items)));

    let menu = MenuBuilder::new(app)
        .items(&[&show_item, &hide_item])
        .separator()
        .item(&source_menu)
        .separator()
        .item(&quit_item)
        .build()?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Debate AI (Ctrl+` to quick launch)")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                app.exit(0);
            }
            "source-settings" => open_source_settings(app),
            other => {
                if let Some(id) = other.strip_prefix(SOURCE_MENU_PREFIX) {
                    if app_source::select(app, id).is_err() {
                        // Unknown id: put the checks back as they were.
                        sync_tray_source_checks(app, &app_source::current(app));
                    }
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let is_visible = window.is_visible().unwrap_or(false);
                    if is_visible {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    // Intercept window close to hide to tray/background instead of quitting
    if let Some(main_window) = app.get_webview_window("main") {
        let w = main_window.clone();
        main_window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = w.hide();
                api.prevent_close();
            }
        });

        // If launched on boot with --minimized / --hidden / --background, start hidden in tray
        let args: Vec<String> = std::env::args().collect();
        if args.iter().any(|arg| arg == "--minimized" || arg == "--hidden" || arg == "--background") {
            let _ = main_window.hide();
        }
    }

    Ok(())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
const SOURCE_MENU_PREFIX: &str = "source:";

/// The tray's "Load From" entries, kept so a change made elsewhere (the
/// settings page, the site) moves the check mark too.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
struct TraySourceItems(std::sync::Mutex<Vec<(String, tauri::menu::CheckMenuItem<tauri::Wry>)>>);

/// Checks the tray entry for `selected` and unchecks the rest.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub(crate) fn sync_tray_source_checks<R: tauri::Runtime>(app: &tauri::AppHandle<R>, selected: &str) {
    let Some(items) = app.try_state::<TraySourceItems>() else {
        return;
    };
    if let Ok(items) = items.0.lock() {
        for (id, item) in items.iter() {
            let _ = item.set_checked(id == selected);
        }
    };
}

/// Shows the bundled settings page (dist/settings.html) in the main window.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn open_source_settings<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Ok(url) = Url::parse(&format!("{}settings.html", app_source::bundled_origin())) {
        let _ = window.navigate(url);
    }
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

/// Global shortcuts:
/// - `Ctrl+`` / `Cmd+``: Capture highlighted / selected text from active OS window,
///   bring Debate AI into focus, and pass the text to the window.
/// - `F11` / `CmdOrCtrl+Shift+F`: Toggle full screen.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn desktop_shortcuts_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    use tauri_plugin_global_shortcut::ShortcutState;

    tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts([
            "F11",
            "CmdOrCtrl+Shift+F",
            "CmdOrCtrl+`",
            "Ctrl+`",
        ])
        .expect("shortcuts are valid accelerator strings")
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let sc_str = shortcut.to_string().to_lowercase();
            if sc_str.contains("f11") || sc_str.contains("shift+f") {
                if let Some(window) = app.get_webview_window("main") {
                    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
                    let _ = window.set_fullscreen(!is_fullscreen);
                }
            } else if sc_str.contains('`') || sc_str.contains("backquote") {
                // 1. Capture selected text from the currently active OS application
                let selected_text = get_active_selection_or_clipboard().unwrap_or_default();

                // 2. Store in selection state
                if let Some(state) = app.try_state::<AppSelectionState>() {
                    if let Ok(mut lock) = state.0.lock() {
                        *lock = selected_text.clone();
                    }
                }

                // 3. Show, unminimize, and focus window
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();

                    // 4. Emit event to frontend listeners
                    let _ = window.emit("quick-launch-text", &selected_text);
                    let _ = window.emit("selected-text-input", &selected_text);

                    // 5. Inject DOM event so web app components can immediately react
                    if !selected_text.is_empty() {
                        let json_text = serde_json::to_string(&selected_text).unwrap_or_default();
                        let js_code = format!(
                            "(function() {{ \
                                window.__TAURI_SELECTED_TEXT__ = {json_text}; \
                                window.dispatchEvent(new CustomEvent('tauri-selected-text', {{ detail: {{ text: {json_text} }} }})); \
                            }})();"
                        );
                        let _ = window.eval(&js_code);
                    }
                }
            }
        })
        .build()
}

/// Captures the currently active selection or clipboard text across platforms.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn get_active_selection_or_clipboard() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, simulate Cmd+C in the active app to copy highlighted selection to pasteboard
        let _ = std::process::Command::new("osascript")
            .args(["-e", "tell application \"System Events\" to keystroke \"c\" using command down"])
            .output();
        std::thread::sleep(std::time::Duration::from_millis(50));
        read_macos_clipboard()
    }
    #[cfg(target_os = "linux")]
    {
        // On Linux X11/Wayland, primary selection holds highlighted text without needing Ctrl+C
        if let Ok(output) = std::process::Command::new("xclip")
            .args(["-o", "-selection", "primary"])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
        if let Ok(output) = std::process::Command::new("wl-paste")
            .arg("-p")
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
        // Fallback to standard clipboard
        if let Ok(output) = std::process::Command::new("xclip")
            .args(["-o", "-selection", "clipboard"])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
        if let Ok(output) = std::process::Command::new("wl-paste").output() {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
        None
    }
    #[cfg(target_os = "windows")]
    {
        read_windows_clipboard()
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        None
    }
}

#[cfg(target_os = "macos")]
fn read_macos_clipboard() -> Option<String> {
    if let Ok(output) = std::process::Command::new("pbpaste").output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !text.is_empty() {
                return Some(text);
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn read_windows_clipboard() -> Option<String> {
    if let Ok(output) = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", "Get-Clipboard"])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !text.is_empty() {
                return Some(text);
            }
        }
    }
    None
}

/// Handles `<scheme>://auth-callback?token=...`.
fn handle_deep_link(app: &tauri::AppHandle, raw_url: &str) {
    let Ok(parsed) = Url::parse(raw_url) else {
        return;
    };
    let is_auth_callback =
        parsed.host_str() == Some("auth-callback") || parsed.path().trim_start_matches('/') == "auth-callback";
    if !is_auth_callback {
        return;
    }
    let Some((_, token)) = parsed.query_pairs().find(|(key, _)| key == "token") else {
        return;
    };

    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    // Sign-in completes on the site the window is using — the beta site when
    // that is the chosen source, the live site for the offline build.
    let callback_url = format!(
        "{}/auth/native-callback?token={}",
        app_source::site_url(&app_source::current(app)),
        urlencoding::encode(&token),
    );
    if let Ok(url) = Url::parse(&callback_url) {
        let _ = window.navigate(url);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
