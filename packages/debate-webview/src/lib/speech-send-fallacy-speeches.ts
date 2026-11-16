/**
 * @fileoverview Sent speeches from the Speech Documents send log, shaped for
 * `buildFallacyFrequency` / `FallacyFrequencySummary`.
 *
 * Every entry is text the debater chose to send into their speech doc, so all
 * of it counts. Nothing is stored: Speech Documents recomputes this from the
 * entries it already shows (`speechSendLogStore`, merged with the account's
 * `saved_speech_send_log` rows when signed in), so a removed entry drops out.
 *
 * @module lib/speech-send-fallacy-speeches
 */

import type { FallacyFrequencySpeech } from "@debate-ai/speech-writer"

/** Longest snippet of the sent text a label carries before "…". */
export const SENT_SPEECH_LABEL_SNIPPET_MAX = 40

/** The fields of a send-log entry this module reads. */
export interface SentSpeechEntryLike {
  text: unknown
  preview?: unknown
  sentAt?: unknown
}

function snippet(entry: SentSpeechEntryLike, text: string): string {
  const source = typeof entry.preview === "string" && entry.preview.trim() ? entry.preview : text
  const collapsed = source.replace(/\s+/g, " ").trim()
  return collapsed.length > SENT_SPEECH_LABEL_SNIPPET_MAX
    ? `${collapsed.slice(0, SENT_SPEECH_LABEL_SNIPPET_MAX - 1).trimEnd()}…`
    : collapsed
}

function sentDate(sentAt: unknown): string | null {
  if (typeof sentAt !== "number" || !Number.isFinite(sentAt) || sentAt <= 0) return null
  const date = new Date(sentAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

/**
 * One `FallacyFrequencySpeech` per entry with text, labelled
 * `"<date> · <snippet>"` (just the snippet when `sentAt` is unusable), in the
 * order given. Pass the entries newest first, as the page lists them, so the
 * summary's tie-break favours recent sends. Blank or non-string text is
 * skipped so a malformed stored row can't break the scan.
 */
export function sentSpeechFallacySpeeches(
  entries: readonly (SentSpeechEntryLike | null | undefined)[],
): FallacyFrequencySpeech[] {
  const speeches: FallacyFrequencySpeech[] = []
  for (const entry of entries) {
    if (!entry || typeof entry.text !== "string" || entry.text.trim() === "") continue
    const text = entry.text
    const date = sentDate(entry.sentAt)
    const label = date ? `${date} · ${snippet(entry, text)}` : snippet(entry, text)
    speeches.push({ label, text })
  }
  return speeches
}
