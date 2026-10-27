// @vitest-environment jsdom
/**
 * @fileoverview Interaction tests for `PreRoundBriefingsPanel` — creating a
 * briefing (with an opponent scouting profile and prep notes), the pairing
 * schedule (save / "Use for briefing" / remove), logging the team's own
 * rounds for the head-to-head record, staleness badges, download, clear and
 * cross-tab live update.
 *
 * Real localStorage stores throughout; only the account pairing client is
 * mocked (signed out), and Radix Select is a native `<select>`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"

vi.mock("../src/ui/primitives/select", () => import("./select-mock"))
vi.mock("../src/round/round-pairings-client", () => ({
  listSavedRoundPairings: vi.fn(async () => null),
  saveRoundPairingToAccount: vi.fn(async () => undefined),
  deleteSavedRoundPairingFromAccount: vi.fn(async () => undefined),
}))

const savedFlowMocks = vi.hoisted(() => ({
  listSavedFlows: vi.fn(async () => null as unknown),
  fetchSavedFlow: vi.fn(async () => null as unknown),
}))
vi.mock("../src/round/saved-flows-client", () => savedFlowMocks)

import { PreRoundBriefingsPanel } from "../src/panels/PreRoundBriefingsPanel"
import { recordOpponentRound } from "@debate-ai/data-sync/src/state/opponentRoundRecords"
import { listOwnRoundHistory } from "../src/state/ownRoundHistory"
import { savePreRoundBriefing, buildPreRoundBriefingRecordFromDraft } from "../src/state/preRoundBriefings"
import {
  cleanup,
  mount,
  click,
  typeInto,
  choose,
  flush,
  run,
  buttonByText,
  buttons,
  bodyText,
  captureDownloads,
} from "./dom-helpers"

const NOW = 1_760_000_000_000
const $ = <T extends Element = HTMLInputElement>(sel: string) => document.querySelector<T>(sel)

/** The native select whose (mocked) trigger carried `id`. */
const select = (id: string) => document.querySelector<HTMLSelectElement>(`select#${id}`)

async function renderPanel() {
  await mount(createElement(PreRoundBriefingsPanel))
  await flush()
}

function seedOpponent(teamId = "Westlake AB") {
  recordOpponentRound({
    id: `opp-${teamId}`,
    teamId,
    tournamentName: "Berkeley",
    date: "2026-01-10",
    division: "LD",
    side: "aff",
    won: true,
    argumentTags: ["kritik"],
  })
}

