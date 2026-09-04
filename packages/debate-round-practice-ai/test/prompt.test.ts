/**
 * Guards the port of the prompt-building half of Go
 * `backend/services/debatevsbot.go`.
 */
import { describe, expect, it } from "vitest"
import {
  constructJudgePrompt,
  constructPrompt,
  findLastUserMessage,
  formatHistory,
  inferOpponentStyle,
} from "../src/backend/prompt"
import { getBotPersonality } from "../src/backend/personalities"
import type { DebateMessage } from "../src/backend/types"

describe("formatHistory", () => {
  it("labels an unphased line the way the Go version did", () => {
    const history: DebateMessage[] = [
      { sender: "User", text: "Hello", phase: "Opening Statements" },
      { sender: "Bot", text: "Hmmm" },
    ]
    expect(formatHistory(history)).toBe(
      "User (Opening Statements): Hello\nBot (Unspecified Phase): Hmmm\n",
    )
  })
})

describe("findLastUserMessage", () => {
  it("prefers the newest User line", () => {
    const history: DebateMessage[] = [
      { sender: "User", text: "first" },
      { sender: "Bot", text: "reply" },
      { sender: "User", text: "second" },
    ]
    expect(findLastUserMessage(history).text).toBe("second")
  })

  it("falls back to the last line of any sender", () => {
    expect(findLastUserMessage([{ sender: "Bot", text: "only" }]).text).toBe("only")
  })

  it("returns an empty message for an empty transcript", () => {
    expect(findLastUserMessage([]).text).toBe("")
  })
})

describe("inferOpponentStyle", () => {
  it("needs two keyword hits before it commits", () => {
    expect(inferOpponentStyle("that is absurd")).toBe("Neutral opponent")
    expect(inferOpponentStyle("that is absurd nonsense")).toBe("Aggressive opponent")
  })

  it("classifies each bucket", () => {
    expect(inferOpponentStyle("the data and the study agree")).toBe("Logical opponent")
    expect(inferOpponentStyle("I feel it in my heart")).toBe("Emotional opponent")
    expect(inferOpponentStyle("obviously and clearly so")).toBe("Confident opponent")
    expect(inferOpponentStyle("random guess, whatever")).toBe("Irrational opponent")
  })

  it("keeps the Go precedence when two buckets tie", () => {
    // "prove it"/"wrong" (aggressive) and "evidence"/"data" (logical) both hit
    // twice; the Go switch checked aggressive first.
    expect(inferOpponentStyle("prove it, you are wrong — where is the evidence or data?")).toBe(
      "Aggressive opponent",
    )
  })
})

describe("constructPrompt", () => {
  const yoda = getBotPersonality("Yoda")

  it("builds an opening-statement prompt for an empty transcript", () => {
    const prompt = constructPrompt(yoda, "Should AI rule the world?", [], "for", "", 150)
    expect(prompt).toContain("This is the Opening Statement phase")
    expect(prompt).toContain("You are Yoda, a Legends-level debate bot arguing for")
    expect(prompt).toContain("Limit your response to 150 words.")
    expect(prompt).not.toContain("Transcript:")
  })

  it("treats a one-line transcript as still opening, as the Go code did", () => {
    const prompt = constructPrompt(
      yoda,
      "Topic",
      [{ sender: "User", text: "hi", phase: "Opening Statements" }],
      "for",
      "",
      0,
    )
    expect(prompt).toContain("This is the Opening Statement phase")
    expect(prompt).not.toContain("Limit your response to")
  })

  it("switches to a phase-aware continuation once the round is going", () => {
    const history: DebateMessage[] = [
      { sender: "User", text: "Opening", phase: "Opening Statement" },
      { sender: "Bot", text: "Reply", phase: "Opening Statement" },
      { sender: "User", text: "Why is that?", phase: "Cross Examination" },
    ]
    const prompt = constructPrompt(yoda, "Topic", history, "against", "Answer it", 150)
    expect(prompt).toContain("This is the Cross Examination phase")
    expect(prompt).toContain('User’s message: "Why is that?"')
    expect(prompt).toContain("Additional context: Answer it")
    expect(prompt).toContain("Transcript:")
  })

  it("normalises the rebuttal phases onto Cross Examination", () => {
    const history: DebateMessage[] = [
      { sender: "User", text: "a", phase: "First Rebuttal" },
      { sender: "Bot", text: "b", phase: "First Rebuttal" },
      { sender: "User", text: "c", phase: "first rebuttal" },
    ]
    expect(constructPrompt(yoda, "Topic", history, "for", "", 0)).toContain(
      "This is the Cross Examination phase",
    )
  })

  it("applies the persona's modifier for the inferred opponent style", () => {
    const history: DebateMessage[] = [
      { sender: "User", text: "x", phase: "Opening Statement" },
      { sender: "Bot", text: "y", phase: "Opening Statement" },
      { sender: "User", text: "the data and the study say so", phase: "Cross Examination" },
    ]
    const prompt = constructPrompt(yoda, "Topic", history, "for", "", 0)
    expect(prompt).toContain("Adjust your response based on the opponent’s style (Logical opponent)")
  })

  it("substitutes a placeholder for an empty user turn", () => {
    const history: DebateMessage[] = [
      { sender: "User", text: "x", phase: "Opening Statement" },
      { sender: "Bot", text: "y", phase: "Opening Statement" },
      { sender: "User", text: "   ", phase: "Closing Statement" },
    ]
    expect(constructPrompt(yoda, "Topic", history, "for", "", 0)).toContain(
      "It appears you didn’t say anything.",
    )
  })
})

describe("constructJudgePrompt", () => {
  it("demands strict JSON and folds in the persona's traits", () => {
    const prompt = constructJudgePrompt(getBotPersonality("Tony Stark"), [
      { sender: "User", text: "a", phase: "Opening Statements" },
    ])
    expect(prompt).toContain("Provide ONLY the JSON output without any additional text.")
    expect(prompt).toContain('"opening_statement"')
    expect(prompt).toContain("Tony Stark")
  })
})
