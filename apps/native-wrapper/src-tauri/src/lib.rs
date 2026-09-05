// Generic Tauri wrapper: opens `generated_scheme::APP_URL` as the main
// window's content and handles one thing beyond that — completing a Google
// OAuth login that necessarily happened in the system browser (Google
// blocks its login flow inside most embedded webviews) by catching the
// `<scheme>://auth-callback?token=...` deep link the site redirects to once
// sign-in succeeds, and using that token to establish the same session in
// this window's webview. See ../docs/OAUTH.md for the full round trip and
// why a plain "load the site" wrapper can't skip this step.

mod generated_scheme;

use tauri::{Manager, Url};
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Neither single-instance nor the updater apply on Android/iOS: the OS
    // already dedupes app launches there, and store updates replace what
    // tauri-plugin-updater does on desktop.
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // On Windows/Linux, clicking a deep link while the app is already
            // running launches a *second* process instead of firing the
            // `on_open_url` event in the first one — single-instance forwards
            // that second launch's argv here instead, so the callback still
            // needs to be pulled out of argv and handled the same way.
            let scheme_prefix = format!("{}://", generated_scheme::DEEP_LINK_SCHEME);
            if let Some(url) = argv.iter().find(|arg| arg.starts_with(&scheme_prefix)) {
                handle_deep_link(app, url);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }));
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
        builder = builder.plugin(fullscreen_toggle_plugin());
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    handle_deep_link(&handle, url.as_str());
                }
            });

            // Desktop platforms must register the scheme with the OS at
            // runtime (the tauri.conf.json `plugins.deep-link.desktop.schemes`
            // entry declares it for the installer; this call is what actually
            // wires it up in dev / for unpackaged runs). Android/iOS pick the
            // scheme up from the generated project's manifest/Info.plist
            // instead, produced by `tauri android init` / `tauri ios init`
            // reading the same tauri.conf.json — calling register_all() there
            // is a no-op.
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let _ = app.deep_link().register_all();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running native-wrapper");
}

/// F11 / Ctrl+Cmd+F toggles the main window's fullscreen state. The window
/// opens fullscreen by default (see profiles/*.json's `window.fullscreen`),
/// which on most platforms hides the title bar entirely, so this is the only
/// way out that doesn't depend on the wrapped page's own JS or a click
/// target that isn't there.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn fullscreen_toggle_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    use tauri_plugin_global_shortcut::ShortcutState;

    tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts(["F11", "CmdOrCtrl+Shift+F"])
        .expect("fullscreen shortcuts are valid accelerator strings")
        .with_handler(|app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            if let Some(window) = app.get_webview_window("main") {
                let is_fullscreen = window.is_fullscreen().unwrap_or(false);
                let _ = window.set_fullscreen(!is_fullscreen);
            }
        })
        .build()
}

/// Handles `<scheme>://auth-callback?token=...`. The token is a one-time
/// login token `/auth/native-complete` minted (via better-auth's
/// one-time-token plugin) from the session the system browser just
/// established with Google. better-auth's verify endpoint is a same-origin
/// POST, not something a plain navigation can hit — so instead of calling it
/// from Rust, this just navigates the window to `/auth/native-callback`
/// (same origin as the site already loaded here), which spends the token
/// client-side. That POST happens same-origin to this webview, so the
/// resulting session cookie lands in *this* webview's cookie jar — the whole
/// reason the token exists, since the system browser's cookies and this
/// window's cookies are different jars that can't otherwise see each other's
/// session. See ../docs/OAUTH.md for the full round trip.
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
    let callback_url = format!(
        "{}/auth/native-callback?token={}",
        generated_scheme::APP_URL,
        urlencoding::encode(&token),
    );
    if let Ok(url) = Url::parse(&callback_url) {
        let _ = window.navigate(url);
        let _ = window.set_focus();
    }
}
