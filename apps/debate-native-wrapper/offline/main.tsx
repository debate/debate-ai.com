/**
 * The wrapper's offline source: the whole debate-ai.com app (`debate-webview`)
 * bundled into the app as dist/offline/, so the window has something to show
 * with no network. The user picks it in the wrapper's settings
 * (dist/settings.html); see src-tauri/src/app_source.rs.
 *
 * This is the same package the website mounts from Next and the browser
 * extension mounts on its Options page; like the extension, this host routes
 * through the URL fragment and sends `/api` to the live site, since there is
 * no server behind the app's own origin (`tauri://localhost`). Tools that run
 * in the page (timer, flow, editor) work offline; anything that reads from
 * the server needs the network, and signing in happens on the live site.
 */

// First, so `/api` is repointed before any module the app imports (the auth
// client among them) can hold on to the unwrapped `fetch`.
import { SITE } from "./api-proxy"

import React from "react"
import ReactDOM from "react-dom/client"
import { DebateApp, applyStoredAppearance, configureHost } from "@debate/webview"

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
const invoke = (window as unknown as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__?.core?.invoke

/** Opens a page of the live site in the system browser. */
function openInBrowser(url: string): void {
  if (invoke) void invoke("plugin:opener|open_url", { url })
  else window.open(url, "_blank", "noopener")
}

/** Inline, since the compiled stylesheet only has the classes the app uses. */
const SETTINGS_LINK_STYLE: React.CSSProperties = {
  position: "fixed",
  right: 12,
  bottom: 12,
  zIndex: 50,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  font: "500 12px/1.2 system-ui, sans-serif",
  textDecoration: "none",
  opacity: 0.85,
}

configureHost({
  // No server behind this origin to frame, no network for Google's One Tap
  // script, and no service worker at the root of a bundled page.
  framing: false,
  oneTap: false,
  serviceWorker: false,
  // Sign-in is the site's native OAuth handoff (docs/OAUTH.md), which lands
  // the window on the live site; switch the source back from settings.
  signIn: () => window.location.assign(`${SITE}/login`),
  openOnSite: (path) => openInBrowser(`${SITE}${path}`),
})

applyStoredAppearance()
if (!window.location.hash) window.history.replaceState(null, "", "#/videos")

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DebateApp />
    {/* The wrapper's own settings page, to switch back to the live or beta site. */}
    <a
      href="../settings.html"
      style={SETTINGS_LINK_STYLE}
      title="Choose where the app loads from: offline, debate-ai.com or the beta"
    >
      Offline · Change
    </a>
  </React.StrictMode>,
)
