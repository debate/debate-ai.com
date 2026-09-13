/**
 * @fileoverview Exercises the gamification persistence this store adds to
 * `user_settings` — the "computed but not persisted" gap tracked in
 * packages/debate-help-docs/content/docs/features/practice-vs-ai.mdx's Known
 * gaps, against a real in-memory SQLite database (same approach as
 * lib/admin/__tests__/debate-card-import.test.ts).
 */
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as schema from "../../database/schema"
import { userSettings } from "../../database/schema"

const getDBFromContext = vi.fn()
vi.mock("../../database/context", () => ({
  getDBFromContext: () => getDBFromContext(),
}))

const { createPracticeVsAiStore } = await import("../store")

/** A fresh in-memory database with just the columns this store touches. */
async function freshDb() {
  const client = createClient({ url: ":memory:" })
  await client.execute(`CREATE TABLE user (id TEXT PRIMARY KEY)`)
  // Every `user_settings` column, matching schema.ts, since a plain
  // `db.insert(userSettings).values(...)` lists every declared column
  // (nulls for the ones this store doesn't set) regardless of which columns
  // the test cares about.
  await client.execute(`
    CREATE TABLE user_settings (
      user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
      debate_style INTEGER,
      font_size INTEGER,
      color_theme TEXT,
      theme_mode TEXT,
      favorite_tools TEXT,
      editor_preferences TEXT,
      news_read TEXT,
      news_liked TEXT,
      word_limit_presets TEXT,
      outline_filter_presets TEXT,
      saved_argument_collections TEXT,
      research_progress_goal TEXT,
      quest_streak_sync TEXT,
      qualification_points_table TEXT,
      qualification_cutoff TEXT,
      practice_vs_ai_score INTEGER,
      practice_vs_ai_badges TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  await client.execute(`INSERT INTO user (id) VALUES ('user-1')`)
  await client.execute(`INSERT INTO user (id) VALUES ('user-2')`)
  return drizzle(client, { schema })
}

describe("createPracticeVsAiStore gamification", () => {
  let db: Awaited<ReturnType<typeof freshDb>>

  beforeEach(async () => {
    db = await freshDb()
    getDBFromContext.mockResolvedValue(db)
  })

  it("reports a zeroed profile with no persisted streak when no row exists yet", async () => {
    const store = createPracticeVsAiStore("user-1")
    const profile = await store.getGamificationProfile!("user-1")
    expect(profile).toEqual({ score: 0, badges: [], currentStreak: 0 })
  })

  it("persists a win's score and badges, creating the row on first award", async () => {
    const store = createPracticeVsAiStore("user-1")
    await store.applyGamificationAward!(
      "user-1",
      { points: 50, action: "debate_win", badgesAwarded: ["FirstWin", "Novice"], newScore: 50 },
      { debateType: "user_vs_bot", topic: "Topic", result: "win" },
    )

    const profile = await store.getGamificationProfile!("user-1")
    expect(profile).toEqual({ score: 50, badges: ["FirstWin", "Novice"], currentStreak: 0 })
  })

  it("accumulates badges across rounds instead of overwriting them", async () => {
    const store = createPracticeVsAiStore("user-1")
    await store.applyGamificationAward!(
      "user-1",
      { points: 50, action: "debate_win", badgesAwarded: ["FirstWin", "Novice"], newScore: 50 },
      { debateType: "user_vs_bot", topic: "Topic", result: "win" },
    )
    await store.applyGamificationAward!(
      "user-1",
      { points: 460, action: "debate_win", badgesAwarded: ["FactMaster"], newScore: 510 },
      { debateType: "user_vs_bot", topic: "Topic", result: "win" },
    )

    const profile = await store.getGamificationProfile!("user-1")
    expect(profile?.score).toBe(510)
    expect(profile?.badges.sort()).toEqual(["FactMaster", "FirstWin", "Novice"])
  })

  it("never duplicates a badge already on the row", async () => {
    const store = createPracticeVsAiStore("user-1")
    await store.applyGamificationAward!(
      "user-1",
      { points: 50, action: "debate_win", badgesAwarded: ["FirstWin"], newScore: 50 },
      { debateType: "user_vs_bot", topic: "Topic", result: "win" },
    )
    await store.applyGamificationAward!(
      "user-1",
      { points: 50, action: "debate_win", badgesAwarded: ["FirstWin"], newScore: 100 },
      { debateType: "user_vs_bot", topic: "Topic", result: "win" },
    )

    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, "user-1"))
    expect(JSON.parse(row.practiceVsAiBadges ?? "[]")).toEqual(["FirstWin"])
  })

  it("does not touch another user's row", async () => {
    const storeOne = createPracticeVsAiStore("user-1")
    const storeTwo = createPracticeVsAiStore("user-2")

    await storeOne.applyGamificationAward!(
      "user-1",
      { points: 50, action: "debate_win", badgesAwarded: ["FirstWin"], newScore: 50 },
      { debateType: "user_vs_bot", topic: "Topic", result: "win" },
    )

    expect(await storeTwo.getGamificationProfile!("user-2")).toEqual({
      score: 0,
      badges: [],
      currentStreak: 0,
    })
  })
})
