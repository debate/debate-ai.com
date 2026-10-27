import { describe, expect, it } from "vitest"
import type { VideoType } from "@debate-ai/types"
import { buildFileNews, buildForumNews, buildRoundNews } from "../../../src/lib/news/site-news"
import type { ForumThreadSummary } from "../../../src/lib/forums/types"

const thread = (overrides: Partial<ForumThreadSummary>): ForumThreadSummary => ({
  id: "t1",
  title: "Best K for PF?",
  excerpt: "Opening post",
  author: { id: "u1", name: "Sam", imageUrl: null },
  replyCount: 0,
  createdAt: 100,
  lastActivityAt: 100,
  ...overrides,
})

describe("buildRoundNews", () => {
  it("titles a round by its matchup and links to the watch page", () => {
    const video = ["vid1", "Round title", "2026-10-20T00:00:00Z", "ch", 0, "", "PF", "Harvard", "Finals", "Harker KL", "Strake AB"] as unknown as VideoType
    const [item] = buildRoundNews([video])
    expect(item).toMatchObject({
      id: "round-vid1",
      category: "rounds",
      title: "New round: Harker KL vs Strake AB",
      timestamp: Date.parse("2026-10-20T00:00:00Z"),
    })
    expect(item.body).toContain("Harvard")
    expect(item.href).toMatch(/^\//)
  })

  it("falls back to the video title without both teams", () => {
    const video = ["vid2", "Some round", "", "ch", 0, ""] as unknown as VideoType
    expect(buildRoundNews([video])[0]).toMatchObject({ title: "New round: Some round", timestamp: 0 })
  })
})

describe("buildFileNews", () => {
  it("posts a caselist file with its school and card count", () => {
    const [item] = buildFileNews([
      { id: 7, caselistLabel: "HSPolicy26", school: "Harker", team: "KL", side: "Aff", fileName: "1AC.docx", cardCount: 1, ingestedAt: 50 },
    ])
    expect(item).toEqual({
      id: "file-7",
      category: "files",
      title: "New file: 1AC.docx",
      body: "Harker KL · HSPolicy26 · 1 card · Aff",
      timestamp: 50_000,
      href: "/@harker",
    })
  })
})

describe("buildForumNews", () => {
  it("posts an unanswered thread as a new thread", () => {
    expect(buildForumNews([thread({})])[0]).toMatchObject({
      id: "forum-t1-100",
      category: "forums",
      title: "New thread: Best K for PF?",
      body: "Opening post",
      timestamp: 100_000,
      href: "/practice/forums/t1",
    })
  })

  it("posts a replied thread as a new reply, keyed by its last activity", () => {
    expect(buildForumNews([thread({ replyCount: 2, lastActivityAt: 300 })])[0]).toMatchObject({
      id: "forum-t1-300",
      title: 'New reply in "Best K for PF?"',
      body: "2 replies · started by Sam",
      timestamp: 300_000,
    })
  })
})
