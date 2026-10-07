// Camera and microphone access for the wrapped app (the webcam room, the
// speech recorder). Two things stand between a page and `getUserMedia` in a
// WebView, beyond the OS-level camera prompt:
//
// 1. Linux: WebKitGTK ships with media streams and WebRTC switched off, and
//    while they are off `navigator.mediaDevices` is simply `undefined`.
//    `enable_media` turns both on for the main window.
// 2. Every platform: the WebView asks the host app whether a page may use a
//    camera or microphone. `permission_response` grants it to the app's own
//    content (the profile's sources and the bundled offline build) and leaves
//    anything else to the WebView's default.
//
// macOS also needs NSCameraUsageDescription / NSMicrophoneUsageDescription in
// Info.plist (written by scripts/configure.mjs) and, for a signed build, the
// camera and audio-input entitlements in Entitlements.plist.

use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::{Runtime, Url, Webview};

use crate::app_source;
use crate::generated_scheme::SOURCES;

/// Whether `url` is the app's own content: the bundled frontend, or one of
/// the profile's sites (or a subdomain of one).
pub fn is_trusted(url: &Url) -> bool {
    if let Ok(bundled) = Url::parse(app_source::bundled_origin()) {
        if url.scheme() == bundled.scheme() && url.host_str() == bundled.host_str() {
            return true;
        }
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    if url.scheme() != "https" {
        return false;
    }
    SOURCES
        .iter()
        .filter(|(_, _, source)| !app_source::is_bundled(source))
        .filter_map(|(_, _, source)| Url::parse(source).ok())
        .filter_map(|source| source.host_str().map(str::to_owned))
        .any(|site| host == site || host.ends_with(&format!(".{site}")))
}

/// The answer to a WebView permission request from `webview`.
pub fn permission_response<R: Runtime>(webview: &Webview<R>, kind: PermissionKind) -> PermissionResponse {
    let wants_media = matches!(kind, PermissionKind::Camera | PermissionKind::Microphone);
    match webview.url() {
        Ok(url) if wants_media && is_trusted(&url) => PermissionResponse::Allow,
        _ => PermissionResponse::Default,
    }
}

/// Switches on WebKitGTK's media stream and WebRTC support, without which
/// `navigator.mediaDevices` does not exist. Other platforms have it on.
#[cfg(target_os = "linux")]
pub fn enable_media<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    let _ = window.with_webview(|webview| {
        use webkit2gtk::{SettingsExt, WebViewExt};
        if let Some(settings) = webview.inner().settings() {
            settings.set_enable_media_stream(true);
            settings.set_enable_webrtc(true);
        }
    });
}

#[cfg(not(target_os = "linux"))]
pub fn enable_media<R: Runtime>(_window: &tauri::WebviewWindow<R>) {}

#[cfg(test)]
mod tests {
    use super::*;

    fn trusted(url: &str) -> bool {
        is_trusted(&Url::parse(url).unwrap())
    }

    #[test]
    fn trusts_the_profile_sites_and_their_subdomains() {
        for (_, _, source) in SOURCES.iter().filter(|(_, _, s)| !app_source::is_bundled(s)) {
            let url = Url::parse(source).unwrap();
            assert!(trusted(&format!("{source}/round/abc")));
            assert!(trusted(&format!("https://www.{}/", url.host_str().unwrap())));
        }
    }

    #[test]
    fn trusts_the_bundled_offline_build() {
        assert!(trusted(&format!("{}offline/index.html", app_source::bundled_origin())));
    }

    #[test]
    fn does_not_trust_other_sites() {
        assert!(!trusted("https://example.com/"));
        assert!(!trusted("https://notdebate-ai.com/"));
        assert!(!trusted("http://debate-ai.com/"));
    }
}
