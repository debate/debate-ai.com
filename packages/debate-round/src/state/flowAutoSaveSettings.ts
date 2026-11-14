/**
 * @fileoverview Device-local preference for flow auto-save (see
 * `createFlowAutoSaver`): `"saved"` (default) keeps auto-saving only flows
 * already on the account, `"all"` also uploads flows with no account baseline
 * (never saved, or not yet restored after a reload), `"off"` disables it.
 *
 * Stored in `localStorage` so it applies immediately; a signed-in user's choice
 * is also synced to `/api/settings` (`flow_auto_save` column, see
 * `normalizeFlowAutoSavePatch`) so it follows them across devices. Reads fall
 * back to the default when storage is unavailable or holds an unknown value.
 *
 * This is the only flow auto-save preference. An older device-only on/off
 * checkbox ("Auto-save flows to my account", `debate:flow-auto-save-enabled`)
 * used to gate the saver as well, so turning it off on one device silently
 * overrode the account's mode. It is retired: a browser that still holds its
 * `"off"` and has no mode of its own reads as mode `"off"`, and the next
 * {@link setFlowAutoSaveMode} (a pick in Settings, or the account's choice
 * arriving) removes the legacy key.
 *
 * @module state/flowAutoSaveSettings
 */

export type FlowAutoSaveMode = "off" | "saved" | "all";

export const FLOW_AUTO_SAVE_MODES: readonly FlowAutoSaveMode[] = ["off", "saved", "all"];
export const DEFAULT_FLOW_AUTO_SAVE_MODE: FlowAutoSaveMode = "saved";

const STORAGE_KEY = "debate:flow-auto-save";
/** The retired device-only on/off checkbox; read only to migrate an opt-out. */
export const LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY = "debate:flow-auto-save-enabled";

const listeners = new Set<() => void>();

export function isFlowAutoSaveMode(value: unknown): value is FlowAutoSaveMode {
  return typeof value === "string" && (FLOW_AUTO_SAVE_MODES as readonly string[]).includes(value);
}

export function readFlowAutoSaveMode(): FlowAutoSaveMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isFlowAutoSaveMode(raw)) return raw;
    // No mode yet: honour an opt-out made with the retired checkbox.
    return localStorage.getItem(LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY) === "off" ? "off" : DEFAULT_FLOW_AUTO_SAVE_MODE;
  } catch {
    return DEFAULT_FLOW_AUTO_SAVE_MODE;
  }
}

/** Stores the mode, drops the retired checkbox's key, and notifies subscribers in this tab. */
export function setFlowAutoSaveMode(mode: FlowAutoSaveMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    localStorage.removeItem(LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY);
  } catch {
    // Storage blocked: the choice just won't persist past this page.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Calls `listener` whenever the mode may have changed: a
 * {@link setFlowAutoSaveMode} in this tab, or a `storage` event for either key
 * from another tab. Shaped for `useSyncExternalStore`; returns the unsubscribe.
 */
export function subscribeFlowAutoSaveMode(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY || event.key === LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export type FlowAutoSavePatchResult = {
  /** Only the field when present *and* valid. */
  valid: { flowAutoSave?: FlowAutoSaveMode };
  errors: string[];
};

/** Validates the `flowAutoSave` field of an untrusted `/api/settings` PUT body. */
export function normalizeFlowAutoSavePatch(input: unknown): FlowAutoSavePatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: [] };
  }
  const record = input as Record<string, unknown>;
  if (!("flowAutoSave" in record)) return { valid: {}, errors: [] };
  if (isFlowAutoSaveMode(record.flowAutoSave)) return { valid: { flowAutoSave: record.flowAutoSave }, errors: [] };
  return { valid: {}, errors: [`"flowAutoSave" must be one of: ${FLOW_AUTO_SAVE_MODES.join(", ")}.`] };
}

/**
 * Reads the stored column value for the `/api/settings` payload: `null` when
 * the account has no (valid) choice yet, so a client can tell "never synced"
 * apart from an explicit `"saved"` and seed the account from its device.
 */
export function parseStoredFlowAutoSave(raw: string | null | undefined): FlowAutoSaveMode | null {
  return isFlowAutoSaveMode(raw) ? raw : null;
}

/** Reads the stored column value, falling back to the default for null/unknown. */
export function parseFlowAutoSave(raw: string | null | undefined): FlowAutoSaveMode {
  return isFlowAutoSaveMode(raw) ? raw : DEFAULT_FLOW_AUTO_SAVE_MODE;
}
