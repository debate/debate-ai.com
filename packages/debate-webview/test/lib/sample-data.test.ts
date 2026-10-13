/**
 * @fileoverview Pins the Coaching and Research workspaces' "Load sample data":
 * cards from the corpus become records in the panels' own stores, and the
 * sample never replaces, or on clearing removes, the user's own records.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pickSampleCards, toSampleCard, type SampleCard } from "../../src/lib/sample-data/sample-cards"
import {
  SAMPLE_FLOW_ID,
  buildCoachingSampleData,
  buildResearchSampleData,
  buildSampleFlow,
  clearWorkspaceSampleData,
  hasWorkspaceSampleData,
  loadWorkspaceSampleData,
  readSampleFlow,
} from "../../src/lib/sample-data/workspace-sample-data"

function card(id: number, side: "aff" | "neg", overrides: Partial<SampleCard> = {}): SampleCard {
  return {
    id,
    tag: `Tag ${id}`,
    cite: `Author ${id}, 2024, Journal`,
    citeShort: `Author ${id}`,
    text: "Card body text ".repeat(20).trim(),
    wordCount: 60,
    argBlock: side === "aff" ? `AFF > Plan ${id}` : `DA > Politics`,
    caseArea: side === "aff" ? "Aff" : "DA",
    side,
    year: 2025,
    event: "CX",
    school: id % 2 === 0 ? "Michigan KM" : "Northwestern AB",
    ...overrides,
  }
}

const CARDS = Array.from({ length: 12 }, (_, i) => card(i + 1, i % 2 === 0 ? "aff" : "neg"))
const NOW = Date.UTC(2026, 9, 13)

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("toSampleCard", () => {
  it("strips markup, trims the body and derives side and case area", () => {
    const sample = toSampleCard({
      id: 7,
      tag: "<b>Warming causes extinction</b>",
      cite: "Smith 24. Professor at Somewhere",
      markup: "<p>The <mark>planet</mark> is warming &amp; fast</p>",
      pocket: "DA",
      hat: "Politics",
      side: "N",
      year: 2024,
      event: "CX",
      caselistDisplayName: "Michigan KM",
    })
    expect(sample).toMatchObject({
      tag: "Warming causes extinction",
      text: "The planet is warming & fast",
      citeShort: "Smith 24",
      argBlock: "DA > Politics",
      caseArea: "DA",
      side: "neg",
      school: "Michigan KM",
    })
  })

  it("drops a row with no tag or no body", () => {
    expect(toSampleCard({ id: 1, tag: "", fulltext: "body" })).toBeNull()
    expect(toSampleCard({ id: 1, tag: "tag", fulltext: "" })).toBeNull()
  })
})

describe("pickSampleCards", () => {
  it("alternates sides and skips repeated tags", () => {
    const picked = pickSampleCards([card(1, "aff"), card(2, "aff"), card(3, "neg"), card(4, "neg", { tag: "Tag 3" })], 4)
    expect(picked.map((c) => c.id)).toEqual([1, 3, 2])
  })
})

describe("sample builders", () => {
  it("files every research record under one topic with sample ids", () => {
    const data = buildResearchSampleData(CARDS, NOW)
    expect(data.evidenceLibraryEntries).toHaveLength(CARDS.length)
    for (const records of Object.values(data)) {
      for (const record of records as Array<{ id: string; topic: string }>) {
        expect(record.id.startsWith("sample-")).toBe(true)
        expect(record.topic).toBe("Policy 2025 topic")
      }
    }
  })

  it("builds opponent and judge profiles from the scouting records", () => {
    const data = buildCoachingSampleData(CARDS, NOW)
    const profiles = data.opponentTeamProfiles as Array<{ teamId: string; roundsRecorded: number }>
    expect(profiles.map((p) => p.teamId).sort()).toEqual(["Michigan KM", "Northwestern AB"])
    expect(profiles.every((p) => p.roundsRecorded === 6)).toBe(true)
    expect(data.judgeProfiles).toHaveLength(3)
  })

  it("flows aff cards as 1AC arguments answered by neg cards", () => {
    const flow = buildSampleFlow(CARDS)
    expect(flow.id).toBe(SAMPLE_FLOW_ID)
    expect(flow.columns[0]).toBe("1AC")
    expect(flow.children[0]?.content).toBe("Tag 1 — Author 1")
    expect(flow.children[0]?.children[0]?.content).toBe("Tag 2 — Author 2")
    expect(flow.children[0]?.children[0]?.level).toBe(2)
  })
})

describe("loading and clearing", () => {
  it("adds the sample beside the user's records and removes only the sample", () => {
    const mine = { id: "mine-1", argBlock: "My block", topic: "Mine" }
    localStorage.setItem("trackedArguments", JSON.stringify([mine]))

    expect(hasWorkspaceSampleData("research")).toBe(false)
    expect(loadWorkspaceSampleData("research", CARDS, NOW)).toBeGreaterThan(0)
    expect(hasWorkspaceSampleData("research")).toBe(true)
    expect(JSON.parse(localStorage.getItem("trackedArguments") ?? "[]").length).toBeGreaterThan(1)

    clearWorkspaceSampleData("research")
    expect(hasWorkspaceSampleData("research")).toBe(false)
    expect(JSON.parse(localStorage.getItem("trackedArguments") ?? "[]")).toEqual([mine])
    expect(JSON.parse(localStorage.getItem("evidenceLibraryEntries") ?? "[]")).toEqual([])
  })

  it("never replaces a record the user already has under the same id", () => {
    const real = { teamId: "Michigan KM", roundsRecorded: 2 }
    localStorage.setItem("opponentTeamProfiles", JSON.stringify([real]))

    loadWorkspaceSampleData("coaching", CARDS, NOW)
    const profiles = JSON.parse(localStorage.getItem("opponentTeamProfiles") ?? "[]")
    expect(profiles.find((p: { teamId: string }) => p.teamId === "Michigan KM")).toEqual(real)

    clearWorkspaceSampleData("coaching")
    expect(JSON.parse(localStorage.getItem("opponentTeamProfiles") ?? "[]")).toEqual([real])
  })

  it("keeps the coaching sample flow until the sample is cleared", () => {
    loadWorkspaceSampleData("coaching", CARDS, NOW)
    expect(readSampleFlow()?.id).toBe(SAMPLE_FLOW_ID)
    clearWorkspaceSampleData("coaching")
    expect(readSampleFlow()).toBeNull()
    expect(hasWorkspaceSampleData("coaching")).toBe(false)
  })
})
