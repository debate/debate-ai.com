import { describe, expect, it } from "vitest"
import { getRoundRecordingShareEmails } from "../src/round/round-recording-share"
import type { Round } from "../src/types/flow"

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 1,
    tournamentName: "Blake",
    roundLevel: "Prelim 1",
    debaters: { aff: ["aff1@example.com", "aff2@example.com"], neg: ["neg1@example.com", "neg2@example.com"] },
    judges: ["judge@example.com"],
    spectators: ["spectator@example.com"],
    flowIds: [1],
    timestamp: Date.now(),
    status: "active",
    ...overrides,
  }
}

describe("getRoundRecordingShareEmails", () => {
  it("returns an empty array for an undefined round", () => {
    expect(getRoundRecordingShareEmails(undefined)).toEqual([])
  })

  it("collects every debater/judge/spectator email", () => {
    expect(getRoundRecordingShareEmails(makeRound())).toEqual([
      "aff1@example.com",
      "aff2@example.com",
      "neg1@example.com",
      "neg2@example.com",
      "judge@example.com",
      "spectator@example.com",
    ])
  })

  it("tolerates an absent spectators field", () => {
    const round = makeRound()
    delete (round as { spectators?: string[] }).spectators
    expect(getRoundRecordingShareEmails(round)).toEqual([
      "aff1@example.com",
      "aff2@example.com",
      "neg1@example.com",
      "neg2@example.com",
      "judge@example.com",
    ])
  })

  it("ignores blank/whitespace-only entries", () => {
    const round = makeRound({
      debaters: { aff: ["", "aff2@example.com"], neg: ["   ", "neg2@example.com"] },
      judges: [""],
      spectators: [],
    })
    expect(getRoundRecordingShareEmails(round)).toEqual(["aff2@example.com", "neg2@example.com"])
  })

  it("dedupes case-insensitively, keeping the first-seen casing", () => {
    const round = makeRound({
      debaters: { aff: ["Coach@Example.com", "aff2@example.com"], neg: ["neg1@example.com", "neg2@example.com"] },
      judges: ["coach@example.com"],
      spectators: [],
    })
    expect(getRoundRecordingShareEmails(round)).toEqual([
      "Coach@Example.com",
      "aff2@example.com",
      "neg1@example.com",
      "neg2@example.com",
    ])
  })

  it("trims leading/trailing whitespace", () => {
    const round = makeRound({
      debaters: { aff: ["  aff1@example.com  ", "aff2@example.com"], neg: ["neg1@example.com", "neg2@example.com"] },
      judges: [],
      spectators: [],
    })
    expect(getRoundRecordingShareEmails(round)[0]).toBe("aff1@example.com")
  })

  it("degrades gracefully when debaters/judges fields are missing entirely", () => {
    const round = makeRound({ spectators: ["spectator@example.com"] })
    delete (round as { debaters?: Round["debaters"] }).debaters
    delete (round as { judges?: string[] }).judges
    expect(getRoundRecordingShareEmails(round)).toEqual(["spectator@example.com"])
  })
})
