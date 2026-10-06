/**
 * @fileoverview Device-local preference for flow auto-save (see
 * `createFlowAutoSaver`): `"saved"` (default) keeps auto-saving only flows
 * already on the account, `"all"` also uploads flows with no account baseline
 * (never saved, or not yet restored after a reload), `"off"` disables it.
 *
 * Stored in `localStorage` so it applies immediately, and mirrored to the
 * account's `/api/settings` row (`flowAutoSave`, nullable: `null` means "never
 * chosen", so a device's own choice is not overridden). Reads fall back to the
 * default when storage is unavailable or holds an unknown value.
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

/** The account-synced shape on `/api/settings`; `null` until a mode is saved. */
export type FlowAutoSavePayload = {
  flowAutoSave: FlowAutoSaveMode | null;
};

export type FlowAutoSavePatchResult = {
  /** Only the field when present *and* valid. */
  valid: { flowAutoSave?: FlowAutoSaveMode };
  /** One message per rejected field. */
  errors: string[];
};

/**
 * Validates an untrusted request-body patch. A present-but-invalid
 * `flowAutoSave` is reported rather than clamped, matching
 * `normalizeUserSettingsPatch`.
 */
export function normalizeFlowAutoSavePatch(input: unknown): FlowAutoSavePatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: [] };
  }
  const record = input as Record<string, unknown>;
  if (!("flowAutoSave" in record)) return { valid: {}, errors: [] };
  if (isFlowAutoSaveMode(record.flowAutoSave)) {
    return { valid: { flowAutoSave: record.flowAutoSave }, errors: [] };
  }
  return {
    valid: {},
    errors: [`"flowAutoSave" must be one of: ${FLOW_AUTO_SAVE_MODES.join(", ")}.`],
  };
}

/** Parses the stored column value; anything unknown reads as "never chosen". */
export function parseFlowAutoSave(raw: string | null | undefined): FlowAutoSaveMode | null {
  return isFlowAutoSaveMode(raw) ? raw : null;
}

/**
 * Adopts the account's mode on this device. Returns the mode now in effect:
 * the account's when it has one, otherwise the local choice (left untouched).
 */
export function adoptAccountFlowAutoSave(remote: unknown): FlowAutoSaveMode {
  if (isFlowAutoSaveMode(remote)) {
    setFlowAutoSaveMode(remote);
    return remote;
  }
  return readFlowAutoSaveMode();
}
