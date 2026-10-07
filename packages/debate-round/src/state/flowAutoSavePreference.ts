/**
 * @fileoverview On/off preference for flow auto-save (`createFlowAutoSaver`).
 *
 * Device-local (localStorage) and on by default, so existing behaviour is
 * unchanged until someone opts out in the Preferences panel. Exposes a tiny
 * subscribe API for `useSyncExternalStore`, and notifies other tabs through
 * the `storage` event.
 *
 * @module state/flowAutoSavePreference
 */

export const FLOW_AUTO_SAVE_PREF_KEY = "debate:flow-auto-save-enabled";

const listeners = new Set<() => void>();

function readStorage(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(FLOW_AUTO_SAVE_PREF_KEY);
  } catch {
    return null;
  }
}

/** True unless the user has explicitly turned auto-save off. */
export function isFlowAutoSaveEnabled(): boolean {
  return readStorage() !== "off";
}

export function setFlowAutoSaveEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== "undefined") {
      if (enabled) localStorage.removeItem(FLOW_AUTO_SAVE_PREF_KEY);
      else localStorage.setItem(FLOW_AUTO_SAVE_PREF_KEY, "off");
    }
  } catch {
    // Storage unavailable: the in-session notification below still applies.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeFlowAutoSavePreference(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FLOW_AUTO_SAVE_PREF_KEY) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
