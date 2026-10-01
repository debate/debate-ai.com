import { describe, expect, it } from "vitest"
import {
  canonicalCategoryHref,
  canonicalCategoryPathname,
} from "../src/routes/category-paths"

describe("canonicalCategoryPathname", () => {
  it.each([
    ["/cards", "/research/cards"],
    ["/cards/coverage", "/research/cards/coverage"],
    ["/cards/level", "/practice/level"],
    ["/cards/leaderboard/abc", "/coaching/leaderboard/abc"],
    ["/cards/progress-tracking", "/coaching/progress"],
    ["/topics", "/research/topics"],
    ["/practice-round", "/practice"],
    ["/practice-partners", "/practice/partners"],
    ["/versus-ai", "/practice/versus-ai"],
    ["/forums/t1", "/practice/forums/t1"],
    ["/tournaments/2026/nats", "/practice/tournaments/2026/nats"],
    ["/practice/tournaments-beta/38436/rounds", "/practice/tournaments/38436/rounds"],
    ["/judge-decision", "/practice/judge-decision"],
    ["/judges", "/practice/judges"],
    ["/videos/dictionary", "/practice/glossary"],
    ["/videos/rankings", "/practice/rankings"],
    ["/videos/stats", "/practice/statistics"],
    ["/videos/lectures", "/lectures"],
    ["/videos/topic_lectures", "/lectures/topic_lectures"],
    ["/coach", "/coaching"],
    ["/coach-materials", "/coaching/materials"],
    ["/coaching-programs", "/coaching/programs"],
    ["/outcomes", "/coaching/outcomes"],
    ["/rank", "/coaching/rankings"],
  ])("%s → %s", (from, to) => {
    expect(canonicalCategoryPathname(from)).toBe(to)
  })

  it.each([
    "/",
    "/videos",
    "/videos/pf",
    "/videos/topPicks",
    "/videos/watch/some-slug",
    "/videos/college/2024/finals",
    "/research",
    "/research/cards",
    "/practice",
    "/practice/drills",
    "/practice/tournaments",
    "/coaching",
    "/coaching/ai-coach",
    "/lectures",
    "/rankings",
    "/cardsx",
    "/docs/features/drills",
    "/api/tournaments",
    "/debate",
    "/doc",
  ])("leaves %s alone", (path) => {
    expect(canonicalCategoryPathname(path)).toBeNull()
  })
})

describe("canonicalCategoryHref", () => {
  it("keeps the query and hash", () => {
    expect(canonicalCategoryHref("/practice-partners#judge")).toBe("/practice/partners#judge")
    expect(canonicalCategoryHref("/cards?q=nato")).toBe("/research/cards?q=nato")
  })

  it("returns an unmoved href unchanged", () => {
    expect(canonicalCategoryHref("/reason-editor")).toBe("/reason-editor")
  })
})