function seedBriefing(roundId: string, updatedAt: number) {
  const result = buildPreRoundBriefingRecordFromDraft({
    roundId,
    tournamentName: "Blake",
    division: "LD",
    roundLabel: "Round 1",
    side: "aff",
    teamPrepNotes: [],
  } as Parameters<typeof buildPreRoundBriefingRecordFromDraft>[0])
  if (!result.ok) throw new Error(result.error)
  savePreRoundBriefing(result.record, updatedAt)
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(Date, "now").mockReturnValue(NOW)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe("PreRoundBriefingsPanel", () => {
  it("shows the empty state and signed-out pairing note", async () => {
    await renderPanel()
    expect(bodyText()).toContain("Pre-Round Briefings")
    expect(bodyText()).toContain("No pre-round briefings yet.")
    expect(bodyText()).toContain("Sign in to sync pairings across devices.")
    expect(bodyText()).toContain("No pairings logged yet.")
  })

  it("validates and saves a briefing with an opponent profile and prep notes", async () => {
    seedOpponent()
    await renderPanel()
    await click(buttonByText("Save briefing"))
    expect(bodyText()).toContain("Round ID, tournament, division, and round label are all required.")

    await typeInto($("#briefing-round-id"), "round-4")
    await typeInto($("#briefing-tournament-name"), "Blake")
    await typeInto($("#briefing-division"), "LD")
    await typeInto($("#briefing-round-label"), "Round 4")
    await typeInto($("#briefing-room"), "201")
    await typeInto($("#briefing-opponent-label"), "WL AB")
    await typeInto($("#briefing-prep-notes"), "Run the K\n\n  Watch for T  ")
    await flush()
    await choose(select("briefing-side"), "neg")
    await choose(select("briefing-opponent-profile"), "Westlake AB")
    await click(buttonByText("Save briefing"))

    const text = bodyText()
    expect(text).not.toContain("are all required")
    expect(text).toContain("Round round-4")
    expect(text).toContain("Blake, LD, Round 4")
    expect(text).toContain("updated <1h ago")
    expect(text).toContain("No prior meetings")
    expect(text).toContain("Run the K")
    expect(text).toContain("Westlake AB")
    // Form keeps tournament + division, clears the rest.
    expect($("#briefing-round-id")!.value).toBe("")
    expect($("#briefing-tournament-name")!.value).toBe("Blake")
    expect($("#briefing-division")!.value).toBe("LD")
  })

  it("labels a briefing's age in hours/days and flags a stale one", async () => {
    seedBriefing("r-fresh", NOW - 3 * 3600_000)
    seedBriefing("r-old", NOW - 50 * 3600_000)
    await renderPanel()
    expect(bodyText()).toContain("updated 3h ago")
    expect(bodyText()).toContain("updated 2d ago")
    expect(document.querySelector('[title*="over the 24-hour staleness threshold"]')).not.toBeNull()
    expect(document.querySelector('[title="Last updated 3 hour(s) ago"]')).not.toBeNull()
  })

  it("downloads and clears a briefing", async () => {
    const downloads = captureDownloads()
    seedBriefing("r1", NOW)
    await renderPanel()
    await click(buttonByText("Download"))
    expect(downloads.names).toHaveLength(1)
    expect(downloads.names[0]).toContain("r1")
    expect(await downloads.blobs[0].text()).toContain("Blake")
    await click(buttonByText("Clear"))
    expect(bodyText()).toContain("No pre-round briefings yet.")
  })

  it("saves a pairing, prefills the briefing form from it, and removes it", async () => {
    await renderPanel()
    await click(buttonByText("Save pairing"))
    expect(bodyText()).toContain("Round ID, tournament, division, and round label are all required.")

    await typeInto($("#pairing-round-id"), "r7")
    await typeInto($("#pairing-tournament-name"), "Glenbrooks")
    await typeInto($("#pairing-division"), "PF")
    await typeInto($("#pairing-round-label"), "Round 7")
    await typeInto($("#pairing-room"), "B12")
    await typeInto($("#pairing-opponent-label"), "Lincoln CD")
    await typeInto($("#pairing-judge-label"), "J. Smith")
    await flush()
    await choose(select("pairing-side"), "neg")
    await click(buttonByText("Save pairing"))
    expect(bodyText()).toContain("Round r7 — Glenbrooks, PF, Round 7 (neg), Room B12, vs. Lincoln CD, Judge: J. Smith")
    expect($("#pairing-round-id")!.value).toBe("")
    expect($("#pairing-tournament-name")!.value).toBe("Glenbrooks")

    await click(buttonByText("Use for briefing"))
    expect($("#briefing-round-id")!.value).toBe("r7")
    expect($("#briefing-room")!.value).toBe("B12")
    expect($("#briefing-opponent-label")!.value).toBe("Lincoln CD")
    expect(select("briefing-side")!.value).toBe("neg")

    const remove = buttons().find((b) => b.textContent === "Remove")
    await click(remove)
    expect(bodyText()).toContain("No pairings logged yet.")
  })

  it("logs own rounds against a scouted opponent, feeding a briefing's head-to-head record", async () => {
    seedOpponent()
    await renderPanel()
    await click(buttonByText("Log round"))
    expect(bodyText()).toContain("Tournament, date, division, and opponent are all required.")

    await typeInto($("#round-log-tournament"), "Blake")
    await typeInto($("#round-log-date"), "2026-02-01")
    await typeInto($("#round-log-division"), "LD")
    await flush()
    await choose(select("round-log-opponent"), "Westlake AB")
    await choose(select("round-log-side"), "neg")
    await choose(select("round-log-result"), "lost")
    await click(buttonByText("Log round"))
    expect(bodyText()).toContain("2026-02-01 — Blake, LD (neg) vs. Westlake AB: L")
    expect($("#round-log-tournament")!.value).toBe("Blake")

    // A briefing against that opponent now shows the prior-meeting record.
    await typeInto($("#briefing-round-id"), "r9")
    await typeInto($("#briefing-tournament-name"), "Blake")
    await typeInto($("#briefing-division"), "LD")
    await typeInto($("#briefing-round-label"), "Round 9")
    await choose(select("briefing-opponent-profile"), "Westlake AB")
    await click(buttonByText("Save briefing"))
    expect(bodyText()).toContain("0-1 vs. opponent")

    const remove = buttons().find((b) => b.textContent === "Remove")
    await click(remove)
    expect(bodyText()).not.toContain("vs. Westlake AB: L")
  })

  it("stores an optional words-spoken count on a logged round and rejects an invalid one", async () => {
    seedOpponent()
    await renderPanel()
    await typeInto($("#round-log-tournament"), "Blake")
    await typeInto($("#round-log-date"), "2026-02-01")
    await typeInto($("#round-log-division"), "LD")
    await flush()
    await choose(select("round-log-opponent"), "Westlake AB")

    await typeInto($("#round-log-words"), "1.5")
    await click(buttonByText("Log round"))
    expect(bodyText()).toContain("Words spoken must be a whole number above zero")
    expect(listOwnRoundHistory()).toHaveLength(0)

    await typeInto($("#round-log-words"), "4200")
    await click(buttonByText("Log round"))
    expect(listOwnRoundHistory()).toMatchObject([{ speechWordCount: 4200 }])
    expect($("#round-log-words")!.value).toBe("")

    // Blank leaves the field off the record entirely.
    await typeInto($("#round-log-date"), "2026-02-02")
    await choose(select("round-log-opponent"), "Westlake AB")
    await click(buttonByText("Log round"))
    expect(listOwnRoundHistory()[1]).not.toHaveProperty("speechWordCount")
  })

  it("stores comma-separated argument tags on a logged round and omits them when blank", async () => {
    seedOpponent()
    await renderPanel()
    await typeInto($("#round-log-tournament"), "Blake")
    await typeInto($("#round-log-date"), "2026-02-01")
    await typeInto($("#round-log-division"), "LD")
    await flush()
    await choose(select("round-log-opponent"), "Westlake AB")
    await typeInto($("#round-log-tags"), " Capitalism K, ,Topicality ")
    await click(buttonByText("Log round"))
    expect(listOwnRoundHistory()).toMatchObject([{ argumentTags: ["Capitalism K", "Topicality"] }])
    expect($("#round-log-tags")!.value).toBe("")

    await typeInto($("#round-log-date"), "2026-02-02")
    await choose(select("round-log-opponent"), "Westlake AB")
    await click(buttonByText("Log round"))
    expect(listOwnRoundHistory()[1]).not.toHaveProperty("argumentTags")
  })

  it("fills words spoken from a saved flow for the selected side", async () => {
    savedFlowMocks.listSavedFlows.mockResolvedValueOnce([
      { clientId: 7, label: "Semis vs Westlake", updatedAt: "2026-02-01T00:00:00Z" },
    ])
    const leaf = { content: "no they do not", children: [], index: 0, level: 2, focus: false, empty: false }
    savedFlowMocks.fetchSavedFlow.mockResolvedValue({
      columns: ["1AC", "1NC"],
      children: [{ content: "tariffs hurt trade", children: [leaf], index: 0, level: 1, focus: false, empty: false }],
    })
    await renderPanel()

    await choose(select("round-log-words-flow"), "7")
    await flush()
    expect($("#round-log-words")!.value).toBe("3")

    // The neg side counts the other column's words.
    await choose(select("round-log-side"), "neg")
    await choose(select("round-log-words-flow"), "7")
    await flush()
    expect($("#round-log-words")!.value).toBe("4")
  })

  it("reports a flow with no words for the side and keeps manual entry", async () => {
    savedFlowMocks.listSavedFlows.mockResolvedValueOnce([
      { clientId: 8, label: "Empty", updatedAt: "2026-02-01T00:00:00Z" },
    ])
    savedFlowMocks.fetchSavedFlow.mockResolvedValue({ columns: ["1AC", "1NC"], children: [] })
    await renderPanel()
    await choose(select("round-log-words-flow"), "8")
    await flush()
    expect(bodyText()).toContain("That flow has no words flowed for the selected side.")
    expect($("#round-log-words")!.value).toBe("")
  })

  it("links a logged round to the saved flow its word count came from", async () => {
    savedFlowMocks.listSavedFlows.mockResolvedValueOnce([
      { clientId: 7, label: "Semis", updatedAt: "2026-02-01T00:00:00Z" },
    ])
    const leaf = { content: "no they do not", children: [], index: 0, level: 2, focus: false, empty: false }
    savedFlowMocks.fetchSavedFlow.mockResolvedValue({
      columns: ["1AC", "1NC"],
      children: [{ content: "tariffs hurt trade", children: [leaf], index: 0, level: 1, focus: false, empty: false }],
    })
    seedOpponent()
    await renderPanel()
    await typeInto($("#round-log-tournament"), "Blake")
    await typeInto($("#round-log-date"), "2026-02-01")
    await typeInto($("#round-log-division"), "LD")
    await flush()
    await choose(select("round-log-opponent"), "Westlake AB")
    await choose(select("round-log-words-flow"), "7")
    await flush()
    await click(buttonByText("Log round"))

    const link = document.querySelector<HTMLAnchorElement>('a[href="/debate?flowId=7"]')
    expect(link?.textContent).toBe("Open flow")
    expect(JSON.parse(localStorage.getItem("ownRoundHistory") ?? "[]")[0].flowClientId).toBe(7)
  })

  it("logs a round without a flow link when no flow was picked", async () => {
    seedOpponent()
    await renderPanel()
    await typeInto($("#round-log-tournament"), "Blake")
    await typeInto($("#round-log-date"), "2026-02-01")
    await typeInto($("#round-log-division"), "LD")
    await flush()
    await choose(select("round-log-opponent"), "Westlake AB")
    await click(buttonByText("Log round"))
    expect(document.querySelector('a[href^="/debate?flowId="]')).toBeNull()
    expect(JSON.parse(localStorage.getItem("ownRoundHistory") ?? "[]")[0]).not.toHaveProperty("flowClientId")
  })

  it("re-reads briefings and own-round history when another tab writes them", async () => {
    await renderPanel()
    seedBriefing("remote-1", NOW)
    await run(() => window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" })))
    expect(bodyText()).not.toContain("Round remote-1")
    await run(() => window.dispatchEvent(new StorageEvent("storage", { key: "preRoundBriefings" })))
    expect(bodyText()).toContain("Round remote-1")
    await run(() => window.dispatchEvent(new StorageEvent("storage", { key: null })))
    expect(bodyText()).toContain("Round remote-1")
  })
})
