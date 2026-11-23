/**
 * @fileoverview Exercises the gamification persistence this store adds to
 * `user_settings` — the "computed but not persisted" gap tracked in
 * packages/debate-help-docs/content/docs/features/rounds#practice-vs-ai.mdx's Known
 * gaps, against a real in-memory SQLite database (same approach as
 * lib/admin/__tests__/debate-card-import.test.ts).
 */
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as schema from "../../database/schema"
import { practiceVsAiDebates, userSettings } from "../../database/schema"

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
      recent_tools TEXT,
      editor_preferences TEXT,
      flow_editor_settings TEXT,
      flow_auto_save TEXT,
      font_family TEXT,
      news_read TEXT,
      news_liked TEXT,
      word_limit_presets TEXT,
      outline_filter_presets TEXT,
      saved_argument_collections TEXT,
      research_progress_goal TEXT,
      quest_streak_sync TEXT,
      qualification_points_table TEXT,
      qualification_cutoff TEXT,
      brainstorm_session_timer TEXT,
      practice_vs_ai_score INTEGER,
      practice_vs_ai_badges TEXT,
      practice_vs_ai_last_played_day_key TEXT,
      practice_vs_ai_current_streak INTEGER,
      my_team_profile TEXT,
      my_ranked_teams TEXT,
      welcome_dismissed_at INTEGER,
      recording_privacy TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  await client.execute(`
    CREATE TABLE practice_vs_ai_debates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      email TEXT NOT NULL DEFAULT '',
      bot_name TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '',
      result TEXT NOT NULL DEFAULT 'pending',
      data TEXT NOT NULL,
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
    const award = await store.applyGamificationAward!("user-1", {
      debateType: "user_vs_bot",
      topic: "Topic",
      result: "win",
    })
    expect(award).toEqual({ points: 50, action: "debate_win", badgesAwarded: ["FirstWin", "Novice"], newScore: 50 })

    const profile = await store.getGamificationProfile!("user-1")
    expect(profile).toEqual({ score: 50, badges: ["FirstWin", "Novice"], currentStreak: 1 })
  })

  it("accumulates score and badges across rounds instead of overwriting them", async () => {
    const store = createPracticeVsAiStore("user-1")
    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "win" })
    // Nine more wins (450 more points) crosses the 500-point FactMaster threshold.
    for (let i = 0; i < 9; i++) {
      await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "win" })
    }

    const profile = await store.getGamificationProfile!("user-1")
    expect(profile?.score).toBe(500)
    expect(profile?.badges.sort()).toEqual(["FactMaster", "FirstWin", "Novice"])
  })

  it("never duplicates a badge already on the row", async () => {
    const store = createPracticeVsAiStore("user-1")
    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "win" })
    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "win" })

    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, "user-1"))
    expect(JSON.parse(row.practiceVsAiBadges ?? "[]").sort()).toEqual(["FirstWin", "Novice"])
  })

  it("does not touch another user's row", async () => {
    const storeOne = createPracticeVsAiStore("user-1")
    const storeTwo = createPracticeVsAiStore("user-2")

    await storeOne.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "win" })

    expect(await storeTwo.getGamificationProfile!("user-2")).toEqual({
      score: 0,
      badges: [],
      currentStreak: 0,
    })
  })

  it("keeps both rounds' points even when a stale profile was read before either finished (the lost-update race this closes)", async () => {
    const store = createPracticeVsAiStore("user-1")

    // The historical bug: a caller (the AI-judging round handler) reads the
    // starting profile, then — separated by a slow judging call — computes
    // and persists an award from that now-stale snapshot. Reading the
    // profile here and never handing it back to `applyGamificationAward`
    // proves the new signature makes that vector impossible: there is no
    // parameter left for a caller to pass a precomputed/stale award through.
    const staleProfile = await store.getGamificationProfile!("user-1")
    expect(staleProfile?.score).toBe(0)

    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Round A", result: "win" })
    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Round B", result: "loss" })

    // Round B's write re-reads the row fresh (score 50 from Round A), not
    // the `staleProfile` snapshot from before either round finished — so
    // both awards land instead of Round B's clobbering Round A's.
    const profile = await store.getGamificationProfile!("user-1")
    expect(profile?.score).toBe(60)
  })

  it("extends the streak one day at a time and awards Streak5 on the fifth consecutive day", async () => {
    vi.useFakeTimers()
    const store = createPracticeVsAiStore("user-1")
    const day = (n: number) => new Date(Date.UTC(2026, 0, n, 12, 0, 0))

    for (let n = 1; n <= 4; n++) {
      vi.setSystemTime(day(n))
      const award = await store.applyGamificationAward!("user-1", {
        debateType: "user_vs_bot",
        topic: "Topic",
        result: "loss",
      })
      expect(award.badgesAwarded).not.toContain("Streak5")
    }

    vi.setSystemTime(day(5))
    const fifthDayAward = await store.applyGamificationAward!("user-1", {
      debateType: "user_vs_bot",
      topic: "Topic",
      result: "loss",
    })
    expect(fifthDayAward.badgesAwarded).toContain("Streak5")

    vi.setSystemTime(day(5))
    const profile = await store.getGamificationProfile!("user-1")
    expect(profile?.currentStreak).toBe(5)
    vi.useRealTimers()
  })

  it("does not advance the streak for a second round the same day", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 9, 0, 0)))
    const store = createPracticeVsAiStore("user-1")
    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "loss" })

    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 21, 0, 0)))
    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "loss" })

    const profile = await store.getGamificationProfile!("user-1")
    expect(profile?.currentStreak).toBe(1)
    vi.useRealTimers()
  })

  it("resets the streak to 1 after a missed day", async () => {
    vi.useFakeTimers()
    const store = createPracticeVsAiStore("user-1")
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 12, 0, 0)))
    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "loss" })

    // Skips Jan 2 entirely — the streak should restart rather than extend.
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 3, 12, 0, 0)))
    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "loss" })

    const profile = await store.getGamificationProfile!("user-1")
    expect(profile?.currentStreak).toBe(1)
    vi.useRealTimers()
  })

  it("reports the streak as lapsed (0) once a day has passed with no new round, without resetting the stored value", async () => {
    vi.useFakeTimers()
    const store = createPracticeVsAiStore("user-1")
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 12, 0, 0)))
    await store.applyGamificationAward!("user-1", { debateType: "user_vs_bot", topic: "Topic", result: "loss" })

    // Two days later, with no round played in between: the streak reads as
    // broken, but a round played "today" would still resume from scratch
    // rather than from some in-between stale value.
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 3, 12, 0, 0)))
    const profile = await store.getGamificationProfile!("user-1")
    expect(profile?.currentStreak).toBe(0)
    vi.useRealTimers()
  })
})

describe("createPracticeVsAiStore listDebates", () => {
  let db: Awaited<ReturnType<typeof freshDb>>

  beforeEach(async () => {
    db = await freshDb()
    getDBFromContext.mockResolvedValue(db)
  })

  async function insertDebate(overrides: { userId: string; topic: string; createdAt: number }) {
    await db.insert(practiceVsAiDebates).values({
      userId: overrides.userId,
      email: "debater@example.com",
      botName: "Yoda",
      topic: overrides.topic,
      outcome: "",
      result: "pending",
      data: JSON.stringify({
        email: "debater@example.com",
        botName: "Yoda",
        botLevel: "Legends",
        topic: overrides.topic,
        stance: "for",
        history: [],
        phaseTimings: [],
        createdAt: overrides.createdAt,
      }),
      createdAt: new Date(overrides.createdAt * 1000),
    })
  }

  it("lists a user's debates newest first, full transcript included", async () => {
    await insertDebate({ userId: "user-1", topic: "older", createdAt: 100 })
    await insertDebate({ userId: "user-1", topic: "newer", createdAt: 200 })

    const store = createPracticeVsAiStore("user-1")
    const debates = await store.listDebates!("debater@example.com")
    expect(debates.map((d) => d.topic)).toEqual(["newer", "older"])
    expect(debates[0].botName).toBe("Yoda")
  })

  it("does not include another user's debates", async () => {
    await insertDebate({ userId: "user-1", topic: "mine", createdAt: 100 })
    await insertDebate({ userId: "user-2", topic: "not mine", createdAt: 200 })

    const store = createPracticeVsAiStore("user-1")
    const debates = await store.listDebates!("debater@example.com")
    expect(debates.map((d) => d.topic)).toEqual(["mine"])
  })

  it("returns an empty list when the user has no debates", async () => {
    const store = createPracticeVsAiStore("user-1")
    expect(await store.listDebates!("debater@example.com")).toEqual([])
  })
})

describe("createPracticeVsAiStore deleteDebate", () => {
  beforeEach(async () => {
    getDBFromContext.mockResolvedValue(await freshDb())
  })

  const round = {
    email: "debater@example.com",
    botName: "Yoda",
    botLevel: "Legends",
    topic: "Tariffs",
    stance: "for",
    history: [],
    phaseTimings: [],
    createdAt: 100,
  }

  it("removes the user's round and reports it", async () => {
    const store = createPracticeVsAiStore("user-1")
    const id = await store.createDebate(round)
    const kept = await store.createDebate({ ...round, topic: "Nukes" })
    expect(await store.deleteDebate!(id, round.email)).toBe(true)
    expect(await store.getDebate(id)).toBeNull()
    expect((await store.listDebates!(round.email)).map((d) => d.id)).toEqual([kept])
    expect(await store.deleteDebate!(id, round.email)).toBe(false)
  })

  it("goes by the owning user, not the email passed in", async () => {
    const id = await createPracticeVsAiStore("user-2").createDebate(round)
    expect(await createPracticeVsAiStore("user-1").deleteDebate!(id, round.email)).toBe(false)
    expect(await createPracticeVsAiStore("user-2").getDebate(id)).not.toBeNull()
    expect(await createPracticeVsAiStore("user-2").deleteDebate!(id, "changed@example.com")).toBe(true)
  })

  it("answers false for a non-numeric id", async () => {
    expect(await createPracticeVsAiStore("user-1").deleteDebate!("guest_x", round.email)).toBe(false)
  })
})

describe("createPracticeVsAiStore setDebrief", () => {
  let db: Awaited<ReturnType<typeof freshDb>>

  beforeEach(async () => {
    db = await freshDb()
    getDBFromContext.mockResolvedValue(db)
  })

  const round = {
    email: "debater@example.com",
    botName: "Yoda",
    botLevel: "Legends",
    topic: "Tariffs",
    stance: "for",
    history: [{ sender: "User", text: "Tariffs raise prices." }],
    phaseTimings: [],
    createdAt: 100,
  }
  const debrief = { personaId: "socratic", text: "Why did your link hold?", savedAt: 200 }

  it("keeps the debrief in the round's data, leaving the rest of the record intact", async () => {
    const store = createPracticeVsAiStore("user-1")
    const id = await store.createDebate(round)
    await store.setDebrief!(id, debrief)

    const read = await store.getDebate(id)
    expect(read?.debrief).toEqual(debrief)
    expect(read?.history).toEqual(round.history)
    const [row] = await db.select().from(practiceVsAiDebates).where(eq(practiceVsAiDebates.id, Number(id)))
    expect(JSON.parse(row.data).debrief).toEqual(debrief)
    expect((await store.listDebates!("debater@example.com"))[0].debrief).toEqual(debrief)
  })

  it("replaces an earlier debrief", async () => {
    const store = createPracticeVsAiStore("user-1")
    const id = await store.createDebate(round)
    await store.setDebrief!(id, debrief)
    await store.setDebrief!(id, { personaId: "standard", text: "Weigh earlier.", savedAt: 300 })
    expect((await store.getDebate(id))?.debrief).toEqual({ personaId: "standard", text: "Weigh earlier.", savedAt: 300 })
  })

  it("keeps a later-written debrief when an older one is written last", async () => {
    const store = createPracticeVsAiStore("user-1")
    const id = await store.createDebate(round)
    const newer = { ...debrief, text: "Newer.", writtenAt: 2_000 }
    await expect(store.setDebrief!(id, newer)).resolves.toBe(true)
    await expect(store.setDebrief!(id, { ...debrief, text: "Older.", writtenAt: 1_000 })).resolves.toBe(false)
    expect((await store.getDebate(id))?.debrief).toEqual(newer)
  })

  it("never writes to another user's round", async () => {
    const id = await createPracticeVsAiStore("user-2").createDebate(round)
    await createPracticeVsAiStore("user-1").setDebrief!(id, debrief)
    expect((await createPracticeVsAiStore("user-2").getDebate(id))?.debrief).toBeUndefined()
  })

  it("ignores a non-numeric id", async () => {
    await expect(createPracticeVsAiStore("user-1").setDebrief!("guest_x", debrief)).resolves.toBeUndefined()
  })

  it("drops a malformed stored debrief instead of failing the round", async () => {
    await db.insert(practiceVsAiDebates).values({
      userId: "user-1",
      email: round.email,
      botName: round.botName,
      topic: round.topic,
      outcome: "",
      result: "pending",
      data: JSON.stringify({ ...round, debrief: { text: 42 } }),
    })
    const [read] = await createPracticeVsAiStore("user-1").listDebates!("debater@example.com")
    expect(read.topic).toBe("Tariffs")
    expect(read.debrief).toBeUndefined()
  })
})

describe("createPracticeVsAiStore setOutcome judge feedback style", () => {
  let db: Awaited<ReturnType<typeof freshDb>>

  beforeEach(async () => {
    db = await freshDb()
    getDBFromContext.mockResolvedValue(db)
  })

  const round = {
    email: "debater@example.com",
    botName: "Yoda",
    botLevel: "Legends",
    topic: "Tariffs",
    stance: "for",
    history: [{ sender: "User", text: "Tariffs raise prices." }],
    phaseTimings: [],
    createdAt: 100,
  }
  const verdict = '{"verdict":"User wins"}'

  it("keeps the style with the outcome in the round's data, leaving the rest intact", async () => {
    const store = createPracticeVsAiStore("user-1")
    const id = await store.createDebate(round)
    await store.setOutcome(id, verdict, { feedbackStyle: "socratic" })

    const read = await store.getDebate(id)
    expect(read?.judgeFeedbackStyle).toBe("socratic")
    expect(read?.outcome).toBe(verdict)
    expect(read?.history).toEqual(round.history)
    const [row] = await db.select().from(practiceVsAiDebates).where(eq(practiceVsAiDebates.id, Number(id)))
    expect(row.outcome).toBe(verdict)
    expect(JSON.parse(row.data).judgeFeedbackStyle).toBe("socratic")
    expect((await store.listDebates!("debater@example.com"))[0].judgeFeedbackStyle).toBe("socratic")
  })

  it("clears the style when the outcome is replaced without one (a concede)", async () => {
    const store = createPracticeVsAiStore("user-1")
    const id = await store.createDebate(round)
    await store.setOutcome(id, verdict, { feedbackStyle: "fact-checker" })
    await store.setOutcome(id, "User conceded")
    const read = await store.getDebate(id)
    expect(read?.outcome).toBe("User conceded")
    expect(read?.judgeFeedbackStyle).toBeUndefined()
    const [row] = await db.select().from(practiceVsAiDebates).where(eq(practiceVsAiDebates.id, Number(id)))
    expect(row.result).toBe("loss")
  })

  it("never writes to another user's round", async () => {
    const id = await createPracticeVsAiStore("user-2").createDebate(round)
    await createPracticeVsAiStore("user-1").setOutcome(id, verdict, { feedbackStyle: "socratic" })
    const read = await createPracticeVsAiStore("user-2").getDebate(id)
    expect(read?.outcome).toBeUndefined()
    expect(read?.judgeFeedbackStyle).toBeUndefined()
  })

  it("drops a malformed stored style instead of failing the round", async () => {
    await db.insert(practiceVsAiDebates).values({
      userId: "user-1",
      email: round.email,
      botName: round.botName,
      topic: round.topic,
      outcome: "",
      result: "pending",
      data: JSON.stringify({ ...round, judgeFeedbackStyle: 7 }),
    })
    const [read] = await createPracticeVsAiStore("user-1").listDebates!("debater@example.com")
    expect(read.topic).toBe("Tariffs")
    expect(read.judgeFeedbackStyle).toBeUndefined()
  })
})

describe("createPracticeVsAiStore saved round plan", () => {
  let db: Awaited<ReturnType<typeof freshDb>>

  beforeEach(async () => {
    db = await freshDb()
    getDBFromContext.mockResolvedValue(db)
  })

  const plan = {
    evidence: "without" as const,
    userArguments: [{ title: "Uninsured Deaths advantage", kind: "advantage" }],
    botArguments: [{ title: "Spending DA" }],
  }
  const round = {
    email: "debater@example.com",
    botName: "Yoda",
    botLevel: "Legends",
    topic: "Tariffs",
    stance: "for",
    history: [],
    phaseTimings: [],
    plan,
    createdAt: 100,
  }

  it("keeps the plan in the round's data and reads it back, through later writes too", async () => {
    const store = createPracticeVsAiStore("user-1")
    const id = await store.createDebate(round)
    await store.appendMessage!(id, { sender: "Bot", text: "Opening." })
    await store.setOutcome!(id, "User conceded")

    expect((await store.getDebate(id))?.plan).toEqual(plan)
    const [row] = await db.select().from(practiceVsAiDebates).where(eq(practiceVsAiDebates.id, Number(id)))
    expect(JSON.parse(row.data).plan).toEqual(plan)
    expect((await store.listDebates!("debater@example.com"))[0].plan).toEqual(plan)
  })

  it("drops a malformed stored plan instead of failing the round", async () => {
    await db.insert(practiceVsAiDebates).values({
      userId: "user-1",
      email: round.email,
      botName: round.botName,
      topic: round.topic,
      outcome: "",
      result: "pending",
      data: JSON.stringify({ ...round, plan: { evidence: "maybe" } }),
    })
    const [read] = await createPracticeVsAiStore("user-1").listDebates!("debater@example.com")
    expect(read.topic).toBe("Tariffs")
    expect(read.plan).toBeUndefined()
  })
})
