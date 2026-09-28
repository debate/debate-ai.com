import { describe, expect, it } from "vitest"

import { compareSpecificity, matchRoute } from "../../src/host/match"

describe("matchRoute", () => {
  it("matches static, dynamic and catch-all segments with Next's param names", () => {
    expect(matchRoute("/videos", "/videos")).toEqual({})
    expect(matchRoute("/videos/[category]", "/videos/ndt")).toEqual({ category: "ndt" })
    expect(matchRoute("/tournaments/[[...slug]]", "/tournaments")).toEqual({})
    expect(matchRoute("/tournaments/[[...slug]]", "/tournaments/a/b")).toEqual({ slug: ["a", "b"] })
    expect(matchRoute("/docs/[...slug]", "/docs")).toBeNull()
  })

  it("rejects paths of a different length and decodes segments", () => {
    expect(matchRoute("/videos/[category]", "/videos")).toBeNull()
    expect(matchRoute("/videos/[category]", "/videos/a/b")).toBeNull()
    expect(matchRoute("/cards/leaderboard/[id]", "/cards/leaderboard/Jane%20Doe")).toEqual({ id: "Jane Doe" })
    // A malformed escape is kept as written instead of throwing.
    expect(matchRoute("/cards/leaderboard/[id]", "/cards/leaderboard/100%")).toEqual({ id: "100%" })
  })

  it("orders static routes before dynamic ones before catch-alls", () => {
    const patterns = ["/videos/[[...rest]]", "/videos/[category]", "/videos/watch"]
    expect([...patterns].sort(compareSpecificity)).toEqual(["/videos/watch", "/videos/[category]", "/videos/[[...rest]]"])
  })
})
