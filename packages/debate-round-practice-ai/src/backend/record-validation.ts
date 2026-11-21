/**
 * @fileoverview Shape check for a `DebateVsBotRecord` that arrives from
 * outside the vs-bot handlers — today, a Settings → "Restore from export…"
 * file. The handlers build records themselves, so they never needed one.
 *
 * Deliberately strict on structure and lenient on content: every field the
 * round screens read must be the right type, but an unfinished round (no
 * outcome, short history) is still a valid record.
 *
 * @module backend/record-validation
 */

import type { DebateVsBotRecord, RoundDebriefRecord } from "./types"

/** Largest JSON-encoded record a restore writes, in characters. */
export const MAX_SAVED_PRACTICE_DEBATE_BYTES = 2_000_000

/** Longest transcript a restored record may carry. */
export const MAX_PRACTICE_DEBATE_MESSAGES = 500

/**
 * Longest Coach debrief kept with a round, in characters. The coach is asked
 * for a short debrief, so this only stops a runaway reply or a forged
 * request from bloating the row.
 */
export const MAX_ROUND_DEBRIEF_CHARS = 8_000

/** Longest coaching-style id a saved debrief may name. */
export const MAX_ROUND_DEBRIEF_PERSONA_CHARS = 64

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isMessage = (value: unknown) =>
  isRecord(value) &&
  typeof value.sender === "string" &&
  typeof value.text === "string" &&
  (value.phase === undefined || typeof value.phase === "string")

const isSeconds = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0

const isTiming = (value: unknown) =>
  isRecord(value) && typeof value.name === "string" && isSeconds(value.userTime) && isSeconds(value.botTime)

/**
 * True when `value` is a {@link RoundDebriefRecord}: a non-blank `personaId`
 * of at most {@link MAX_ROUND_DEBRIEF_PERSONA_CHARS} characters, a non-blank
 * `text` of at most {@link MAX_ROUND_DEBRIEF_CHARS}, and a positive integer
 * Unix-seconds `savedAt`.
 */
export function isValidRoundDebrief(value: unknown): value is RoundDebriefRecord {
  if (!isRecord(value)) return false
  if (typeof value.personaId !== "string" || !value.personaId.trim()) return false
  if (value.personaId.length > MAX_ROUND_DEBRIEF_PERSONA_CHARS) return false
  if (typeof value.text !== "string" || !value.text.trim() || value.text.length > MAX_ROUND_DEBRIEF_CHARS) return false
  return typeof value.savedAt === "number" && Number.isInteger(value.savedAt) && value.savedAt > 0
}

/**
 * True when `value` has every field of a {@link DebateVsBotRecord} with the
 * right type: string `botName` / `botLevel` / `topic` / `stance`, a non-blank
 * `topic`, a `history` of `{ sender, text, phase? }` (at most
 * {@link MAX_PRACTICE_DEBATE_MESSAGES}), `phaseTimings` of
 * `{ name, userTime, botTime }`, an optional string `outcome`, an optional
 * `debrief` that passes {@link isValidRoundDebrief}, and a positive
 * Unix-seconds `createdAt`. `id` and `email` are not checked: a restore
 * assigns its own row id and owner.
 */
export function isValidDebateVsBotRecord(value: unknown): value is DebateVsBotRecord {
  if (!isRecord(value)) return false
  if (typeof value.botName !== "string" || typeof value.botLevel !== "string") return false
  if (typeof value.topic !== "string" || !value.topic.trim()) return false
  if (typeof value.stance !== "string") return false
  if (!Array.isArray(value.history) || value.history.length > MAX_PRACTICE_DEBATE_MESSAGES || !value.history.every(isMessage)) return false
  if (!Array.isArray(value.phaseTimings) || !value.phaseTimings.every(isTiming)) return false
  if (value.outcome !== undefined && typeof value.outcome !== "string") return false
  if (value.debrief !== undefined && !isValidRoundDebrief(value.debrief)) return false
  return typeof value.createdAt === "number" && Number.isInteger(value.createdAt) && value.createdAt > 0
}
