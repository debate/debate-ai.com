/**
 * @fileoverview The opponent's pre-round prep on the merged Practice vs AI
 * page: prompt construction, parsing the model's brief, the cards-only
 * fallback, the `/vsbot/prep` handler, and the topic-to-search-query step.
 */
import { describe, expect, it, vi } from "vitest"
import {
  buildFallbackCaseBrief,
  constructCasePrepPrompt,
  MAX_PREP_CARDS,
  parseCaseBrief,
  prepareCaseBrief,
  sanitizePrepCards,
} from "../src/backend/case-prep"
import { createPracticeVsAiBackend } from "../src/backend/handlers"
import { createStaticModelClient } from "../src/backend/model-client"
import { createInMemoryDebateStore } from "../src/backend/store"
import { findPrepEvidence, topicSearchQuery } from "../src/client"

const cards = [
  { tag: "Regulation curbs misinformation", cite: "Smith 24", side: "aff" },
  { tag: "Regulation chills speech", cite: "Jones 23", side: "neg" },
]
const input = { botName: "Moderate Mike", botLevel: "Medium", topic: "Should social media be regulated?", stance: "for", cards }

const modelBrief = JSON.stringify({
  summary: "Clash is over speech versus harm.",
  yourArguments: [{ claim: "Misinformation harms democracy", warrant: "Smith shows it", cardIndexes: [0, 0, 7] }],
  opponentArguments: [{ claim: "Speech is chilled", warrant: "Jones", cardIndexes: [1] }],
})

describe("constructCasePrepPrompt", () => {
  it("names the topic, both sides and every card by index", () => {
    const prompt = constructCasePrepPrompt(input, cards, [{ title: "Michigan AB Aff" }])
    expect(prompt).toContain("Should social media be regulated?")
    expect(prompt).toContain("debates the For side")
    expect(prompt).toContain("[0] Regulation curbs misinformation (aff) — Smith 24")
    expect(prompt).toContain("[1] Regulation chills speech")
    expect(prompt).toContain("Michigan AB Aff")
  })
})

describe("parseCaseBrief", () => {
  it("reads fenced JSON and drops out-of-range or duplicate card indexes", () => {
    const brief = parseCaseBrief("```json\n" + modelBrief + "\n```", cards.length)
    expect(brief?.generated).toBe(true)
    expect(brief?.yourArguments[0]?.cardIndexes).toEqual([0])
    expect(brief?.opponentArguments[0]?.claim).toBe("Speech is chilled")
  })

  it("returns null for prose or an empty brief", () => {
    expect(parseCaseBrief("I cannot help with that.", 2)).toBeNull()
    expect(parseCaseBrief('{"summary":"x","yourArguments":[],"opponentArguments":[]}', 2)).toBeNull()
  })
})

describe("buildFallbackCaseBrief", () => {
  it("sorts cards onto the side the corpus says read them", () => {
    const brief = buildFallbackCaseBrief(input, cards)
    expect(brief.generated).toBe(false)
    expect(brief.yourArguments.map((a) => a.claim)).toEqual(["Regulation curbs misinformation"])
    expect(brief.opponentArguments.map((a) => a.claim)).toEqual(["Regulation chills speech"])
  })

  it("flips the sides for an Against debater", () => {
    const brief = buildFallbackCaseBrief({ ...input, stance: "against" }, cards)
    expect(brief.yourArguments.map((a) => a.claim)).toEqual(["Regulation chills speech"])
  })

  it("still says something useful with no cards", () => {
    expect(buildFallbackCaseBrief(input, []).summary).toContain("No evidence cards matched")
  })
})

describe("prepareCaseBrief", () => {
  it("uses the model's brief when it parses", async () => {
    const brief = await prepareCaseBrief(createStaticModelClient(modelBrief), input)
    expect(brief.summary).toBe("Clash is over speech versus harm.")
  })

  it("falls back to the cards with no model, a bad reply, or a model error", async () => {
    expect((await prepareCaseBrief(null, input)).generated).toBe(false)
    expect((await prepareCaseBrief(createStaticModelClient("nope"), input)).generated).toBe(false)
    vi.spyOn(console, "error").mockImplementation(() => {})
    const failing = { generateText: () => Promise.reject(new Error("down")) }
    expect((await prepareCaseBrief(failing, input)).generated).toBe(false)
  })

  it("caps and clips what a client can send", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ tag: `t${i}`.padEnd(1000, "x") }))
    const clean = sanitizePrepCards([...many, null, { tag: "" }, "junk"])
    expect(clean).toHaveLength(MAX_PREP_CARDS)
    expect(clean[0]!.tag.length).toBe(300)
  })
})

describe("prepareCase handler", () => {
  const backend = createPracticeVsAiBackend({ store: createInMemoryDebateStore(), model: createStaticModelClient(modelBrief) })
  const actor = { userId: "u", email: "u@example.com" }

  it("returns the brief", async () => {
    const result = await backend.prepareCase(actor, input)
    expect(result.status).toBe(200)
    expect((result.body as { brief: { summary: string } }).brief.summary).toContain("speech")
  })

  it("rejects a payload missing the topic", async () => {
    const result = await backend.prepareCase(actor, { ...input, topic: "" })
    expect(result.status).toBe(400)
  })
})

describe("topicSearchQuery", () => {
  it("drops punctuation and filler words", () => {
    expect(topicSearchQuery("Should social media be regulated?")).toBe("social media regulated")
    expect(topicSearchQuery("?!")).toBe("")
  })
})

describe("findPrepEvidence", () => {
  it("searches cards and outlines, mapping each into prep shape", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const outlines = url.includes("searchOutlines=1")
      const results = outlines
        ? [{ id: 9, tag: "Michigan AB Aff.docx", cite_short: "Michigan AB", side: "aff" }]
        : [{ id: 1, tag: "<b>Regulation</b> works", cite_short: "Smith 24", summary: "<p>Text</p>", side: "aff" }, { tag: "" }]
      return new Response(JSON.stringify({ results }), { status: 200 })
    })
    vi.stubGlobal("fetch", fetchMock)
    const { cards: found, cases } = await findPrepEvidence("Should social media be regulated?")
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=social%20media%20regulated", expect.anything())
    expect(found).toEqual([{ id: "1", tag: "Regulation works", cite: "Smith 24", excerpt: "Text", side: "aff" }])
    expect(cases).toEqual([{ id: "9", title: "Michigan AB Aff.docx", owner: "Michigan AB", side: "aff" }])
    vi.unstubAllGlobals()
  })

  it("treats a rate-limited search as no results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })))
    expect(await findPrepEvidence("climate change")).toEqual({ cards: [], cases: [] })
    vi.unstubAllGlobals()
  })
})
