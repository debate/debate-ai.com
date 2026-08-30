/**
 * @fileoverview Account-linked app preferences — TODO.md idea #17 ("User
 * Settings — account-linked debate preferences"), first slice. Pure
 * validation/merge helpers shared by the `/api/settings` D1-backed route
 * (`apps/debate-ai.com`) and `UserSettingsPanel`, kept framework/fetch-free
 * so both sides validate a patch identically without duplicating the
 * `debateStyle`/`fontSize` option lists already defined on the local-only
 * `settings` singleton (`state/settings.ts`).
 *
 * `settings` stays the single source of truth for *what* a
 * `debateStyle`/`fontSize` value means (its options list and default) —
 * this module only adds the "is this a valid value" and "apply a resolved
 * value back into the local singleton" pieces needed to sync it with an
 * account.
 *
 * @module state/userSettings
 */

import { settings } from "./settings";
import type { RadioSetting } from "../types/settings";

const debateStyleSetting = settings.data.debateStyle as RadioSetting;
const fontSizeSetting = settings.data.fontSize as RadioSetting;

/** Valid `debateStyle` indices, in the same order as the picker options. */
export const DEBATE_STYLE_OPTIONS: readonly string[] = debateStyleSetting.detail.options;

/** Valid `fontSize` pixel values, parsed from the picker's `"14px"`-style options. */
export const FONT_SIZE_OPTIONS: readonly number[] = fontSizeSetting.detail.options.map((px) =>
  parseInt(px, 10),
);

export type UserSettingsPayload = {
  debateStyle: number;
  fontSize: number;
};

/** Mirrors the local `settings` singleton's own `auto` (unset) values. */
export const DEFAULT_USER_SETTINGS: UserSettingsPayload = {
  debateStyle: debateStyleSetting.auto,
  fontSize: fontSizeSetting.auto,
};

export function isValidDebateStyleIndex(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < DEBATE_STYLE_OPTIONS.length
  );
}

export function isValidFontSize(value: unknown): value is number {
  return typeof value === "number" && FONT_SIZE_OPTIONS.includes(value);
}

export type UserSettingsPatchResult = {
  /** Only the fields present in `input` *and* valid. */
  valid: Partial<UserSettingsPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch against the
 * `debateStyle`/`fontSize` option lists. Unknown/extra fields are ignored;
 * a present-but-invalid field is dropped into `errors` rather than
 * silently clamped, so the caller can reject the whole request instead of
 * saving a value the user didn't actually choose.
 */
export function normalizeUserSettingsPatch(input: unknown): UserSettingsPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<UserSettingsPayload> = {};
  const errors: string[] = [];

  if ("debateStyle" in record) {
    if (isValidDebateStyleIndex(record.debateStyle)) {
      valid.debateStyle = record.debateStyle;
    } else {
      errors.push(`"debateStyle" must be an integer from 0 to ${DEBATE_STYLE_OPTIONS.length - 1}.`);
    }
  }

  if ("fontSize" in record) {
    if (isValidFontSize(record.fontSize)) {
      valid.fontSize = record.fontSize;
    } else {
      errors.push(`"fontSize" must be one of: ${FONT_SIZE_OPTIONS.join(", ")}.`);
    }
  }

  return { valid, errors };
}

/**
 * Applies a resolved settings payload (e.g. the row fetched from
 * `/api/settings`) back into the local `settings` singleton, so a
 * signed-in user's account preferences immediately drive the same
 * `debateStyle`/`fontSize` reads already wired throughout the flow editor
 * (`DebateRoundPanel`, `SpeechHeaderBar`, `CreateRoundDialog`, ...)
 * without those call sites needing to know an account exists.
 *
 * No-op outside the browser (SSR/tests without `localStorage`), matching
 * every other `state/*.ts` store's guard convention.
 */
export function applyUserSettingsToLocalStore(patch: Partial<UserSettingsPayload>): void {
  if (typeof localStorage === "undefined") return;
  if (patch.debateStyle !== undefined && isValidDebateStyleIndex(patch.debateStyle)) {
    settings.setValue("debateStyle", patch.debateStyle);
  }
  if (patch.fontSize !== undefined && isValidFontSize(patch.fontSize)) {
    settings.setValue("fontSize", patch.fontSize);
  }
  settings.saveToLocalStorage();
}

/** Reads the local singleton's current values as a plain payload. */
export function readLocalUserSettings(): UserSettingsPayload {
  return {
    debateStyle: debateStyleSetting.value,
    fontSize: fontSizeSetting.value,
  };
}
