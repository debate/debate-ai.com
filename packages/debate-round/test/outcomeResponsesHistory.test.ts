/**
 * @fileoverview The saved AI Outcome Responses runs: one per speech of a
 * round / flow, keyed `scope:SPEECH` for the `aiOutcomeResponses` account sync.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SpeechOutcomeResponsesResult } from "@debate-ai/speech-writer/src/prompts/speech-outcome-responses"
import {
  clearSavedOutcomeResponses,
  getSavedOutcomeResponses,
  MAX_SAVED_OUTCOME_RESPONSES,
  OUTCOME_RESPONSES_EVENT,
  OUTCOME_RESPONSES_KEY,
  outcomeResponsesId,
  parseSavedOutcomeResponses,
  saveOutcomeResponses,
  type OutcomeResponsesRunInput,
} from "../src/state/outcomeResponsesHistory"

function result(title = "Collapse to the DA"): SpeechOutcomeResponsesResult {
  return {
    recommendedIndex: 0,
    candidates: [
      {
        title,
        strategy: "Go for the disad.",
        outline: ["Extend the link"],
        cardSearches: ["alliance DA link"],
        opponentAnswers: ["No link"],
        judgeDecision: { winner: "neg", rationale: "Clean link." },
        issues: [],
        successRate: 62,
      },
    ],
  }
}

function run(overrides: Partial<OutcomeResponsesRunInput> = {}): OutcomeResponsesRunInput {
  return {
    speechName: "2nr",
    side: "neg",
    paradigmId: "auto",
    judgeLabel: "Jane Doe (Tabula Rasa)",
    focus: "  go for the DA  ",
    result: result(),
    ...overrides,
  }
}

describe("saved AI Outcome Responses runs", () => {
  let store: Map<string, string>
  let events: string[]
  beforeEach(() => {
    store = new Map()
    events = []
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    vi.stubGlobal("window", { dispatchEvent: (e: Event) => void events.push(e.type) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("saves a run under scope:SPEECH and reads it back case-insensitively", () => {
    const saved = saveOutcomeResponses("round-3", run(), 1_000)
    expect(saved).toMatchObject({ id: "round-3:2NR", scope: "round-3", focus: "go for the DA", savedAt: 1_000 })
    expect(getSavedOutcomeResponses("round-3", "2NR")?.result.candidates[0].title).toBe("Collapse to the DA")
    expect(getSavedOutcomeResponses("round-4", "2NR")).toBeNull()
    expect(events).toEqual([OUTCOME_RESPONSES_EVENT])
    // The synced shape: an array of id-keyed records.
    expect(JSON.parse(store.get(OUTCOME_RESPONSES_KEY)!)).toHaveLength(1)
  })

  it("replaces a speech's earlier run instead of keeping both", () => {
    saveOutcomeResponses("round-3", run(), 1_000)
    saveOutcomeResponses("round-3", run({ result: result("Kick the DA, go for T") }), 2_000)
    const rows = JSON.parse(store.get(OUTCOME_RESPONSES_KEY)!)
    expect(rows).toHaveLength(1)
    expect(getSavedOutcomeResponses("round-3", "2NR")).toMatchObject({ savedAt: 2_000 })
    expect(getSavedOutcomeResponses("round-3", "2NR")?.result.candidates[0].title).toBe("Kick the DA, go for T")
  })

  it(`keeps only the newest ${MAX_SAVED_OUTCOME_RESPONSES} runs`, () => {
    for (let i = 0; i < MAX_SAVED_OUTCOME_RESPONSES + 5; i++) saveOutcomeResponses(`flow-${i}`, run(), i)
    const rows = JSON.parse(store.get(OUTCOME_RESPONSES_KEY)!)
    expect(rows).toHaveLength(MAX_SAVED_OUTCOME_RESPONSES)
    expect(getSavedOutcomeResponses("flow-0", "2NR")).toBeNull()
    expect(getSavedOutcomeResponses(`flow-${MAX_SAVED_OUTCOME_RESPONSES + 4}`, "2NR")).not.toBeNull()
  })

  it("saves nothing without a scope, a speech or a usable result", () => {
    expect(saveOutcomeResponses(null, run())).toBeNull()
    expect(saveOutcomeResponses("flow-1", run({ speechName: "  " }))).toBeNull()
    expect(saveOutcomeResponses("flow-1", run({ result: { candidates: [], recommendedIndex: 0 } }))).toBeNull()
    expect(store.has(OUTCOME_RESPONSES_KEY)).toBe(false)
    expect(getSavedOutcomeResponses(null, "2NR")).toBeNull()
  })

  it("returns null when storage is blocked, and reads blocked storage as empty", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {},
    })
    expect(saveOutcomeResponses("flow-1", run())).toBeNull()
    expect(getSavedOutcomeResponses("flow-1", "2NR")).toBeNull()
  })

  it("skips damaged rows (a synced row from another device included) and keeps the good ones", () => {
    store.set(
      OUTCOME_RESPONSES_KEY,
      JSON.stringify([
        { id: "flow-1:1AR", scope: "flow-1", speechName: "1AR", side: "aff", savedAt: 5, result: { candidates: "x" } },
        { id: "wrong", scope: "flow-1", speechName: "2AR", side: "aff", savedAt: 5, result: result() },
        "not a record",
        { id: "flow-1:2NR", scope: "flow-1", speechName: "2NR", side: "neg", savedAt: 5, result: result() },
      ]),
    )
    expect(getSavedOutcomeResponses("flow-1", "1AR")).toBeNull()
    expect(getSavedOutcomeResponses("flow-1", "2AR")).toBeNull()
    expect(getSavedOutcomeResponses("flow-1", "2NR")).toMatchObject({ paradigmId: "auto", judgeLabel: "", focus: "" })
  })

  it("reads non-JSON storage as empty", () => {
    store.set(OUTCOME_RESPONSES_KEY, "{oops")
    expect(getSavedOutcomeResponses("flow-1", "2NR")).toBeNull()
  })

  it("clears one speech's run", () => {
    saveOutcomeResponses("flow-1", run(), 1)
    saveOutcomeResponses("flow-1", run({ speechName: "1NR" }), 2)
    clearSavedOutcomeResponses("flow-1", "2nr")
    expect(getSavedOutcomeResponses("flow-1", "2NR")).toBeNull()
    expect(getSavedOutcomeResponses("flow-1", "1NR")).not.toBeNull()
  })

  it("parses a stored row's result through the AI-reply validator", () => {
    const row = {
      id: outcomeResponsesId("flow-1", "2NR"),
      scope: "flow-1",
      speechName: "2NR",
      side: "neg",
      savedAt: 1,
      paradigmId: "tabula-rasa",
      judgeLabel: "J",
      focus: "x".repeat(900),
      result: { candidates: [{ ...result().candidates[0], successRate: 140 }], recommendedIndex: 7 },
    }
    const parsed = parseSavedOutcomeResponses(row)
    expect(parsed?.result.candidates[0].successRate).toBe(100)
    expect(parsed?.result.recommendedIndex).toBe(0)
    expect(parsed?.focus).toHaveLength(500)
    expect(parseSavedOutcomeResponses({ ...row, side: "both" })).toBeNull()
    expect(parseSavedOutcomeResponses(null)).toBeNull()
  })
})
