/**
 * @fileoverview Device-local preference for flow auto-save (see
 * `createFlowAutoSaver`): `"saved"` (default) keeps auto-saving only flows
 * already on the account, `"all"` also uploads flows with no account baseline
 * (never saved, or not yet restored after a reload), `"off"` disables it.
 *
 * Stored in `localStorage` like the font family: it applies immediately and is
 * not synced to `/api/settings`. Reads fall back to the default when storage is
 * unavailable or holds an unknown value.
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
