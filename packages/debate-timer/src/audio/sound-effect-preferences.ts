/**
 * @fileoverview The reader's UI sound-effect level, shared by every
 * place that plays one.
 *
 * The sound effects (`sound-effects.ts`) are played from the timers,
 * the sidebar, the mobile drawer and the command palette. Whether
 * they play at all — and how many — is one choice for the whole app,
 * kept in localStorage under {@link SOUND_EFFECT_LEVEL_KEY} and
 * broadcast to every subscriber in the document, so the level a
 * reader picks in Settings applies everywhere immediately and survives
 * a reload.
 *
 * Signed in, the level also follows the account: the key is the
 * `soundEffectLevel` collection in `@debate-ai/research-evidence`'s
 * tool-record catalog, whose watcher pushes a change and whose merge
 * writes the account's level back here (firing a `storage` event, which
 * {@link subscribeSoundEffectLevel} listens for). That sync reads JSON,
 * so the level is stored JSON-encoded (`"minimal"`, quotes included);
 * a bare value written before the sync existed is still read, and is
 * re-stored as JSON the first time anything subscribes.
 *
 * Three levels:
 * - `all` (the default): every effect plays.
 * - `minimal`: only the effects that confirm a meaningful state
 *   change or alert the reader (a sidebar opening, a timer
 *   finishing) — the decorative blips, bounces and camera shutters
 *   stay silent.
 * - `off`: no effects at all.
 *
 * @module audio/sound-effect-preferences
 */

import { useSyncExternalStore } from "react"
import { playSoundEffect, type SoundEffect } from "./sound-effects"

/** localStorage key for the sound-effect level. */
export const SOUND_EFFECT_LEVEL_KEY = "sound-effect-level"

/** How many UI sound effects play. */
export type SoundEffectLevel = "all" | "minimal" | "off"

/** The level a reader who has never chosen one gets. */
export const DEFAULT_SOUND_EFFECT_LEVEL: SoundEffectLevel = "all"

/**
 * The effects that still play in `minimal` mode: the ones that
 * confirm a state change (a sidebar or drawer opening or closing) or
 * alert the reader (a timer finishing, an error, a notification).
 * The decorative blips, bounces and camera shutters are `all` only.
 */
const MINIMAL_SOUND_EFFECTS: ReadonlySet<SoundEffect> = new Set<SoundEffect>([
  "finalBwong",
  "buzz",
  "bloop",
  "popUpOn",
  "popDown",
])

/** Same-document change event; other tabs get the real `storage` event. */
const CHANGE_EVENT = "sound-effect-level-change"

export function isSoundEffectLevel(value: string | null): value is SoundEffectLevel {
  return value === "all" || value === "minimal" || value === "off"
}

/**
 * The level a stored string names: the JSON-encoded form the store
 * writes, or a bare level from before the account sync. Anything else
 * (missing, `null` from an empty account merge, corrupt) is `null`.
 */
function parseStoredLevel(stored: string | null): SoundEffectLevel | null {
  if (stored === null) return null
  if (isSoundEffectLevel(stored)) return stored
  try {
    const parsed: unknown = JSON.parse(stored)
    return typeof parsed === "string" && isSoundEffectLevel(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** The reader's current sound-effect level. */
export function readSoundEffectLevel(): SoundEffectLevel {
  try {
    return parseStoredLevel(localStorage.getItem(SOUND_EFFECT_LEVEL_KEY)) ?? DEFAULT_SOUND_EFFECT_LEVEL
  } catch {
    return DEFAULT_SOUND_EFFECT_LEVEL
  }
}

/**
 * Re-stores a bare pre-sync level (`minimal`) as JSON (`"minimal"`), so
 * the account sync — which skips a value it can't parse — picks it up.
 * Idempotent; silent when storage is blocked.
 */
function upgradeLegacyStoredLevel(): void {
  try {
    const stored = localStorage.getItem(SOUND_EFFECT_LEVEL_KEY)
    if (isSoundEffectLevel(stored)) localStorage.setItem(SOUND_EFFECT_LEVEL_KEY, JSON.stringify(stored))
  } catch {
    // Blocked storage: nothing stored to upgrade.
  }
}

/**
 * Sets the level everywhere, and remembers it. The default is stored
 * too, not cleared, so going back to "all" reaches the account and
 * replaces another device's choice rather than vanishing locally.
 */
export function setSoundEffectLevel(level: SoundEffectLevel): void {
  if (readSoundEffectLevel() === level) return
  try {
    localStorage.setItem(SOUND_EFFECT_LEVEL_KEY, JSON.stringify(level))
  } catch {
    // Blocked storage: the choice still applies to this page, just isn't kept.
    memoryLevel = level
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Fallback when localStorage throws (private mode, blocked site data). */
let memoryLevel: SoundEffectLevel | null = null

function getSnapshot(): SoundEffectLevel {
  return memoryLevel ?? readSoundEffectLevel()
}

function subscribe(onChange: () => void): () => void {
  upgradeLegacyStoredLevel()
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SOUND_EFFECT_LEVEL_KEY) onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/**
 * Subscribes to level changes from this document or another tab —
 * the non-React form of {@link useSoundEffectLevel}, for a settings
 * field that loads its value after mount (so the server render and
 * the first client render agree).
 */
export function subscribeSoundEffectLevel(onChange: () => void): () => void {
  return subscribe(onChange)
}

/**
 * The current sound-effect level. The server (and the hydrating
 * render) always sees the default, so markup never disagrees with the
 * client.
 */
export function useSoundEffectLevel(): SoundEffectLevel {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SOUND_EFFECT_LEVEL)
}

/**
 * Plays a UI sound effect, if the reader's level allows it. A no-op
 * when the level is `off`, or when it's `minimal` and the effect is
 * one of the decorative ones. Safe to call from any event handler.
 */
export function playUISoundEffect(effect: SoundEffect): void {
  const level = getSnapshot()
  if (level === "off") return
  if (level === "minimal" && !MINIMAL_SOUND_EFFECTS.has(effect)) return
  playSoundEffect(effect)
}
