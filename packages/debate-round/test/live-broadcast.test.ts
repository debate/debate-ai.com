/**
 * @fileoverview Who goes on air in a live-streamed round. Every participant's
 * browser runs the speech timer, so only the speaker's device may broadcast —
 * otherwise listeners hear each speech twice.
 */

import { describe, expect, it } from "vitest"

import { debateStyles } from "@debate-ai/timer/src/formats/debate-format-times"
import {
  liveRegistrationForRound,
  liveSideLabel,
  parseSpeakerCode,
  shouldBroadcastSpeech,
  speakerForSpeech,
} from "../src/round/live-broadcast"
import { inferRoomSeat } from "../src/webcam/room-seat"
import type { Round } from "../src/types/flow"

const policy = debateStyles.policy.timerSpeeches
const ld = debateStyles.lincolnDouglas.timerSpeeches
const pf = debateStyles.publicForum.timerSpeeches

const round = (debaters: Round["debaters"], extra: Partial<Round> = {}): Round => ({
  id: 1,
  tournamentName: "Glenbrooks",
  roundLevel: "Octos",
  debaters,
  judges: ["judge@x.org"],
  flowIds: [],
  timestamp: 0,
  status: "active",
  ...extra,
})

const policyRound = round({ aff: ["a1@x.org", "a2@x.org"], neg: ["n1@x.org", "n2@x.org"] })
const seatOf = (r: Round, email: string) => inferRoomSeat(r, [email])

describe("parseSpeakerCode", () => {
  it("reads every format's speaker codes", () => {
    expect(parseSpeakerCode("1A")).toEqual({ side: "aff", number: 1 })
    expect(parseSpeakerCode("2N")).toEqual({ side: "neg", number: 2 })
    expect(parseSpeakerCode("A2")).toEqual({ side: "aff", number: 2 })
    expect(parseSpeakerCode("N")).toEqual({ side: "neg", number: 1 })
    expect(parseSpeakerCode("P1")).toEqual({ side: "aff", number: 1 })
    expect(parseSpeakerCode("O2")).toEqual({ side: "neg", number: 2 })
    expect(parseSpeakerCode("C")).toEqual({ side: "neg", number: 1 })
    expect(parseSpeakerCode("")).toBeNull()
    expect(parseSpeakerCode("X1")).toBeNull()
  })

  it("finds a speech's speaker from the format, else from its name", () => {
    expect(speakerForSpeech("2nr", policy)).toEqual({ side: "neg", number: 2 })
    expect(speakerForSpeech("2AC", [])).toEqual({ side: "aff", number: 2 })
    expect(speakerForSpeech("Rebuttal", [])).toBeNull()
  })
})

describe("shouldBroadcastSpeech", () => {
  it("puts only the speaker on air in policy", () => {
    expect(shouldBroadcastSpeech(policyRound, seatOf(policyRound, "a1@x.org"), "1AC", policy)).toBe(true)
    expect(shouldBroadcastSpeech(policyRound, seatOf(policyRound, "a2@x.org"), "1AC", policy)).toBe(false)
    expect(shouldBroadcastSpeech(policyRound, seatOf(policyRound, "n1@x.org"), "1AC", policy)).toBe(false)
    expect(shouldBroadcastSpeech(policyRound, seatOf(policyRound, "n2@x.org"), "2NR", policy)).toBe(true)
    expect(shouldBroadcastSpeech(policyRound, seatOf(policyRound, "n1@x.org"), "1NR", policy)).toBe(true)
  })

  it("never broadcasts from a judge's or spectator's browser when debaters are emails", () => {
    expect(shouldBroadcastSpeech(policyRound, seatOf(policyRound, "judge@x.org"), "1AC", policy)).toBe(false)
    expect(shouldBroadcastSpeech(policyRound, seatOf(policyRound, "fan@x.org"), "1AC", policy)).toBe(false)
  })

  it("gives an LD debater every speech on their side", () => {
    const ldRound = round({ aff: ["aff@x.org", ""], neg: ["neg@x.org", ""] })
    expect(shouldBroadcastSpeech(ldRound, seatOf(ldRound, "aff@x.org"), "AC", ld)).toBe(true)
    expect(shouldBroadcastSpeech(ldRound, seatOf(ldRound, "aff@x.org"), "2AR", ld)).toBe(true)
    expect(shouldBroadcastSpeech(ldRound, seatOf(ldRound, "neg@x.org"), "NR", ld)).toBe(true)
    expect(shouldBroadcastSpeech(ldRound, seatOf(ldRound, "neg@x.org"), "AC", ld)).toBe(false)
  })

  it("lets the side's other debater take an empty slot", () => {
    const solo = round({ aff: ["", "a2@x.org"], neg: ["n1@x.org", "n2@x.org"] })
    expect(shouldBroadcastSpeech(solo, seatOf(solo, "a2@x.org"), "1AC", policy)).toBe(true)
  })

  it("follows PF's speaker codes", () => {
    const pfRound = round({ aff: ["p1@x.org", "p2@x.org"], neg: ["c1@x.org", "c2@x.org"] })
    expect(shouldBroadcastSpeech(pfRound, seatOf(pfRound, "p2@x.org"), "AS", pf)).toBe(true)
    expect(shouldBroadcastSpeech(pfRound, seatOf(pfRound, "p1@x.org"), "AS", pf)).toBe(false)
  })

  it("broadcasts from the timer's device when no debater can be matched (names, not emails)", () => {
    const named = round({ aff: ["Ana", "Ben"], neg: ["Cy", "Di"] })
    expect(shouldBroadcastSpeech(named, inferRoomSeat(named, ["coach@x.org"]), "1AC", policy)).toBe(true)
    // …but a matched name still only broadcasts its own speeches.
    expect(shouldBroadcastSpeech(named, inferRoomSeat(named, [], "Ben"), "1AC", policy)).toBe(false)
    expect(shouldBroadcastSpeech(named, inferRoomSeat(named, [], "Ben"), "2AC", policy)).toBe(true)
  })
})

describe("liveRegistrationForRound", () => {
  it("labels sides by school, else typed names — never emails", () => {
    expect(liveSideLabel(round({ aff: ["a@x.org", ""], neg: ["n@x.org", ""] }, { schools: { aff: ["Lynbrook", "Lynbrook"], neg: ["", ""] } }), "aff")).toBe("Lynbrook")
    expect(liveSideLabel(round({ aff: ["a@x.org", ""], neg: ["Cy", "Di"] }), "neg")).toBe("Cy & Di")
    expect(liveSideLabel(round({ aff: ["a@x.org", "b@x.org"], neg: ["", ""] }), "aff")).toBe("Aff")
  })

  it("sends debaters (who may broadcast) apart from judges and spectators", () => {
    const r = round(
      { aff: ["a1@x.org", ""], neg: ["n1@x.org", "n2@x.org"] },
      { slug: "glenbrooks/x-vs-y", title: "Glenbrooks - Octos", spectators: ["fan@x.org", " "], isPrivate: true },
    )
    expect(liveRegistrationForRound(r, true)).toEqual({
      slug: "glenbrooks/x-vs-y",
      title: "Glenbrooks - Octos",
      tournamentName: "Glenbrooks",
      roundLevel: "Octos",
      aff: "Aff",
      neg: "Neg",
      debaters: ["a1@x.org", "n1@x.org", "n2@x.org"],
      invitees: ["judge@x.org", "fan@x.org"],
      isPrivate: true,
      enabled: true,
    })
    expect(liveRegistrationForRound({ ...r, slug: undefined }, true)).toBeNull()
  })
})
