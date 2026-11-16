/**
 * @fileoverview The debater's own speeches from saved Practice vs AI rounds,
 * shaped for `buildFallacyFrequency` / `FallacyFrequencySummary`.
 *
 * Only `User` messages count: the hints are about the debater's phrasing, and
 * the bot's speeches would inflate the totals with text the user never wrote.
 * Nothing is stored; Debate History recomputes this from the
 * `practice_vs_ai_debates` rows it already loaded.
 *
 * @module ui/history-fallacy-speeches
 */

import type { FallacyFrequencySpeech } from "@debate-ai/speech-writer"
import type { DebateVsBotRecord } from "../backend"

/** "Topic — Phase" for one user speech; falls back to "Practice debate" / "Speech". */
function speechLabel(topic: string | undefined, phase: string | undefined): string {
  const t = typeof topic === "string" && topic.trim() ? topic.trim() : "Practice debate"
  const p = typeof phase === "string" && phase.trim() ? phase.trim() : "Speech"
  return `${t} — ${p}`
}

/**
 * Every user speech across `debates`, newest round first (the order the
 * history list uses), in transcript order within a round. Blank or non-string
 * text is dropped here so a malformed stored message can't break the scan.
 */
export function practiceDebateUserSpeeches(
  debates: readonly Pick<DebateVsBotRecord, "topic" | "history">[],
): FallacyFrequencySpeech[] {
  const speeches: FallacyFrequencySpeech[] = []
  for (const debate of debates) {
    if (!Array.isArray(debate?.history)) continue
    for (const message of debate.history) {
      if (message?.sender !== "User") continue
      if (typeof message.text !== "string" || message.text.trim() === "") continue
      speeches.push({ label: speechLabel(debate.topic, message.phase), text: message.text })
    }
  }
  return speeches
}
