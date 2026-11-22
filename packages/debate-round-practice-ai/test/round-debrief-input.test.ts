/**
 * @fileoverview `buildRoundDebriefInput` hands the Coach debrief the
 * opponent's side of the transcript as well as the user's: `"Bot"` lines and
 * lines under a persona's own name become `opponentSpeeches`, the judge's
 * lines are never quoted, and blank lines are dropped. A round plan's chosen
 * arguments are passed for both sides.
 */

import { describe, expect, it } from "vitest"
import type { DebateMessage, JudgmentData, RoundPlan } from "../src/backend/types"
import { buildRoundDebriefInput } from "../src/ui/round-debrief"

const side = (score: number) => ({ score, reason: "r" })
const judgment: JudgmentData = {
  opening_statement: { user: side(5), bot: side(8) },
  cross_examination: { user: side(6), bot: side(7) },
  answers: { user: side(7), bot: side(6) },
  closing: { user: side(8), bot: side(7) },
  total: { user: 26, bot: 28 },
  verdict: { winner: "Rookie Rick", reason: "Won framing.", congratulations: "", opponent_analysis: "" },
}

describe("buildRoundDebriefInput — opponent speeches", () => {
  it("splits the transcript into the user's and the opponent's speeches, in round order", () => {
    const transcript: DebateMessage[] = [
      { sender: "User", text: "My opening.", phase: "Opening Statements" },
      { sender: "Bot", text: "Bot opening.", phase: "Opening Statements" },
      { sender: "Rookie Rick", text: "Persona question?", phase: "Cross Examination" },
      { sender: "Judge", text: "Time.", phase: "Cross Examination" },
      { sender: "User", text: "My closing.", phase: "Closing Statements" },
      { sender: "Bot", text: "Bot closing.", phase: "Closing Statements" },
    ]
    const input = buildRoundDebriefInput(judgment, { transcript })
    expect(input.userSpeeches).toEqual([
      { phase: "Opening Statements", text: "My opening." },
      { phase: "Closing Statements", text: "My closing." },
    ])
    expect(input.opponentSpeeches).toEqual([
      { phase: "Opening Statements", text: "Bot opening." },
      { phase: "Cross Examination", text: "Persona question?" },
      { phase: "Closing Statements", text: "Bot closing." },
    ])
  })

  it("drops blank lines on both sides", () => {
    const input = buildRoundDebriefInput(judgment, {
      transcript: [
        { sender: "Bot", text: "   " },
        { sender: "User", text: "" },
        { sender: "Bot", text: "Real line." },
      ],
    })
    expect(input.userSpeeches).toEqual([])
    expect(input.opponentSpeeches).toEqual([{ phase: undefined, text: "Real line." }])
  })

  it("quotes nobody without a transcript", () => {
    const input = buildRoundDebriefInput(judgment)
    expect(input.userSpeeches).toEqual([])
    expect(input.opponentSpeeches).toEqual([])
  })
})

describe("buildRoundDebriefInput — chosen arguments", () => {
  it("passes each side's plan arguments, title and summary only", () => {
    const plan: RoundPlan = {
      evidence: "without",
      userArguments: [{ title: "Cost savings", summary: "Admin waste falls.", kind: "advantage" }],
      botArguments: [{ title: "Spending DA", kind: "disad" }],
    }
    const input = buildRoundDebriefInput(judgment, { plan })
    expect(input.userArguments).toEqual([{ title: "Cost savings", summary: "Admin waste falls." }])
    expect(input.opponentArguments).toEqual([{ title: "Spending DA" }])
  })

  it("skips untitled or malformed entries", () => {
    const plan = {
      evidence: "without",
      userArguments: [{ title: "" }, null, { title: "Kept" }],
      botArguments: "not a list",
    } as unknown as RoundPlan
    const input = buildRoundDebriefInput(judgment, { plan })
    expect(input.userArguments).toEqual([{ title: "Kept" }])
    expect(input.opponentArguments).toEqual([])
  })

  it("leaves the argument fields out without a plan", () => {
    const input = buildRoundDebriefInput(judgment)
    expect(input).not.toHaveProperty("userArguments")
    expect(input).not.toHaveProperty("opponentArguments")
  })
})
