// @vitest-environment jsdom
/**
 * @fileoverview `JudgmentPopup` hands the Coach debrief the whole round: the
 * opponent's transcript lines and the round plan's chosen arguments, not just
 * the user's speeches.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RoundDebriefInput } from "@debate-ai/speech-writer"
import type { DebateMessage, JudgmentData, RoundPlan } from "../src/backend/types"
import { JudgmentPopup } from "../src/ui/JudgmentPopup"
import { click, mount, type Mounted } from "./helpers/mount"

const side = (score: number) => ({ score, reason: "r" })
const judgment: JudgmentData = {
  opening_statement: { user: side(5), bot: side(8) },
  cross_examination: { user: side(6), bot: side(7) },
  answers: { user: side(7), bot: side(6) },
  closing: { user: side(8), bot: side(7) },
  total: { user: 26, bot: 28 },
  verdict: { winner: "Rookie Rick", reason: "Won framing.", congratulations: "", opponent_analysis: "" },
}

const transcript: DebateMessage[] = [
  { sender: "User", text: "My opening.", phase: "Opening Statements" },
  { sender: "Bot", text: "Bot opening.", phase: "Opening Statements" },
]

const plan: RoundPlan = {
  evidence: "without",
  userArguments: [{ title: "Cost savings", summary: "Admin waste falls." }],
  botArguments: [{ title: "Spending DA" }],
}

let mounted: Mounted | null = null
beforeEach(() => localStorage.clear())
afterEach(async () => {
  await mounted?.unmount()
  mounted = null
})

const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text))

describe("JudgmentPopup Coach debrief input", () => {
  it("includes the opponent's speeches and both sides' chosen arguments", async () => {
    const requestDebrief = vi.fn(async (_input: RoundDebriefInput) => "Debrief.")
    mounted = await mount(
      <JudgmentPopup
        judgment={judgment}
        botName="Rookie Rick"
        userStance="For"
        transcript={transcript}
        plan={plan}
        requestDebrief={requestDebrief}
        onClose={() => {}}
      />,
    )
    await click(button(mounted.container, "Reveal Decision")!)
    await click(button(mounted.container, "Get coach debrief")!)

    const sent = requestDebrief.mock.calls[0]?.[0]
    expect(sent?.userSpeeches).toEqual([{ phase: "Opening Statements", text: "My opening." }])
    expect(sent?.opponentSpeeches).toEqual([{ phase: "Opening Statements", text: "Bot opening." }])
    expect(sent?.userArguments).toEqual([{ title: "Cost savings", summary: "Admin waste falls." }])
    expect(sent?.opponentArguments).toEqual([{ title: "Spending DA" }])
  })
})
