/**
 * @fileoverview Device-local preference for flow auto-save (see
 * `createFlowAutoSaver`): `"saved"` (default) keeps auto-saving only flows
 * already on the account, `"all"` also uploads flows with no account baseline
 * (never saved, or not yet restored after a reload), `"off"` disables it.
 *
 * Stored in `localStorage` so it applies immediately, and mirrored to the
 * account's `user_settings.flow_auto_save` column through `/api/settings`
 * (`normalizeFlowAutoSavePatch` validates the PUT body; `null` on the account
 * means "never chosen", so the device keeps its own value). Reads fall back to
 * the default when storage is unavailable or holds an unknown value.
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

export type FlowAutoSavePatchResult = {
  /** Present only when `input` carried a valid `flowAutoSave`. */
  valid: { flowAutoSave?: FlowAutoSaveMode };
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted `/api/settings` PUT body's `flowAutoSave` field. A
 * present-but-unknown value is reported rather than coerced, matching
 * `normalizeThemeSettingsPatch`.
 */
export function normalizeFlowAutoSavePatch(input: unknown): FlowAutoSavePatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }
  const record = input as Record<string, unknown>;
  if (!("flowAutoSave" in record)) return { valid: {}, errors: [] };
  if (isFlowAutoSaveMode(record.flowAutoSave)) {
    return { valid: { flowAutoSave: record.flowAutoSave }, errors: [] };
  }
  return { valid: {}, errors: [`"flowAutoSave" must be one of: ${FLOW_AUTO_SAVE_MODES.join(", ")}.`] };
}
