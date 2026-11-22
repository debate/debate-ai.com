/** @fileoverview Guards the `DebateVsBotRecord` shape check a restore relies on. */
import { describe, expect, it } from "vitest"
import {
  isValidDebateVsBotRecord,
  isValidJudgeFeedbackStyle,
  isValidRoundDebrief,
  isValidSavedRoundPlan,
  MAX_SAVED_PLAN_TITLE_CHARS,
  shouldReplaceDebrief,
  MAX_PRACTICE_DEBATE_MESSAGES,
  MAX_ROUND_DEBRIEF_PERSONA_CHARS,
  MAX_ROUND_DEBRIEF_CHARS,
} from "../src/backend/record-validation"
import { MAX_PLAN_ARGUMENTS } from "../src/backend/round-plan"

const record = (over: Record<string, unknown> = {}) => ({
  id: "12",
  email: "a@example.com",
  botName: "Rookie Rick",
  botLevel: "Easy",
  topic: "Tariffs do more harm than good",
  stance: "against",
  history: [
    { sender: "User", text: "Tariffs raise prices.", phase: "Opening Statements" },
    { sender: "Bot", text: "They protect jobs." },
  ],
  phaseTimings: [{ name: "Opening Statements", userTime: 240, botTime: 240 }],
  outcome: "User conceded",
  createdAt: 1_762_000_000,
  ...over,
})

describe("isValidDebateVsBotRecord", () => {
  it("accepts a finished round and an unfinished one", () => {
    expect(isValidDebateVsBotRecord(record())).toBe(true)
    expect(isValidDebateVsBotRecord(record({ outcome: undefined, history: [], phaseTimings: [] }))).toBe(true)
  })

  it("ignores id and email, which a restore assigns itself", () => {
    expect(isValidDebateVsBotRecord(record({ id: undefined, email: undefined }))).toBe(true)
  })

  it("rejects non-objects and missing or mistyped fields", () => {
    for (const bad of [null, "round", [record()]]) expect(isValidDebateVsBotRecord(bad)).toBe(false)
    expect(isValidDebateVsBotRecord(record({ topic: "   " }))).toBe(false)
    expect(isValidDebateVsBotRecord(record({ botName: 3 }))).toBe(false)
    expect(isValidDebateVsBotRecord(record({ stance: undefined }))).toBe(false)
    expect(isValidDebateVsBotRecord(record({ outcome: { winner: "User" } }))).toBe(false)
  })

  it("rejects a malformed transcript or clock", () => {
    expect(isValidDebateVsBotRecord(record({ history: "hi" }))).toBe(false)
    expect(isValidDebateVsBotRecord(record({ history: [{ sender: "User" }] }))).toBe(false)
    expect(isValidDebateVsBotRecord(record({ history: [{ sender: "User", text: "x", phase: 2 }] }))).toBe(false)
    expect(isValidDebateVsBotRecord(record({ phaseTimings: [{ name: "Rebuttal", userTime: -1, botTime: 60 }] }))).toBe(false)
    expect(isValidDebateVsBotRecord(record({ phaseTimings: [{ name: "Rebuttal", userTime: Number.NaN, botTime: 60 }] }))).toBe(false)
  })

  it("caps the transcript length", () => {
    const line = { sender: "User", text: "x" }
    expect(isValidDebateVsBotRecord(record({ history: Array(MAX_PRACTICE_DEBATE_MESSAGES).fill(line) }))).toBe(true)
    expect(isValidDebateVsBotRecord(record({ history: Array(MAX_PRACTICE_DEBATE_MESSAGES + 1).fill(line) }))).toBe(false)
  })

  it("needs a positive whole-second createdAt", () => {
    for (const createdAt of [0, -5, 1.5, "2026-01-01", undefined]) expect(isValidDebateVsBotRecord(record({ createdAt }))).toBe(false)
  })
})

describe("isValidRoundDebrief", () => {
  const debrief = (over: Record<string, unknown> = {}) => ({
    personaId: "socratic",
    text: "Weigh your impacts earlier.",
    savedAt: 1_762_000_100,
    ...over,
  })

  it("accepts a debrief, including an unknown style id", () => {
    expect(isValidRoundDebrief(debrief())).toBe(true)
    expect(isValidRoundDebrief(debrief({ personaId: "future-style" }))).toBe(true)
  })

  it("rejects missing, blank or mistyped fields", () => {
    expect(isValidRoundDebrief(null)).toBe(false)
    expect(isValidRoundDebrief("text")).toBe(false)
    expect(isValidRoundDebrief(debrief({ personaId: " " }))).toBe(false)
    expect(isValidRoundDebrief(debrief({ personaId: "p".repeat(65) }))).toBe(false)
    expect(isValidRoundDebrief(debrief({ text: "" }))).toBe(false)
    expect(isValidRoundDebrief(debrief({ text: 3 }))).toBe(false)
    expect(isValidRoundDebrief(debrief({ savedAt: 0 }))).toBe(false)
    expect(isValidRoundDebrief(debrief({ savedAt: 1.5 }))).toBe(false)
  })

  it("accepts an optional positive whole-millisecond writtenAt", () => {
    expect(isValidRoundDebrief(debrief({ writtenAt: 1_762_000_100_123 }))).toBe(true)
    expect(isValidRoundDebrief(debrief({ writtenAt: 0 }))).toBe(false)
    expect(isValidRoundDebrief(debrief({ writtenAt: 2.5 }))).toBe(false)
    expect(isValidRoundDebrief(debrief({ writtenAt: "1" }))).toBe(false)
  })

  it("caps the text length", () => {
    expect(isValidRoundDebrief(debrief({ text: "x".repeat(MAX_ROUND_DEBRIEF_CHARS) }))).toBe(true)
    expect(isValidRoundDebrief(debrief({ text: "x".repeat(MAX_ROUND_DEBRIEF_CHARS + 1) }))).toBe(false)
  })

  it("lets a record carry a valid debrief and rejects a malformed one", () => {
    expect(isValidDebateVsBotRecord(record({ debrief: debrief() }))).toBe(true)
    expect(isValidDebateVsBotRecord(record({ debrief: { text: "no style" } }))).toBe(false)
  })
})

