/** @fileoverview `practiceDebateUserSpeeches`: the user's own speeches from saved Practice vs AI rounds. */
import { describe, expect, it } from "vitest"
import type { DebateMessage } from "../src/backend"
import { practiceDebateUserSpeeches } from "../src/ui/history-fallacy-speeches"

const debate = (topic: string, history: DebateMessage[]) => ({ topic, history })

describe("practiceDebateUserSpeeches", () => {
  it("keeps only User messages, labelled topic — phase, in round then transcript order", () => {
    const speeches = practiceDebateUserSpeeches([
      debate("Tariffs", [
        { sender: "Bot", text: "You are a liar.", phase: "Opening Statements" },
        { sender: "User", text: "Either we act or we fail.", phase: "Opening Statements" },
        { sender: "User", text: "Rebuttal text.", phase: "Rebuttals" },
      ]),
      debate("Nukes", [{ sender: "User", text: "Deterrence holds." }]),
    ])
    expect(speeches).toEqual([
      { label: "Tariffs — Opening Statements", text: "Either we act or we fail." },
      { label: "Tariffs — Rebuttals", text: "Rebuttal text." },
      { label: "Nukes — Speech", text: "Deterrence holds." },
    ])
  })

  it("drops blank or non-string text and tolerates malformed rows", () => {
    const speeches = practiceDebateUserSpeeches([
      debate("  ", [
        { sender: "User", text: "   " },
        { sender: "User", text: 42 as unknown as string },
        null as unknown as DebateMessage,
        { sender: "User", text: "Kept.", phase: " " },
      ]),
      { topic: "No transcript", history: undefined as unknown as DebateMessage[] },
    ])
    expect(speeches).toEqual([{ label: "Practice debate — Speech", text: "Kept." }])
  })

  it("returns an empty list for no debates", () => {
    expect(practiceDebateUserSpeeches([])).toEqual([])
  })
})
