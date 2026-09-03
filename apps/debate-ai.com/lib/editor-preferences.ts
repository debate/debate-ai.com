/**
 * Account-linked CardMirror editor preferences (General / Appearance /
 * Accessibility) — moved out of the editor's own gear-icon settings modal
 * (see packages/debate-editor/src/editor/settings.ts) onto
 * /settings, so a signed-in user's choices (color theme, fonts, sizing,
 * accessibility overrides, ...) follow them across devices instead of
 * staying in one browser's localStorage.
 *
 * A patch is a plain `{ [settingKey]: value }` map. Values are whatever
 * shape `SettingMeta`'s `kind` implies (booleans, numbers, strings, nested
 * objects like `displayColors`) — this module doesn't attempt to
 * type-validate each one individually the way `debate-round`'s
 * `normalizeUserSettingsPatch` does for its small, fixed field set; with
 * ~75 settings across the three categories, the practical boundary is
 * "only known keys, valid JSON, bounded size" (mirroring
 * `favoriteTools`'s shape-only validation), same posture the editor's own
 * `settings.replaceAll()` already takes for its Import Settings action.
 */

import { SETTING_METADATA, type SettingsCategory } from "debate-editor/settings"

const MIGRATED_CATEGORIES: readonly SettingsCategory[] = ["general", "appearance", "accessibility"]

/** Every setting key that lives on /settings now rather than in the
 *  editor's own modal — the allow-list a patch's keys are checked against. */
export const EDITOR_PREFERENCE_KEYS: ReadonlySet<string> = new Set(
  SETTING_METADATA.filter((m) => MIGRATED_CATEGORIES.includes(m.category)).map((m) => m.key),
)

/** Generous but bounded, so a buggy or malicious client can't grow the row without limit. */
const MAX_SERIALIZED_BYTES = 100_000

export type EditorPreferencesPayload = Record<string, unknown>

export type EditorPreferencesPatchResult = {
  valid: EditorPreferencesPayload
  errors: string[]
}

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch: every key
 * must be a known migrated setting; unknown keys are reported as errors
 * rather than silently dropped, so a typo or a stale client doesn't lose
 * data quietly.
 */
export function normalizeEditorPreferencesPatch(input: unknown): EditorPreferencesPatchResult {
  if (input === undefined) return { valid: {}, errors: [] }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ['"editorPreferences" must be a JSON object.'] }
  }

  const record = input as Record<string, unknown>
  const valid: EditorPreferencesPayload = {}
  const errors: string[] = []

  for (const key of Object.keys(record)) {
    if (EDITOR_PREFERENCE_KEYS.has(key)) {
      valid[key] = record[key]
    } else {
      errors.push(`"${key}" is not a known editor preference.`)
    }
  }

  const serialized = JSON.stringify(valid)
  if (serialized.length > MAX_SERIALIZED_BYTES) {
    return { valid: {}, errors: ["Editor preferences patch is too large."] }
  }

  return { valid, errors }
}

/** Serializes a preferences map for the `editor_preferences` D1 column:
 *  `null` when empty, matching the "no saved value yet" semantics every
 *  other nullable column on `user_settings` uses. */
export function serializeEditorPreferences(patch: EditorPreferencesPayload): string | null {
  return Object.keys(patch).length === 0 ? null : JSON.stringify(patch)
}

/** Parses the `editor_preferences` D1 column back into a map. Never
 *  throws — a null, malformed, or invalid-shape value reads back as an
 *  empty map rather than erroring the request. */
export function parseEditorPreferences(raw: string | null | undefined): EditorPreferencesPayload {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
    const out: EditorPreferencesPayload = {}
    for (const key of Object.keys(parsed)) {
      if (EDITOR_PREFERENCE_KEYS.has(key)) out[key] = parsed[key]
    }
    return out
  } catch {
    return {}
  }
}

/** Merges a patch onto an existing stored map — a PUT here is a partial
 *  update (one control's worth of change at a time), not a full replace. */
export function mergeEditorPreferences(
  existing: EditorPreferencesPayload,
  patch: EditorPreferencesPayload,
): EditorPreferencesPayload {
  return { ...existing, ...patch }
}
