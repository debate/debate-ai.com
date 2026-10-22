// @vitest-environment jsdom
/**
 * @fileoverview Tests for `DebaterStatsPanel` — the empty state, headline
 * stats and breakdowns computed from logged rounds, and cross-tab live update.
 * Real localStorage store; no mocks.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createElement } from "react"

import { DebaterStatsPanel, formatWinRate, formatWords } from "../src/panels/DebaterStatsPanel"
import { saveOwnRoundHistoryRecord, type OwnRoundHistoryRecord } from "../src/state/ownRoundHistory"
import { cleanup, mount, flush, run, bodyText } from "./dom-helpers"

function logRound(id: string, overrides: Partial<OwnRoundHistoryRecord> = {}) {
  saveOwnRoundHistoryRecord({
    id,
    teamId: "Opp",
    tournamentName: "Berkeley",
    date: "2026-01-10",
    division: "LD",
    side: "aff",
    won: true,
    argumentTags: ["kritik"],
    ...overrides,
  } as OwnRoundHistoryRecord)
}

beforeEach(() => localStorage.clear())
afterEach(() => cleanup())

describe("formatWinRate", () => {
  it("rounds to a whole percent and dashes a missing rate", () => {
    expect(formatWinRate(0.67)).toBe("67%")
    expect(formatWinRate(1)).toBe("100%")
    expect(formatWinRate(null)).toBe("—")
  })
})

describe("formatWords", () => {
  it("groups thousands and dashes a missing count", () => {
    expect(formatWords(4200)).toBe("4,200")
    expect(formatWords(null)).toBe("—")
  })
})

describe("DebaterStatsPanel", () => {
  it("shows speech length only when a round logged a word count", async () => {
    logRound("r1")
    await mount(createElement(DebaterStatsPanel))
    await flush()
    expect(bodyText()).not.toContain("Speech length")
    cleanup()
    logRound("r2", { speechWordCount: 4200 })
    await mount(createElement(DebaterStatsPanel))
    await flush()
    expect(bodyText()).toContain("Speech length")
    expect(bodyText()).toContain("4,200")
  })

  it("explains how to log rounds when none exist", async () => {
    await mount(createElement(DebaterStatsPanel))
    await flush()
    expect(bodyText()).toContain("No rounds logged yet")
  })

  it("shows win rate, side split and breakdowns for logged rounds", async () => {
    logRound("r1")
    logRound("r2", { side: "neg", won: false, division: "PF", argumentTags: ["topicality"] })
    logRound("r3", { won: true, caseName: "Climate Aff" })
    await mount(createElement(DebaterStatsPanel))
    await flush()
    const text = bodyText()
    expect(text).toContain("67%") // 2 of 3
    expect(text).toContain("2–1 in 3 rounds")
    expect(text).toContain("By division")
    expect(text).toContain("PF")
    expect(text).toContain("topicality")
    expect(text).toContain("By case")
    expect(text).toContain("Climate Aff")
    expect(text).toContain("Not enough rounds yet")
  })

  it("re-reads when another tab changes the round history", async () => {
    await mount(createElement(DebaterStatsPanel))
    await flush()
    expect(bodyText()).toContain("No rounds logged yet")
    logRound("r1")
    await run(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "ownRoundHistory" }))
    })
    expect(bodyText()).not.toContain("No rounds logged yet")
    expect(bodyText()).toContain("100%")
  })

  it("ignores storage events for other keys", async () => {
    await mount(createElement(DebaterStatsPanel))
    await flush()
    logRound("r1")
    await run(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "prepNotes" }))
    })
    expect(bodyText()).toContain("No rounds logged yet")
  })
})
