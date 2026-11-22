// @vitest-environment jsdom
/**
 * @fileoverview The AI Outcome Responses dialog keeps the last run of each
 * speech: reopening shows the saved run without another AI request, a first
 * open runs and saves one, and Regenerate replaces it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SpeechOutcomeResponsesResult } from "@debate-ai/speech-writer/src/prompts/speech-outcome-responses"

const requestMock = vi.fn()

vi.mock("../src/round/outcome-responses-client", () => ({
  loadPriorSpeeches: vi.fn(async () => []),
  requestSpeechOutcomeResponses: (...args: unknown[]) => requestMock(...args),
  searchOutcomeCards: vi.fn(async () => []),
}))

vi.mock("../src/state/store", () => ({
  useFlowStore: () => ({
    flows: [{ id: 41, roundId: 9, columns: ["1AC", "1NC", "2AC"], children: [], content: "Case", level: 0 }],
    rounds: [{ id: 9, judges: ["Jane Doe"], flowIds: [41], debaters: { aff: ["", ""], neg: ["", ""] } }],
    selected: 0,
  }),
}))

import {
  AiOutcomeResponsesDialog,
  describeSavedRun,
  formatOutcomeSavedAt,
} from "../src/dialogs/AiOutcomeResponsesDialog"
import { getSavedOutcomeResponses, saveOutcomeResponses } from "../src/state/outcomeResponsesHistory"
import { bodyText, buttonByText, cleanup, click, flush, mount } from "./dom-helpers"

function result(title: string): SpeechOutcomeResponsesResult {
  return {
    recommendedIndex: 0,
    candidates: [
      {
        title,
        strategy: "Answer the DA.",
        outline: ["Link turn"],
        cardSearches: [],
        opponentAnswers: [],
        judgeDecision: { winner: "aff", rationale: "Turn outweighs." },
        issues: [],
        successRate: 55,
      },
    ],
  }
}

beforeEach(() => {
  localStorage.clear()
  requestMock.mockReset()
})

afterEach(() => cleanup())

describe("AiOutcomeResponsesDialog saved runs", () => {
  it("reopens the saved run for the speech without asking the AI again", async () => {
    saveOutcomeResponses("round-9", {
      speechName: "2AC",
      side: "aff",
      paradigmId: "auto",
      judgeLabel: "Jane Doe (Tabula Rasa)",
      focus: "turn the DA",
      result: result("Saved approach"),
    })
    await mount(<AiOutcomeResponsesDialog open onOpenChange={() => {}} speechName="2AC" />)
    await flush()

    expect(requestMock).not.toHaveBeenCalled()
    expect(bodyText()).toContain("Saved approach")
    expect(bodyText()).toContain("judged by Jane Doe (Tabula Rasa)")
    expect(bodyText()).toContain("focus: turn the DA")
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("turn the DA")
    expect(buttonByText("Regenerate")).toBeTruthy()
  })

  it("runs a first simulation when nothing is saved and saves it with the round", async () => {
    requestMock.mockResolvedValueOnce(result("Fresh approach"))
    await mount(<AiOutcomeResponsesDialog open onOpenChange={() => {}} speechName="2AC" />)
    await flush(6)

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(bodyText()).toContain("Fresh approach")
    expect(bodyText()).toContain("Kept with this round")
    expect(getSavedOutcomeResponses("round-9", "2ac")?.result.candidates[0].title).toBe("Fresh approach")
  })

  it("Regenerate replaces the saved run", async () => {
    saveOutcomeResponses("round-9", {
      speechName: "2AC",
      side: "aff",
      paradigmId: "auto",
      judgeLabel: "",
      focus: "",
      result: result("Old approach"),
    })
    requestMock.mockResolvedValueOnce(result("New approach"))
    await mount(<AiOutcomeResponsesDialog open onOpenChange={() => {}} speechName="2AC" />)
    await flush()
    await click(buttonByText("Regenerate"))
    await flush(6)

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(bodyText()).toContain("New approach")
    expect(getSavedOutcomeResponses("round-9", "2AC")?.result.candidates[0].title).toBe("New approach")
  })

  it("leaves the saved run in place when a regeneration fails", async () => {
    saveOutcomeResponses("round-9", {
      speechName: "2AC",
      side: "aff",
      paradigmId: "auto",
      judgeLabel: "",
      focus: "",
      result: result("Kept approach"),
    })
    requestMock.mockRejectedValueOnce(new Error("AI is unavailable"))
    await mount(<AiOutcomeResponsesDialog open onOpenChange={() => {}} speechName="2AC" />)
    await flush()
    await click(buttonByText("Regenerate"))
    await flush(6)

    expect(bodyText()).toContain("AI is unavailable")
    expect(getSavedOutcomeResponses("round-9", "2AC")?.result.candidates[0].title).toBe("Kept approach")
  })
})

describe("saved-run wording", () => {
  const now = new Date(2026, 10, 22, 15, 0).getTime()

  it("shows only the time for a run saved today, and the date otherwise", () => {
    expect(formatOutcomeSavedAt(new Date(2026, 10, 22, 9, 5).getTime(), now)).toMatch(/^Saved \d/)
    expect(formatOutcomeSavedAt(new Date(2026, 10, 20, 9, 5).getTime(), now)).toMatch(/^Saved Nov 20, /)
  })

  it("says when saving failed", () => {
    expect(describeSavedRun(null)).toBe("Not saved — storage is blocked in this browser.")
  })
})
