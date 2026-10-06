/**
 * @fileoverview Device-local preference for flow auto-save (see
 * `createFlowAutoSaver`): `"saved"` (default) keeps auto-saving only flows
 * already on the account, `"all"` also uploads flows with no account baseline
 * (never saved, or not yet restored after a reload), `"off"` disables it.
 *
 * Stored in `localStorage` like the font family, so it applies immediately and
 * works signed out. A signed-in user's choice is also mirrored to the
 * account's `user_settings.flow_auto_save_mode` (`flowAutoSaveMode` on
 * `/api/settings`) so it follows them to other devices; `UserSettingsPanel`
 * adopts the account value on load. Reads fall back to the default when
 * storage is unavailable or holds an unknown value.
 *
 * @module state/flowAutoSaveSettings
 */

export type FlowAutoSaveMode = "off" | "saved" | "all";

export const FLOW_AUTO_SAVE_MODES: readonly FlowAutoSaveMode[] = ["off", "saved", "all"];
export const DEFAULT_FLOW_AUTO_SAVE_MODE: FlowAutoSaveMode = "saved";

const STORAGE_KEY = "debate:flow-auto-save";

export function isFlowAutoSaveMode(value: unknown): value is FlowAutoSaveMode {
  return typeof value === "string" && (FLOW_AUTO_SAVE_MODES as readonly string[]).includes(value);
}

/**
 * Narrows an untrusted account value (a column read or a response field) to a
 * mode, or `null` for "never set on the account" / anything unrecognised, so
 * a missing or corrupt value never overrides this device's own choice.
 */
export function parseAccountFlowAutoSaveMode(value: unknown): FlowAutoSaveMode | null {
  return isFlowAutoSaveMode(value) ? value : null;
}

export function readFlowAutoSaveMode(): FlowAutoSaveMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isFlowAutoSaveMode(raw) ? raw : DEFAULT_FLOW_AUTO_SAVE_MODE;
  } catch {
    return DEFAULT_FLOW_AUTO_SAVE_MODE;
  }
}

export function setFlowAutoSaveMode(mode: FlowAutoSaveMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage blocked: the choice just won't persist past this page.
  }
}
