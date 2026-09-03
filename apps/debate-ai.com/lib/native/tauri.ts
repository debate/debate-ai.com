/**
 * @fileoverview Detects the native-wrapper Tauri shell (packages/native-wrapper)
 * and lets pages ask it to open a URL in the system's default browser.
 *
 * Used only by the sign-in handoff: Google (and most OAuth providers) block
 * their login flow inside embedded webviews, so the wrapper's login has to
 * happen in a real browser and hand the session back via a deep link — see
 * packages/native-wrapper/docs/OAUTH.md for the full round trip.
 *
 * This app takes on no @tauri-apps/* dependency for this. The wrapper injects
 * `window.__TAURI__` itself, scoped to this site's origin (see
 * packages/native-wrapper/src-tauri/capabilities/remote.json), and this file
 * just talks to that global — so the site has zero build-time coupling to
 * Tauri and behaves identically (native = false) in an ordinary browser tab.
 */

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

/** True when this page is rendered inside the native-wrapper shell. */
export function isNativeWrapper(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI__?.core);
}

/**
 * Opens `url` in the OS's default browser via the wrapper's opener plugin.
 * No-ops (returns false) outside the wrapper — callers should fall back to a
 * normal same-window navigation in that case.
 */
export async function openInSystemBrowser(url: string): Promise<boolean> {
  if (typeof window === "undefined" || !window.__TAURI__?.core) return false;
  await window.__TAURI__.core.invoke("plugin:opener|open_url", { url });
  return true;
}
