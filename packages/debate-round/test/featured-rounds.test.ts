import { describe, expect, it, vi } from "vitest"
import { debateStyles } from "@debate/timer/src/formats/debate-format-times"
import {
  FEATURED_ROUNDS,
  buildFeaturedRound,
  featuredRoundBySlug,
  findLocalFeaturedRound,
  loadFeaturedSpeechDocs,
} from "../src/round/featured-rounds"
import type { Round } from "../src/types/flow"

const ndt2015 = FEATURED_ROUNDS.find((featured) => featured.key === "ndt-2015-finals")!

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 404, json: async () => body } as Response
}

describe("featured rounds catalog", () => {
  it("lists NDT 2015 Finals as an 8-speech college policy round", () => {
    expect(ndt2015.debateStyle).toBe("collegePolicy")
    expect(debateStyles.collegePolicy.primary.columns).toEqual([
      "1AC", "1NC", "2AC", "2NC", "1NR", "1AR", "2NR", "2AR",
    ])
  })

  it("maps the seven published docs to speeches in speaking order", () => {
    const columns = debateStyles.collegePolicy.primary.columns
    const speeches = ndt2015.speechDocs.map((doc) => doc.speech)
    expect(speeches).toEqual(["1AC", "1NC", "2AC", "2NC", "1NR", "1AR", "2NR"])
    expect(speeches.every((speech, i) => columns.indexOf(speech) === i)).toBe(true)
  })

  it("gives every featured round a unique /debate/<tournament>/<teams> slug", () => {
    const slugs = FEATURED_ROUNDS.map((featured) => featured.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[^/]+\/[^/]+$/)
    expect(featuredRoundBySlug(ndt2015.slug)).toBe(ndt2015)
    expect(featuredRoundBySlug("nope/nope")).toBeUndefined()
  })
})

describe("loadFeaturedSpeechDocs", () => {
  it("fetches each speech's library file by id and decodes it", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const id = Number(new URL(url, "https://x").searchParams.get("path"))
      return jsonResponse({ item: { title: `doc ${id}`, content: `c${id}`, format: "cmir" } })
    })
    const toHtml = vi.fn(async (doc: { content?: string | null }) => `<p>${doc.content}</p>`)

    const { docs, missing } = await loadFeaturedSpeechDocs(ndt2015, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      toHtml,
    })

    expect(missing).toEqual([])
    expect(fetchImpl).toHaveBeenCalledWith("/api/topic-starters/by-path?path=48")
    expect(docs["1AC"]).toBe("<p>c48</p>")
    expect(docs["2NR"]).toBe("<p>c44</p>")
    expect(Object.keys(docs)).toHaveLength(7)
  })

  it("reports a doc that fails to load instead of failing the round", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("=46") ? jsonResponse({}, false) : jsonResponse({ item: { content: "x", format: "html" } }),
    )
    const { docs, missing } = await loadFeaturedSpeechDocs(ndt2015, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      toHtml: async (doc) => doc.content ?? "",
    })
    expect(missing).toEqual(["1NC"])
    expect(docs["1NC"]).toBeUndefined()
    expect(docs["1AC"]).toBe("x")
  })

  it("throws when no doc loads at all", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline")
    })
    await expect(
      loadFeaturedSpeechDocs(ndt2015, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/NDT 2015 Finals/)
  })
})

describe("buildFeaturedRound", () => {
  it("builds one college policy flow holding the docs, and its round", () => {
    const { flow, round } = buildFeaturedRound(ndt2015, { "1AC": "<p>1ac</p>", "2NR": "<p>2nr</p>" }, 3, 1234)

    expect(flow.id).toBe(1234)
    expect(flow.index).toBe(3)
    expect(flow.columns).toEqual(debateStyles.collegePolicy.primary.columns)
    expect(flow.children).toHaveLength(100)
    expect(flow.speechDocs).toEqual({ "1AC": "<p>1ac</p>", "2NR": "<p>2nr</p>" })
    expect(flow.archived).toBe(false)

    expect(round.flowIds).toEqual([1234])
    expect(round.slug).toBe(ndt2015.slug)
    expect(round.title).toBe("NDT 2015 Finals")
    expect(round.schools?.aff[0]).toBe("Northwestern MV")
    expect(round.schools?.neg[0]).toBe("Michigan AP")
  })
})

describe("findLocalFeaturedRound", () => {
  const round = (id: number, slug: string, flowIds: number[]): Round => ({
    id,
    slug,
    flowIds,
    tournamentName: "",
    roundLevel: "",
    debaters: { aff: ["", ""], neg: ["", ""] },
    judges: [],
    timestamp: 0,
    status: "completed",
  })

  it("finds the round built earlier while its flow still exists", () => {
    const built = round(1, ndt2015.slug, [10])
    expect(findLocalFeaturedRound(ndt2015, [round(2, "other/x", [11]), built], [{ id: 10 }])).toBe(built)
  })

  it("ignores a built round whose flows were deleted", () => {
    expect(findLocalFeaturedRound(ndt2015, [round(1, ndt2015.slug, [10])], [{ id: 99 }])).toBeUndefined()
  })
})
