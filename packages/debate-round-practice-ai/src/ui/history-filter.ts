/**
 * @fileoverview Search, result filter and win–loss tally for Debate History.
 *
 * `GET /api/vsbot/history` answers every Practice vs AI round the signed-in
 * user saved in `practice_vs_ai_debates`, newest first. With a few dozen
 * rounds the list became a long scroll with no way to find one topic or
 * opponent, or to see the record at a glance. These pure helpers back the
 * search box, the result filter and the "N of M rounds" line in
 * `DebateHistory`; nothing extra is fetched or stored.
 *
 * @module ui/history-filter
 */

import { resolveResultStatus, type DebateVsBotRecord } from "../backend"

/** One round's result as Debate History labels it. */
export type DebateHistoryResult = "won" | "lost" | "draw" | "conceded" | "inProgress"

/** The result filter's value: every round, or rounds with one result. */
export type DebateHistoryResultFilter = "all" | DebateHistoryResult

/** The filter menu's options, in menu order. */
export const DEBATE_HISTORY_RESULT_OPTIONS: ReadonlyArray<{ value: DebateHistoryResultFilter; label: string }> = [
  { value: "all", label: "All results" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "draw", label: "Draw" },
  { value: "conceded", label: "Conceded" },
  { value: "inProgress", label: "In progress" },
]

/** The outcome text a concede stores (see the `concede` handler). */
const CONCEDED_OUTCOME = "User conceded"

/**
 * Classifies a round by its stored `outcome`: blank is still in progress, a
 * concede is its own result, and a judged round is read with
 * {@link resolveResultStatus} (an unreadable verdict counts as in progress,
 * matching the badge).
 */
export function debateHistoryResult(outcome: string | undefined): DebateHistoryResult {
  if (!outcome) return "inProgress"
  if (outcome === CONCEDED_OUTCOME) return "conceded"
  switch (resolveResultStatus(outcome)) {
    case "win":
      return "won"
    case "loss":
      return "lost"
    case "draw":
      return "draw"
    default:
      return "inProgress"
  }
}

/** Narrows a stored or typed value to a filter, falling back to `"all"`. */
export function toDebateHistoryResultFilter(value: unknown): DebateHistoryResultFilter {
  return DEBATE_HISTORY_RESULT_OPTIONS.some((option) => option.value === value)
    ? (value as DebateHistoryResultFilter)
    : "all"
}

export interface DebateHistoryFilter {
  /** Matched case-insensitively against the topic and the opponent's name; blank matches all. */
  query?: string
  result?: DebateHistoryResultFilter
}

/**
 * The rounds that match a search and a result filter, in their original
 * (newest-first) order. Every word of the query must appear in the topic or
 * the opponent's name, so "tariff kant" finds a tariffs round against Kant.
 * Never mutates the input.
 */
export function filterDebateHistory<T extends Pick<DebateVsBotRecord, "topic" | "botName" | "outcome">>(
  debates: readonly T[],
  { query = "", result = "all" }: DebateHistoryFilter = {},
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return debates.filter((debate) => {
    if (result !== "all" && debateHistoryResult(debate.outcome) !== result) return false
    if (words.length === 0) return true
    const haystack = `${debate.topic ?? ""} ${debate.botName ?? ""}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

/** How many rounds have each result. */
export type DebateHistoryTally = Record<DebateHistoryResult, number>

/** Counts the rounds of each result. */
export function tallyDebateHistory(debates: ReadonlyArray<Pick<DebateVsBotRecord, "outcome">>): DebateHistoryTally {
  const tally: DebateHistoryTally = { won: 0, lost: 0, draw: 0, conceded: 0, inProgress: 0 }
  for (const debate of debates) tally[debateHistoryResult(debate.outcome)]++
  return tally
}

/**
 * The record line over the list, e.g. "Record: 4–2 · 1 draw · 1 conceded".
 * Concedes are listed apart from losses because the judge never ruled; draws
 * and concedes are left out when there are none. `null` when no round has
 * finished.
 */
export function debateHistoryRecordLabel(tally: DebateHistoryTally): string | null {
  if (tally.won + tally.lost + tally.draw + tally.conceded === 0) return null
  const parts = [`Record: ${tally.won}–${tally.lost}`]
  if (tally.draw > 0) parts.push(`${tally.draw} ${tally.draw === 1 ? "draw" : "draws"}`)
  if (tally.conceded > 0) parts.push(`${tally.conceded} conceded`)
  return parts.join(" · ")
}

/** "12 rounds" with no filter on, "3 of 12 rounds" while one narrows the list. */
export function debateHistoryCountLabel(shown: number, total: number): string {
  const noun = total === 1 ? "round" : "rounds"
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`
}
