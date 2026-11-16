/**
 * @fileoverview Turns the Debater Stats panel's "Log a round" form into an
 * `OwnRoundHistoryRecord`, and orders logged rounds for its list.
 *
 * Pre-Round Briefings has its own "Log a round" form, which requires an
 * opponent profile because its job is the head-to-head "Prior meetings"
 * record. Stats don't need an opponent, so this form takes one as optional
 * free text: when it matches a profile's `teamId`, the round still counts
 * toward that head-to-head (`getOwnRoundHistoryAgainst` filters on
 * `opponentTeamId`).
 *
 * Pure and storage-free; `panels/DebaterStatsPanel.tsx` saves the record with
 * `state/ownRoundHistory.ts`, which the account sync's `ownRoundHistory`
 * collection picks up.
 *
 * @module round/own-round-log
 */

import type { DebateSide } from "@debate-ai/rankings/src/sync/opponent-team-profile"
import type { OwnRoundHistoryRecord } from "../state/ownRoundHistory"
import { parseArgumentTags } from "./debater-stats"

/** The form's raw field values, as typed. */
export interface OwnRoundLogDraft {
  tournamentName: string
  /** `YYYY-MM-DD`, as an `<input type="date">` gives it. */
  date: string
  division: string
  side: DebateSide
  result: "won" | "lost"
  /** Optional; stored as `opponentTeamId`. */
  opponent: string
  /** Optional case or plan name. */
  caseName: string
  /** Optional comma-separated argument tags. */
  argumentTags: string
  /** Optional words spoken; blank means not logged. */
  speechWordCount: string
}

export const EMPTY_OWN_ROUND_LOG_DRAFT: OwnRoundLogDraft = {
  tournamentName: "",
  date: "",
  division: "",
  side: "aff",
  result: "won",
  opponent: "",
  caseName: "",
  argumentTags: "",
  speechWordCount: "",
}

/** Longest tournament, division, opponent or case name accepted. */
export const MAX_OWN_ROUND_TEXT_LENGTH = 120

export type OwnRoundLogResult = { ok: true; record: OwnRoundHistoryRecord } | { ok: false; error: string }

/** True for a real calendar date written `YYYY-MM-DD` (so `2026-02-30` is refused). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** A unique id in the same `round-log-…` shape Pre-Round Briefings uses. */
export function newOwnRoundId(now: number = Date.now(), random: () => number = Math.random): string {
  return `round-log-${now}-${random().toString(36).slice(2, 8)}`
}

/**
 * Validates a draft and builds the record to save. Tournament, date and
 * division are required; everything else is optional and left off the record
 * when blank, so the stats treat it as "not tracked".
 */
export function buildOwnRoundLogRecord(draft: OwnRoundLogDraft, id: string): OwnRoundLogResult {
  const tournamentName = draft.tournamentName.trim()
  const date = draft.date.trim()
  const division = draft.division.trim()
  const opponent = draft.opponent.trim()
  const caseName = draft.caseName.trim()

  if (!tournamentName || !date || !division) {
    return { ok: false, error: "Tournament, date and division are required." }
  }
  if (!isIsoDate(date)) {
    return { ok: false, error: "Enter the date as a real calendar date." }
  }
  if (draft.side !== "aff" && draft.side !== "neg") {
    return { ok: false, error: "Pick Aff or Neg." }
  }
  if (draft.result !== "won" && draft.result !== "lost") {
    return { ok: false, error: "Pick Won or Lost." }
  }
  for (const [label, value] of [
    ["Tournament", tournamentName],
    ["Division", division],
    ["Opponent", opponent],
    ["Case", caseName],
  ] as const) {
    if (value.length > MAX_OWN_ROUND_TEXT_LENGTH) {
      return { ok: false, error: `${label} must be ${MAX_OWN_ROUND_TEXT_LENGTH} characters or fewer.` }
    }
  }

  const rawWords = draft.speechWordCount.trim()
  const speechWordCount = rawWords === "" ? undefined : Number(rawWords)
  if (speechWordCount !== undefined && !(Number.isInteger(speechWordCount) && speechWordCount > 0)) {
    return { ok: false, error: "Words spoken must be a whole number above zero, or left blank." }
  }

  const argumentTags = parseArgumentTags(draft.argumentTags)

  return {
    ok: true,
    record: {
      id,
      teamId: "self",
      tournamentName,
      date,
      division,
      side: draft.side,
      won: draft.result === "won",
      ...(opponent ? { opponentTeamId: opponent } : {}),
      ...(caseName ? { caseName } : {}),
      ...(argumentTags.length > 0 ? { argumentTags } : {}),
      ...(speechWordCount === undefined ? {} : { speechWordCount }),
    },
  }
}

/** Logged rounds newest first by date; rounds on the same date keep the later-logged one first. */
export function sortOwnRoundsNewestFirst(records: readonly OwnRoundHistoryRecord[]): OwnRoundHistoryRecord[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => (a.record.date === b.record.date ? b.index - a.index : a.record.date < b.record.date ? 1 : -1))
    .map(({ record }) => record)
}

/** One line for the logged-rounds list: `"Blake · LD · Aff · Won vs. Opp"`. */
export function describeOwnRound(record: OwnRoundHistoryRecord): string {
  const parts = [record.tournamentName, record.division, record.side === "aff" ? "Aff" : "Neg"]
  const result = record.won ? "Won" : "Lost"
  parts.push(record.opponentTeamId ? `${result} vs. ${record.opponentTeamId}` : result)
  return parts.join(" · ")
}
