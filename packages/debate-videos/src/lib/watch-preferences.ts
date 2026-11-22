/**
 * @fileoverview The video watch page's remembered choices, in one store that
 * follows a signed-in viewer to every device.
 *
 * Four choices live here:
 *
 * - `copyFormat` — what the copy button puts on the clipboard (`lib/copy-format`).
 * - `autoScroll` — whether the speech tabs follow playback (`WatchSidePanel`).
 * - `skipBreaks` — whether playback jumps over prep time between speeches.
 * - `liveCaption` — whether the live caption line above the tabs is shown.
 *
 * They are kept as one JSON object under {@link WATCH_PREFERENCES_STORAGE_KEY}
 * because the account sync (`@debate-ai/research-evidence`'s tool-record
 * catalog, collection `videoWatchPreferences`) reads JSON: its watcher pushes
 * a change, and its merge writes the account's choices back here. Before that
 * each choice had its own key holding a bare `"on"` / `"off"` / format string;
 * those {@link LEGACY_WATCH_PREFERENCE_KEYS} are still read when the object
 * has no value for a choice, and are removed once that choice is written
 * again.
 *
 * Every read and write tolerates blocked storage (private windows, cleared
 * site data): a read falls back to the default and a write lasts for the page.
 *
 * @module lib/watch-preferences
 */

import { DEFAULT_COPY_FORMAT, isCopyFormat, type CopyFormat } from "./copy-format"

/** Where the watch page's choices are kept in `localStorage`. */
export const WATCH_PREFERENCES_STORAGE_KEY = "debate-videos:watch-preferences"

/** The watch page's remembered choices. Every field is optional: absent means "never chosen". */
export interface WatchPreferences {
  copyFormat?: CopyFormat
  autoScroll?: boolean
  skipBreaks?: boolean
  liveCaption?: boolean
}

/** One of the remembered choices. */
export type WatchPreferenceName = keyof WatchPreferences

/** What a viewer who never chose gets. */
export const DEFAULT_WATCH_PREFERENCES: Required<WatchPreferences> = {
  copyFormat: DEFAULT_COPY_FORMAT,
  autoScroll: true,
  skipBreaks: true,
  liveCaption: true,
}

/** The per-choice keys used before the choices were combined, each holding a bare string. */
export const LEGACY_WATCH_PREFERENCE_KEYS: Readonly<Record<WatchPreferenceName, string>> = {
  copyFormat: "debate-videos:copy-format",
  autoScroll: "debate-videos:watch-auto-scroll",
  skipBreaks: "debate-videos:watch-skip-breaks",
  liveCaption: "debate-videos:watch-live-caption",
}

const BOOLEAN_PREFERENCES = ["autoScroll", "skipBreaks", "liveCaption"] as const

/**
 * Keeps only the valid choices of an untrusted value (a parsed store, an
 * account record): a known copy format and real booleans. Anything else —
 * a corrupt store, a field from a newer version — is dropped, not guessed at.
 */
export function sanitizeWatchPreferences(value: unknown): WatchPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const clean: WatchPreferences = {}
  if (isCopyFormat(source.copyFormat)) clean.copyFormat = source.copyFormat
  for (const name of BOOLEAN_PREFERENCES) {
    if (typeof source[name] === "boolean") clean[name] = source[name] as boolean
  }
  return clean
}

/** The combined store's valid choices; `{}` when it is missing, corrupt or blocked. */
function readStoredPreferences(): WatchPreferences {
  try {
    const raw = window.localStorage.getItem(WATCH_PREFERENCES_STORAGE_KEY)
    return raw ? sanitizeWatchPreferences(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

/** A choice saved under its pre-sync key, or `undefined` when there is none (or it is unreadable). */
function readLegacyPreference<K extends WatchPreferenceName>(name: K): WatchPreferences[K] | undefined {
  try {
    const raw = window.localStorage.getItem(LEGACY_WATCH_PREFERENCE_KEYS[name])
    if (raw === null) return undefined
    if (name === "copyFormat") return (isCopyFormat(raw) ? raw : undefined) as WatchPreferences[K] | undefined
    // The old boolean keys stored "on" / "off" and treated anything but "off" as on.
    return (raw !== "off") as WatchPreferences[K]
  } catch {
    return undefined
  }
}

/**
 * Reads one choice: the combined store's value, else the pre-sync key's,
 * else the default.
 *
 * @param name - Which choice to read.
 * @returns The remembered value, or {@link DEFAULT_WATCH_PREFERENCES}'s.
 */
export function readWatchPreference<K extends WatchPreferenceName>(name: K): Required<WatchPreferences>[K] {
  const stored = readStoredPreferences()[name]
  if (stored !== undefined) return stored as Required<WatchPreferences>[K]
  const legacy = readLegacyPreference(name)
  if (legacy !== undefined) return legacy as Required<WatchPreferences>[K]
  return DEFAULT_WATCH_PREFERENCES[name]
}

/**
 * Remembers one choice in the combined store, keeping the others, and drops
 * that choice's pre-sync key so the old value can't come back. Blocked
 * storage is swallowed: the choice then lasts for this page only.
 *
 * @param name - Which choice to write.
 * @param value - Its new value.
 */
export function writeWatchPreference<K extends WatchPreferenceName>(
  name: K,
  value: Required<WatchPreferences>[K],
): void {
  try {
    const next = sanitizeWatchPreferences({ ...readStoredPreferences(), [name]: value })
    window.localStorage.setItem(WATCH_PREFERENCES_STORAGE_KEY, JSON.stringify(next))
    window.localStorage.removeItem(LEGACY_WATCH_PREFERENCE_KEYS[name])
  } catch {
    // Private windows and blocked site data: the choice lasts for this page only.
  }
}
