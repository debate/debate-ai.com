import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const articleQa = vi.fn()
vi.mock("qwksearch-api-client", () => ({ articleQa: (...args: unknown[]) => articleQa(...args) }))
vi.mock("grab-url", () => ({ log: vi.fn() }))

import { analyzeQuotes } from "../src/analysis/analyze-quotes"

const reply = (content: string) => ({ data: { content } })

describe("analyzeQuotes", () => {
  beforeEach(() => {
    articleQa.mockReset()
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it("analyzes only cards with HTML, up to the limit", async () => {
    articleQa.mockResolvedValue(reply('{"summary":"s","score":80}'))
    const data = {
      outline: [
        { html: "<p>one</p>", summary: "old" },
        { title: "no html" },
        { html: "<p>two</p>" },
        { html: "<p>three</p>" },
      ],
    }
    const out = await analyzeQuotes(data, { limit: 2, maxChars: 20 })
    expect(articleQa).toHaveBeenCalledTimes(2)
    const body = articleQa.mock.calls[0][0].body
    expect(body.article.length).toBeLessThanOrEqual(20)
    expect(body.chatModel.providerId).toBe("groq")
    expect(out.outline![0]).not.toHaveProperty("summary")
    expect(out.outline![0].analysis).toEqual({ summary: "s", score: 80 })
    expect(out.outline![3]).not.toHaveProperty("analysis")
  })

  it("treats a missing outline as empty", async () => {
    expect(await analyzeQuotes({})).toEqual({})
    expect(articleQa).not.toHaveBeenCalled()
  })

  it.each([
    ["fenced json", '```json\n{"score": 5}\n```', { score: 5 }],
    ["bare fence", '```\n{"score": 6}\n```', { score: 6 }],
    ["surrounding prose", 'Here: {"score": 7} done', { score: 7 }],
    ["trailing commas", '{"flaws": ["a", "b",], "score": 8,}', { flaws: ["a", "b"], score: 8 }],
    [
      "unparseable fields",
      '{"summary": "sum", "warrants": "w", "score": 42, "flaws": ["x", "y"] oops',
      { summary: "sum", warrants: "w", score: 42, flaws: ["x", "y"] },
    ],
    ["nothing useful", "no json here", null],
    ["empty response", "", null],
  ])("parses %s", async (_label, content, expected) => {
    articleQa.mockResolvedValue(reply(content))
    const out = await analyzeQuotes({ outline: [{ html: "<p/>" }] })
    expect(out.outline![0].analysis).toEqual(expected)
  })

  it("keeps going when a card fails", async () => {
    articleQa.mockRejectedValueOnce(new Error("boom")).mockRejectedValueOnce("str").mockResolvedValue(reply("{}"))
    const out = await analyzeQuotes({ outline: [{ html: "a" }, { html: "b" }, { html: "c" }] })
    expect(articleQa).toHaveBeenCalledTimes(3)
    expect(out.outline![2].analysis).toEqual({})
    expect(console.error).toHaveBeenCalledTimes(2)
  })

  it("reads from and writes to disk when given paths", async () => {
    articleQa.mockResolvedValue(reply('{"score": 1}'))
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "analyze-quotes-"))
    const input = path.join(dir, "in.json")
    const output = path.join(dir, "out.json")
    fs.writeFileSync(input, JSON.stringify({ outline: [{ html: "x" }] }))
    await analyzeQuotes(input, { outputPath: output })
    expect(JSON.parse(fs.readFileSync(output, "utf8")).outline[0].analysis).toEqual({ score: 1 })
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
