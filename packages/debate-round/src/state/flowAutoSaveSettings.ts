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
