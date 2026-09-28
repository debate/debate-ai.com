/**
 * Account-linked CardMirror editor settings — `/settings` is the editor's
 * settings surface in this app (see `app/settings/page.tsx`), so a signed-in
 * user's choices follow them across devices instead of staying in one
 * browser's localStorage.
 *
 * Every category the page hosts is mirrored, which is now the editor's whole
 * tab set ({@link EDITOR_SETTINGS_TABS}) rather than the three categories
 * that were first moved out of its gear-icon modal (General, Appearance and
 * Accessibility). Appearance and Accessibility have no other home — the modal
 * dropped them when they moved here — while the rest are the same rows that
 * modal still shows; both write the same local store, and this mirror is what
 * carries them to the account.
 *
 * Credentials are the exception: an API key or a relay token is a secret this
 * browser holds, not a preference to copy onto a server row, so
 * {@link LOCAL_ONLY_KEYS} keeps them out of the mirror in both directions —
 * the same rule the editor's own settings export applies
 * (`SECRET_SETTING_KEYS`, in `debate-editor`'s `settings.ts`).
 *
 * A patch is a plain `{ [settingKey]: value }` map. Values are whatever
 * shape `SettingMeta`'s `kind` implies (booleans, numbers, strings, nested
 * objects like `displayColors`) — this module doesn't attempt to
 * type-validate each one individually the way `debate-round`'s
 * `normalizeUserSettingsPatch` does for its small, fixed field set; with
 * ~160 settings across the hosted categories, the practical boundary is
 * "only known keys, valid JSON, bounded size" (mirroring
 * `favoriteTools`'s shape-only validation), same posture the editor's own
 * `settings.replaceAll()` already takes for its Import Settings action.
 */

import { SECRET_SETTING_KEYS, SETTING_METADATA, type SettingsCategory } from "debate-editor/settings"

/**
 * The settings categories `/settings` hosts, in the order it shows them,
 * with the editor's own labels — its full tab set, plus the Appearance and
 * Accessibility tabs that live only here, in the position the editor's
 * `CATEGORY_TABS` used to carry them.
 *
 * `plugins` is deliberately absent: plugins are installed by the Electron
 * main process, so every row in that category is desktop-only and the tab
 * would render empty on the web.
 */
export const EDITOR_SETTINGS_TABS: readonly { id: SettingsCategory; label: string }[] = [
  { id: "general", label: "General" },
  { id: "files", label: "Files" },
  { id: "appearance", label: "Appearance" },
  { id: "accessibility", label: "Accessibility" },
  { id: "editing", label: "Editing" },
  { id: "shortcuts", label: "Keyboard" },
  { id: "comments-ai", label: "Comments & AI" },
  { id: "pairing", label: "Collaboration" },
]

/**
 * Settings the page may render but never mirrors to the account: the
 * editor's own secrets (provider API keys, the translation key) plus the
 * self-hosted relay's bearer token, which the editor's export happens not to
 * list but is a credential all the same.
 */
const LOCAL_ONLY_KEYS: ReadonlySet<string> = new Set<string>([
  ...SECRET_SETTING_KEYS,
  "pairingRelayToken",
])

/** Every setting key `/settings` may save to the account — the allow-list a
 *  patch's keys are checked against, and the filter a stored row is read
 *  back through. */
export const EDITOR_PREFERENCE_KEYS: ReadonlySet<string> = new Set(
  SETTING_METADATA.filter(
    (m) => EDITOR_SETTINGS_TABS.some((tab) => tab.id === m.category) && !LOCAL_ONLY_KEYS.has(m.key),
  ).map((m) => m.key),
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
