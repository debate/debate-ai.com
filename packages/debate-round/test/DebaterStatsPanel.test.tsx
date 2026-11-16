// @vitest-environment jsdom
/**
 * @fileoverview Tests for `DebaterStatsPanel` — the empty state, headline
 * stats and breakdowns computed from logged rounds, and cross-tab live update.
 * Real localStorage store; no mocks.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"

import { DebaterStatsPanel, formatWinRate, formatWords } from "../src/panels/DebaterStatsPanel"
import { listOwnRoundHistory, saveOwnRoundHistoryRecord, type OwnRoundHistoryRecord } from "../src/state/ownRoundHistory"
import { cleanup, mount, flush, run, bodyText, buttonByText, click, choose, typeInto } from "./dom-helpers"

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
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

  it("shows the current streak and a by-case breakdown", async () => {
    logRound("r1", { date: "2026-01-01", won: false, caseName: "Space Aff" })
    logRound("r2", { date: "2026-01-02", won: true, caseName: "Space Aff" })
    logRound("r3", { date: "2026-01-03", won: true })
    await mount(createElement(DebaterStatsPanel))
    await flush()
    const text = bodyText()
    expect(text).toContain("2-round win streak")
    expect(text).toContain("By case")
    expect(text).toContain("Space Aff")
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

  it("logs a round from its own form, without an opponent, and updates the stats", async () => {
    await mount(createElement(DebaterStatsPanel))
    await flush()
    await click(buttonByText("Log a round"))
    await typeInto(document.getElementById("stats-log-tournamentName"), "Blake")
    await typeInto(document.getElementById("stats-log-date"), "2026-03-14")
    await typeInto(document.getElementById("stats-log-division"), "LD")
    await choose(document.getElementById("stats-log-side"), "neg")
    await choose(document.getElementById("stats-log-result"), "lost")
    await typeInto(document.getElementById("stats-log-argumentTags"), "Topicality")
    await click(buttonByText("Save round"))

    const saved = listOwnRoundHistory()
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ tournamentName: "Blake", division: "LD", side: "neg", won: false, argumentTags: ["Topicality"] })
    expect(saved[0].opponentTeamId).toBeUndefined()
    expect(bodyText()).not.toContain("No rounds logged yet")
    expect(bodyText()).toContain("0–1 in 1 round")
    expect(bodyText()).toContain("Blake · LD · Neg · Lost")
    // Tournament and division stay filled for the next round.
    expect((document.getElementById("stats-log-tournamentName") as HTMLInputElement).value).toBe("Blake")
  })

  it("shows the validation error and saves nothing for an incomplete round", async () => {
    await mount(createElement(DebaterStatsPanel))
    await flush()
    await click(buttonByText("Log a round"))
    await typeInto(document.getElementById("stats-log-tournamentName"), "Blake")
    await click(buttonByText("Save round"))
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/required/)
    expect(listOwnRoundHistory()).toHaveLength(0)
  })

  it("deletes a logged round only after confirming", async () => {
    logRound("r1", { date: "2026-01-01", tournamentName: "Berkeley" })
    logRound("r2", { date: "2026-02-01", tournamentName: "Emory", won: false })
    await mount(createElement(DebaterStatsPanel))
    await flush()
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true)
    const list = document.querySelector('[data-testid="debater-stats-logged-rounds"]')!
    // Newest first.
    expect(list.querySelector("li")?.textContent).toContain("Emory")

    await click(buttonByText("Delete", list))
    expect(listOwnRoundHistory()).toHaveLength(2)

    await click(buttonByText("Delete", list))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(listOwnRoundHistory().map((r) => r.id)).toEqual(["r1"])
    expect(bodyText()).not.toContain("Emory")
    expect(bodyText()).toContain("100%")
  })

  it("lists five logged rounds until Show all", async () => {
    for (let i = 1; i <= 7; i++) logRound(`r${i}`, { date: `2026-01-0${i}` })
    await mount(createElement(DebaterStatsPanel))
    await flush()
    const items = () => document.querySelectorAll('[data-testid="debater-stats-logged-rounds"] li').length
    expect(items()).toBe(5)
    await click(buttonByText("Show all 7"))
    expect(items()).toBe(7)
  })
})
