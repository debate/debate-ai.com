/**
 * @fileoverview Tests for `round/own-round-log.ts` — the Debater Stats
 * panel's "Log a round" validation, record shape and list ordering.
 */

import { describe, expect, it } from "vitest"

import {
  buildOwnRoundLogRecord,
  describeOwnRound,
  EMPTY_OWN_ROUND_LOG_DRAFT,
  isIsoDate,
  MAX_OWN_ROUND_TEXT_LENGTH,
  newOwnRoundId,
  sortOwnRoundsNewestFirst,
  type OwnRoundLogDraft,
} from "../src/round/own-round-log"
import type { OwnRoundHistoryRecord } from "../src/state/ownRoundHistory"

const VALID: OwnRoundLogDraft = {
  ...EMPTY_OWN_ROUND_LOG_DRAFT,
  tournamentName: "  Blake ",
  date: "2026-03-14",
  division: "LD",
}

function errorOf(draft: Partial<OwnRoundLogDraft>): string | null {
  const result = buildOwnRoundLogRecord({ ...VALID, ...draft }, "id-1")
  return result.ok ? null : result.error
}

describe("isIsoDate", () => {
  it("accepts real dates and refuses impossible or malformed ones", () => {
    expect(isIsoDate("2026-03-14")).toBe(true)
    expect(isIsoDate("2024-02-29")).toBe(true)
    expect(isIsoDate("2026-02-30")).toBe(false)
    expect(isIsoDate("2026-13-01")).toBe(false)
    expect(isIsoDate("03/14/2026")).toBe(false)
    expect(isIsoDate("")).toBe(false)
  })
})

describe("buildOwnRoundLogRecord", () => {
  it("builds a minimal record with optional fields left off", () => {
    const result = buildOwnRoundLogRecord(VALID, "id-1")
    expect(result).toEqual({
      ok: true,
      record: {
        id: "id-1",
        teamId: "self",
        tournamentName: "Blake",
        date: "2026-03-14",
        division: "LD",
        side: "aff",
        won: true,
      },
    })
  })

  it("keeps every optional field when filled in", () => {
    const result = buildOwnRoundLogRecord(
      {
        ...VALID,
        side: "neg",
        result: "lost",
        opponent: " Harvard-Westlake AB ",
        caseName: " Climate Aff ",
        argumentTags: "Capitalism K, , Topicality ",
        speechWordCount: " 4200 ",
      },
      "id-2",
    )
    expect(result.ok && result.record).toEqual({
      id: "id-2",
      teamId: "self",
      tournamentName: "Blake",
      date: "2026-03-14",
      division: "LD",
      side: "neg",
      won: false,
      opponentTeamId: "Harvard-Westlake AB",
      caseName: "Climate Aff",
      argumentTags: ["Capitalism K", "Topicality"],
      speechWordCount: 4200,
    })
  })

  it("requires tournament, date and division", () => {
    expect(errorOf({ tournamentName: "  " })).toMatch(/required/)
    expect(errorOf({ date: "" })).toMatch(/required/)
    expect(errorOf({ division: "" })).toMatch(/required/)
  })

  it("refuses an impossible date", () => {
    expect(errorOf({ date: "2026-02-30" })).toMatch(/calendar date/)
  })

  it("refuses a side or result outside the choices", () => {
    expect(errorOf({ side: "both" as never })).toMatch(/Aff or Neg/)
    expect(errorOf({ result: "tie" as never })).toMatch(/Won or Lost/)
  })

  it("refuses words spoken that aren't a positive whole number", () => {
    for (const bad of ["0", "-5", "12.5", "lots", "Infinity"]) {
      expect(errorOf({ speechWordCount: bad })).toMatch(/whole number/)
    }
  })

  it("caps text fields", () => {
    const long = "x".repeat(MAX_OWN_ROUND_TEXT_LENGTH + 1)
    expect(errorOf({ tournamentName: long })).toMatch(/^Tournament must be/)
    expect(errorOf({ caseName: long })).toMatch(/^Case must be/)
    expect(errorOf({ opponent: "x".repeat(MAX_OWN_ROUND_TEXT_LENGTH) })).toBeNull()
  })
})

describe("newOwnRoundId", () => {
  it("uses the round-log prefix and is unique per random draw", () => {
    expect(newOwnRoundId(1000, () => 0.5)).toMatch(/^round-log-1000-\w+$/)
    expect(newOwnRoundId(1000, () => 0.1)).not.toBe(newOwnRoundId(1000, () => 0.2))
  })
})

function rec(id: string, date: string, overrides: Partial<OwnRoundHistoryRecord> = {}): OwnRoundHistoryRecord {
  return { id, teamId: "self", tournamentName: "Blake", date, division: "LD", side: "aff", won: true, ...overrides }
}

describe("sortOwnRoundsNewestFirst", () => {
  it("orders by date, newest first, and puts the later-logged round first on a tie", () => {
    const sorted = sortOwnRoundsNewestFirst([rec("a", "2026-01-01"), rec("b", "2026-03-01"), rec("c", "2026-01-01")])
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"])
  })

  it("does not mutate its input", () => {
    const input = [rec("a", "2026-01-01"), rec("b", "2026-03-01")]
    sortOwnRoundsNewestFirst(input)
    expect(input.map((r) => r.id)).toEqual(["a", "b"])
  })
})

describe("describeOwnRound", () => {
  it("names the tournament, division, side and result, with the opponent when known", () => {
    expect(describeOwnRound(rec("a", "2026-01-01"))).toBe("Blake · LD · Aff · Won")
    expect(describeOwnRound(rec("a", "2026-01-01", { side: "neg", won: false, opponentTeamId: "Opp" }))).toBe(
      "Blake · LD · Neg · Lost vs. Opp",
    )
  })
})
