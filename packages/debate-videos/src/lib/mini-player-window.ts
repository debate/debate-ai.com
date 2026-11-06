/**
 * @fileoverview The mini player window: a small, separate window that plays
 * one video with its speech switcher, so a debater can keep a round going in
 * the corner of the screen while they work in another app.
 *
 * In the desktop app (the Tauri wrapper in `apps/debate-native-wrapper`) it
 * is a native window the wrapper opens on request, and it can float above
 * every other window ("always on top"). In a browser it is an ordinary popup
 * window: browsers give a page no way to keep a popup above other apps, so
 * the pin control only appears in the desktop app.
 *
 * When the site is open in an ordinary browser on a computer that also has
 * the desktop app running, the pop-out goes to the app instead: the app
 * listens on a loopback port (the "desktop bridge", `desktop_bridge.rs` in the
 * wrapper) and opens its own always-on-top mini window for the same page. If
 * the app doesn't answer, the browser popup opens as before.
 *
 * The wrapper is detected by duck-typing `window.__TAURI__` rather than
 * importing `@debate-ai/webview`'s native helpers — this package sits below the
 * webview package, and the global's full type is declared there.
 * @module lib/mini-player-window
 */

/** Name of the browser popup, so a second pop-out reuses the same window. */
export const MINI_PLAYER_WINDOW_NAME = "debate-mini-player"

/** Where the reader's last always-on-top choice is kept. */
export const MINI_PLAYER_ON_TOP_KEY = "debate-videos:mini-player-on-top"

/** Popup size in a browser; the desktop app picks its own (see `mini_player.rs`). */
const POPUP_FEATURES = "popup,width=480,height=360"

/**
 * The desktop bridge's loopback port. Must match `desktopBridgePort` in
 * `apps/debate-native-wrapper/profiles/debate-ai.json`.
 */
export const DESKTOP_BRIDGE_PORT = 47615

/** The bridge's address. `127.0.0.1` rather than `localhost`, which some systems resolve to IPv6 first. */
export const DESKTOP_BRIDGE_URL = `http://127.0.0.1:${DESKTOP_BRIDGE_PORT}`

/**
 * How long to wait for the desktop app. A closed port fails at once; this
 * only runs out while the browser holds the request (Chrome asks the reader,
 * once, whether the site may reach apps on this device). It stays short so
 * the browser popup that follows still counts as part of the click.
 */
const DESKTOP_BRIDGE_TIMEOUT_MS = 800

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

/** The wrapper's `invoke`, or `null` outside the desktop app. */
function tauriInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") return null
  const tauri = (window as unknown as { __TAURI__?: { core?: { invoke?: TauriInvoke } } }).__TAURI__
  return tauri?.core?.invoke ?? null
}

/** True when this page runs inside the desktop app. */
export function isDesktopApp(): boolean {
  return tauriInvoke() !== null
}

/**
 * The mini player's address for a video, opening at `startSeconds`.
 *
 * Keyed by the YouTube id rather than the canonical title path: the window
 * is not a page anyone shares or a crawler indexes, and the id survives a
 * retitle that would break the canonical path mid-session.
 */
export function miniPlayerHref(videoId: string, startSeconds = 0): string {
  const start = Math.floor(startSeconds)
  return `/videos/mini/${encodeURIComponent(videoId)}${start > 0 ? `?t=${start}` : ""}`
}

/** Seconds to open at from a `?t=` value; 0 for anything that is not a whole, positive number. */
export function parseMiniPlayerStart(value: string | null | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 0
  return Number(value)
}

/** The reader's last always-on-top choice — on unless they turned it off. */
export function readMiniPlayerOnTop(): boolean {
  try {
    return localStorage.getItem(MINI_PLAYER_ON_TOP_KEY) !== "0"
  } catch {
    return true
  }
}

function writeMiniPlayerOnTop(enabled: boolean): void {
  try {
    localStorage.setItem(MINI_PLAYER_ON_TOP_KEY, enabled ? "1" : "0")
  } catch {
    // Storage blocked: the choice simply isn't remembered.
  }
}

function absoluteUrl(href: string): string {
  return new URL(href, window.location.href).toString()
}

/**
 * Whether this page could hand the mini player to a desktop app running
 * alongside it: a secure page (the app only answers its own https sites) in
 * a desktop browser, not inside the app itself.
 */
export function canUseDesktopBridge(
  env: { protocol: string; userAgent: string; inApp: boolean } = {
    protocol: typeof location === "undefined" ? "" : location.protocol,
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    inApp: isDesktopApp(),
  },
): boolean {
  if (env.inApp || env.protocol !== "https:") return false
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(env.userAgent)
}

/**
 * Asks the desktop app, if it is running on this computer, to open `href`
 * in its always-on-top mini window.
 *
 * @returns Whether the app opened it — false when the app isn't installed
 * or running, the browser blocked the request, or the app refused it.
 */
export async function openInDesktopApp(href: string, alwaysOnTop = readMiniPlayerOnTop()): Promise<boolean> {
  if (typeof fetch === "undefined") return false
  const url = new URL(href, typeof window === "undefined" ? "https://debate-ai.com" : window.location.href)
  try {
    const response = await fetch(`${DESKTOP_BRIDGE_URL}/mini-player`, {
      method: "POST",
      // text/plain keeps this a "simple" request: no preflight round trip.
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ path: url.pathname + url.search, alwaysOnTop }),
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(DESKTOP_BRIDGE_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Opens (or re-targets) the mini player window on `href`: the desktop app's
 * own window when this page runs inside the app, or when the app is running
 * alongside this browser; otherwise a browser popup.
 *
 * @returns Whether a window was opened — false when the browser blocked the
 * popup or the desktop app refused the request.
 */
export async function openMiniPlayerWindow(href: string): Promise<boolean> {
  if (typeof window === "undefined") return false
  const invoke = tauriInvoke()
  if (invoke) {
    try {
      await invoke("open_mini_player", { url: absoluteUrl(href), alwaysOnTop: readMiniPlayerOnTop() })
      return true
    } catch {
      return false
    }
  }
  if (canUseDesktopBridge() && (await openInDesktopApp(href))) return true
  const popup = window.open(href, MINI_PLAYER_WINDOW_NAME, POPUP_FEATURES)
  popup?.focus()
  return popup !== null
}

/**
 * Pins the calling window above every other window, or unpins it. Desktop
 * app only; the choice is remembered for the next pop-out.
 *
 * @returns Whether the window's state changed.
 */
export async function setMiniPlayerOnTop(enabled: boolean): Promise<boolean> {
  writeMiniPlayerOnTop(enabled)
  const invoke = tauriInvoke()
  if (!invoke) return false
  try {
    await invoke("set_always_on_top", { enabled })
    return true
  } catch {
    return false
  }
}

/**
 * Leaves the mini player for the full watch page at `href`: the main window
 * (or, in a browser, the tab that opened the popup) goes there, and the mini
 * window closes.
 */
export async function returnToFullPage(href: string): Promise<void> {
  if (typeof window === "undefined") return
  const invoke = tauriInvoke()
  if (invoke) {
    try {
      await invoke("restore_from_mini_player", { url: absoluteUrl(href) })
      return
    } catch {
      // Fall through to the browser behaviour below.
    }
  }
  const opener = window.opener as Window | null
  if (opener && !opener.closed) {
    try {
      opener.location.href = absoluteUrl(href)
      opener.focus()
      window.close()
      return
    } catch {
      // A cross-origin opener can't be steered; open a tab instead.
    }
  }
  window.open(href, "_blank", "noopener")
}
