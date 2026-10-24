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
 * Opens (or re-targets) the mini player window on `href`.
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
