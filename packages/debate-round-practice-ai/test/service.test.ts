/**
 * Guards the port of Go `GenerateBotResponse`/`JudgeDebate` and of the
 * result classification the Go controller did inline.
 */
import { describe, expect, it, vi } from "vitest"
import { createStaticModelClient, cleanModelOutput } from "../src/backend/model-client"
import {
  extractJudgmentJson,
  generateBotResponse,
  judgeDebate,
  parseJudgment,
  resolveResultStatus,
} from "../src/backend/service"
import type { DebateMessage } from "../src/backend/types"

const baseInput = {
  botName: "Yoda",
  botLevel: "Legends",
  topic: "Should AI rule the world?",
  history: [] as DebateMessage[],
  stance: "for",
}

describe("cleanModelOutput", () => {
  it("strips a json code fence", () => {
    expect(cleanModelOutput('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(cleanModelOutput("```\nplain\n```")).toBe("plain")
  })
})

describe("generateBotResponse", () => {
  it("answers in character when there is no model client", async () => {
    const reply = await generateBotResponse(null, baseInput)
    expect(reply).toContain("Dagobah")
  })

  it("answers in character when generation throws", async () => {
    const failing = { generateText: vi.fn().mockRejectedValue(new Error("boom")) }
    const reply = await generateBotResponse(failing, baseInput)
    expect(reply).toContain("clouded my response is")
  })

  it("answers in character on an empty completion", async () => {
    const reply = await generateBotResponse(createStaticModelClient(""), baseInput)
    expect(reply).toContain("Dagobah")
  })

  it("swaps a 'clarify' completion for the persona's clarification line", async () => {
    const reply = await generateBotResponse(
      createStaticModelClient("Please clarify your point."),
      baseInput,
    )
    expect(reply).toBe(
      "Clouded, your point is, young one. Clarify, you must, for wisdom to flow, like on Dagobah (exile home, introspection symbol).",
    )
  })

  it("passes the round's details into the prompt", async () => {
    const client = { generateText: vi.fn().mockResolvedValue("An argument.") }
    const reply = await generateBotResponse(client, { ...baseInput, context: "Make your statement" })
    expect(reply).toBe("An argument.")
    const prompt = client.generateText.mock.calls[0][0] as string
    expect(prompt).toContain("Should AI rule the world?")
    expect(prompt).toContain("Additional context: Make your statement")
  })
})

describe("judgeDebate", () => {
  it("returns the Go fallback string with no model client", async () => {
    expect(await judgeDebate(null, [])).toBe("Unable to judge.")
  })

  it("returns the Go fallback string when generation throws", async () => {
    const failing = { generateText: vi.fn().mockRejectedValue(new Error("boom")) }
    expect(await judgeDebate(failing, [])).toBe("Unable to judge.")
  })

  it("judges as the transcript's bot persona", async () => {
    const client = { generateText: vi.fn().mockResolvedValue("{}") }
    await judgeDebate(client, [
      { sender: "User", text: "a" },
      { sender: "Rafiki", text: "b" },
    ])
    expect(client.generateText.mock.calls[0][0]).toContain("Rafiki")
  })
})

describe("extractJudgmentJson", () => {
  it("unwraps a fenced payload", () => {
    expect(extractJudgmentJson('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it("finds a bare object inside surrounding prose", () => {
    expect(extractJudgmentJson('Here you go: {"a":1} — done')).toBe('{"a":1}')
  })

  it("falls back to an empty object", () => {
    expect(extractJudgmentJson("no json here")).toBe("{}")
    expect(extractJudgmentJson("")).toBe("{}")
  })
})

const scorecard = (winner: string) =>
  JSON.stringify({
    opening_statement: { user: { score: 8, reason: "" }, bot: { score: 7, reason: "" } },
    cross_examination: { user: { score: 8, reason: "" }, bot: { score: 7, reason: "" } },
    answers: { user: { score: 8, reason: "" }, bot: { score: 7, reason: "" } },
    closing: { user: { score: 8, reason: "" }, bot: { score: 7, reason: "" } },
    total: { user: 32, bot: 28 },
    verdict: { winner, reason: "", congratulations: "", opponent_analysis: "" },
  })

describe("parseJudgment", () => {
  it("rejects JSON that isn't a scorecard", () => {
    expect(parseJudgment('{"hello":"world"}')).toBeNull()
    expect(parseJudgment("not json")).toBeNull()
  })

  it("accepts a full scorecard", () => {
    expect(parseJudgment(scorecard("User"))?.total.user).toBe(32)
  })
})

describe("resolveResultStatus", () => {
  it("reads the verdict from a JSON scorecard, case-insensitively", () => {
    expect(resolveResultStatus(scorecard("User"))).toBe("win")
    expect(resolveResultStatus(scorecard("bot"))).toBe("loss")
    expect(resolveResultStatus(scorecard("Draw"))).toBe("draw")
  })

  it("defaults an unrecognised winner to a loss, as the Go controller did", () => {
    expect(resolveResultStatus(scorecard("Nobody"))).toBe("loss")
  })

  it("falls back to substring matching for non-JSON replies", () => {
    expect(resolveResultStatus("The user wins this round")).toBe("win")
    expect(resolveResultStatus("The bot wins this round")).toBe("loss")
    expect(resolveResultStatus("It was a draw")).toBe("draw")
    expect(resolveResultStatus("Unable to judge.")).toBe("loss")
  })
})