describe("isValidJudgeFeedbackStyle", () => {
  it("accepts a style id, including an unknown one, up to the length cap", () => {
    expect(isValidJudgeFeedbackStyle("socratic")).toBe(true)
    expect(isValidJudgeFeedbackStyle("future-style")).toBe(true)
    expect(isValidJudgeFeedbackStyle("x".repeat(MAX_ROUND_DEBRIEF_PERSONA_CHARS))).toBe(true)
    expect(isValidJudgeFeedbackStyle("x".repeat(MAX_ROUND_DEBRIEF_PERSONA_CHARS + 1))).toBe(false)
  })

  it("rejects blank or non-string values", () => {
    for (const bad of ["", "   ", 7, null, {}]) expect(isValidJudgeFeedbackStyle(bad)).toBe(false)
  })

  it("lets a record carry a valid style and rejects a malformed one", () => {
    expect(isValidDebateVsBotRecord(record({ judgeFeedbackStyle: "socratic" }))).toBe(true)
    expect(isValidDebateVsBotRecord(record({ judgeFeedbackStyle: 7 }))).toBe(false)
    expect(isValidDebateVsBotRecord(record({ judgeFeedbackStyle: " " }))).toBe(false)
  })
})

describe("shouldReplaceDebrief", () => {
  const at = (writtenAt?: number) => ({
    personaId: "standard",
    text: "Debrief.",
    savedAt: 1_762_000_100,
    ...(writtenAt === undefined ? {} : { writtenAt }),
  })

  it("replaces when the round has no debrief yet", () => {
    expect(shouldReplaceDebrief(undefined, at(1))).toBe(true)
  })

  it("keeps a later-written debrief over an older one that arrives last", () => {
    expect(shouldReplaceDebrief(at(2_000), at(1_000))).toBe(false)
  })

  it("replaces on an equal or later writtenAt", () => {
    expect(shouldReplaceDebrief(at(2_000), at(2_000))).toBe(true)
    expect(shouldReplaceDebrief(at(2_000), at(3_000))).toBe(true)
  })

  it("replaces when either side has no writtenAt (older clients and rows)", () => {
    expect(shouldReplaceDebrief(at(), at(1))).toBe(true)
    expect(shouldReplaceDebrief(at(2_000), at())).toBe(true)
  })
})

describe("isValidSavedRoundPlan", () => {
  const plan = (over: Record<string, unknown> = {}) => ({
    evidence: "without",
    affPlan: "Single payer.",
    userArguments: [{ title: "Uninsured Deaths advantage", kind: "advantage" }],
    botArguments: [{ title: "Spending DA", summary: "Debt spikes." }],
    ...over,
  })

  it("accepts a plan as a round saves it, with or without an aff plan or arguments", () => {
    expect(isValidSavedRoundPlan(plan())).toBe(true)
    expect(isValidSavedRoundPlan(plan({ affPlan: undefined, userArguments: [], botArguments: [] }))).toBe(true)
  })

  it("rejects a bad evidence mode, malformed arguments, too many arguments, or cards", () => {
    expect(isValidSavedRoundPlan(plan({ evidence: "maybe" }))).toBe(false)
    expect(isValidSavedRoundPlan(plan({ userArguments: "none" }))).toBe(false)
    expect(isValidSavedRoundPlan(plan({ botArguments: [{ title: " " }] }))).toBe(false)
    expect(isValidSavedRoundPlan(plan({ botArguments: [{ title: "x".repeat(MAX_SAVED_PLAN_TITLE_CHARS + 1) }] }))).toBe(false)
    expect(isValidSavedRoundPlan(plan({ userArguments: [{ title: "DA", kind: 3 }] }))).toBe(false)
    const tooMany = Array.from({ length: MAX_PLAN_ARGUMENTS + 1 }, (_, i) => ({ title: `Arg ${i}` }))
    expect(isValidSavedRoundPlan(plan({ userArguments: tooMany }))).toBe(false)
    expect(isValidSavedRoundPlan(plan({ cards: [] }))).toBe(false)
    expect(isValidSavedRoundPlan(null)).toBe(false)
  })

  it("lets a record carry a valid plan and rejects a malformed one", () => {
    expect(isValidDebateVsBotRecord(record({ plan: plan() }))).toBe(true)
    expect(isValidDebateVsBotRecord(record({ plan: plan({ evidence: 1 }) }))).toBe(false)
  })
})
