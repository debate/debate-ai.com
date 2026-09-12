/**
 * @fileoverview Detects the native-wrapper Tauri shell (packages/native-wrapper)
 * and exposes native host capabilities:
 *
 * 1. Opening URLs in the system's default browser (Google OAuth login handoff)
 * 2. Background service quick-launch listener (Ctrl+` / Cmd+` global shortcut)
 * 3. Selected text input from the active OS window
 * 4. Autostart on system boot controls (LaunchAgent/Registry/autostart)
 * 5. Window tray toggle (hide to tray / show window)
 */

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
      event?: {
        listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>;
      };
    };
    __TAURI_SELECTED_TEXT__?: string;
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

/**
 * Gets the last captured quick-launch selected text.
 */
export async function getLastSelectedText(): Promise<string> {
  if (typeof window === "undefined") return "";
  if (window.__TAURI_SELECTED_TEXT__) return window.__TAURI_SELECTED_TEXT__;
  if (!window.__TAURI__?.core) return "";
  try {
    const text = (await window.__TAURI__.core.invoke("get_last_selected_text")) as string;
    return text || "";
  } catch {
    return "";
  }
}

/**
 * Subscribes to global quick-launch text events from the OS background service (Ctrl+` / Cmd+`).
 */
export function onQuickLaunchText(callback: (text: string) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent<{ text: string }>;
    if (customEvent.detail?.text) {
      callback(customEvent.detail.text);
    }
  };

  window.addEventListener("tauri-selected-text", handleCustomEvent);

  let unlistenTauri: (() => void) | undefined;
  if (window.__TAURI__?.event?.listen) {
    window.__TAURI__.event
      .listen("quick-launch-text", (event) => {
        if (typeof event.payload === "string" && event.payload) {
          callback(event.payload);
        }
      })
      .then((unlisten) => {
        unlistenTauri = unlisten;
      })
      .catch(() => {});
  }

  return () => {
    window.removeEventListener("tauri-selected-text", handleCustomEvent);
    if (unlistenTauri) unlistenTauri();
  };
}

/**
 * Checks if autostart at system boot is enabled.
 */
export async function isAutostartEnabled(): Promise<boolean> {
  if (typeof window === "undefined" || !window.__TAURI__?.core) return false;
  try {
    return (await window.__TAURI__.core.invoke("plugin:autostart|is_enabled")) as boolean;
  } catch {
    return false;
  }
}

/**
 * Enables or disables autostart at system boot.
 */
export async function setAutostartEnabled(enable: boolean): Promise<boolean> {
  if (typeof window === "undefined" || !window.__TAURI__?.core) return false;
  try {
    if (enable) {
      await window.__TAURI__.core.invoke("plugin:autostart|enable");
    } else {
      await window.__TAURI__.core.invoke("plugin:autostart|disable");
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Hides the main window to the system tray.
 */
export async function hideToTray(): Promise<boolean> {
  if (typeof window === "undefined" || !window.__TAURI__?.core) return false;
  try {
    await window.__TAURI__.core.invoke("hide_to_tray");
    return true;
  } catch {
    return false;
  }
}

/**
 * Shows and focuses the main window from the background.
 */
export async function showMainWindow(): Promise<boolean> {
  if (typeof window === "undefined" || !window.__TAURI__?.core) return false;
  try {
    await window.__TAURI__.core.invoke("show_main_window");
    return true;
  } catch {
    return false;
  }
}
