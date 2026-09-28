/**
 * @fileoverview Plan tiers end to end against a real in-memory SQLite
 * database built from the actual migrations: tier resolution, daily usage
 * metering, and the Research Team roster / assignment limits.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { beforeEach, describe, expect, it } from "vitest"
import * as schema from "../../database/schema"
import { describeLimits, limitsFor, tierForPlan, TIER_LIMITS } from "../limits"
import { addStudent, assignmentsForStudent, createAssignment, listStudents, requireTeamTier, TeamError } from "../team"
import { consumeDailyUsage, getDailyUsage, getUserTier } from "../usage"

const migration = (file: string) => readFileSync(join(import.meta.dirname, "../../../drizzle", file), "utf8")

async function freshDb() {
  const client = createClient({ url: ":memory:" })
  await client.execute(`CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE)`)
  await client.execute(`INSERT INTO user VALUES ('coach', 'Coach Kim', 'coach@example.com'), ('pro', 'Pro', 'pro@example.com')`)
  for (const file of ["0052_stripe_subscriptions.sql", "0055_plan_tiers_and_team.sql"]) {
    for (const statement of migration(file).split("--> statement-breakpoint")) await client.execute(statement)
  }
  await client.execute(
    `INSERT INTO stripe_subscriptions (subscription_id, user_id, plan, status) VALUES
     ('sub_team', 'coach', 'research-team', 'active'), ('sub_pro', 'pro', 'pro-vip', 'active')`,
  )
  return drizzle(client, { schema })
}

describe("tier limits", () => {
  it("maps plans to tiers, keeping paying subscribers on an unlisted price at Pro", () => {
    expect(tierForPlan(null)).toBe("free")
    expect(tierForPlan("research-team")).toBe("research-team")
    expect(tierForPlan("unknown")).toBe("pro-vip")
  })

  it("raises every limit from free to Pro, and only Research Team gets a 10-student roster", () => {
    const free = TIER_LIMITS.free
    const pro = TIER_LIMITS["pro-vip"]
    expect(pro.llmRequestsPerDay!).toBeGreaterThan(free.llmRequestsPerDay!)
    expect(pro.cardSearchesPerDay!).toBeGreaterThan(free.cardSearchesPerDay!)
    expect(pro.cardSearchResults).toBeGreaterThan(free.cardSearchResults)
    expect(pro.teamStudents).toBe(0)
    expect(TIER_LIMITS["research-team"].teamStudents).toBe(10)
  })

  it("describes limits for the plan picker", () => {
    expect(describeLimits(limitsFor("pro-vip"))).toContain("200 AI requests / day")
    expect(describeLimits(limitsFor("research-team"))).toContain("Unlimited card searches")
    expect(describeLimits(limitsFor("research-team"))).toContain("Team roster of up to 10 students")
  })
})

describe("usage metering", () => {
  let db: Awaited<ReturnType<typeof freshDb>>
  beforeEach(async () => {
    db = await freshDb()
  })

  it("resolves each account's tier", async () => {
    expect(await getUserTier(db, "coach")).toBe("research-team")
    expect(await getUserTier(db, "pro")).toBe("pro-vip")
    expect(await getUserTier(db, "nobody")).toBe("free")
    expect(await getUserTier(db, null)).toBe("free")
  })

  it("refuses the use past the daily limit without counting it, and resets the next day", async () => {
    const limits = { ...limitsFor("free"), llmRequestsPerDay: 2 }
    const day1 = new Date("2026-09-26T12:00:00Z")
    expect((await consumeDailyUsage(db, "u", "llmRequests", limits, day1)).allowed).toBe(true)
    expect((await consumeDailyUsage(db, "u", "llmRequests", limits, day1)).allowed).toBe(true)
    expect(await consumeDailyUsage(db, "u", "llmRequests", limits, day1)).toEqual({ allowed: false, used: 2, limit: 2 })
    expect((await getDailyUsage(db, "u", day1)).llmRequests).toBe(2)
    expect((await consumeDailyUsage(db, "u", "llmRequests", limits, new Date("2026-09-27T00:01:00Z"))).allowed).toBe(true)
  })

  it("counts but never refuses an unlimited metric", async () => {
    const limits = limitsFor("research-team")
    for (let i = 0; i < 3; i++) await consumeDailyUsage(db, "coach", "cardSearches", limits)
    expect((await getDailyUsage(db, "coach")).cardSearches).toBe(3)
  })
})

describe("research team", () => {
  let db: Awaited<ReturnType<typeof freshDb>>
  beforeEach(async () => {
    db = await freshDb()
  })

  it("refuses team tools on the Pro plan", async () => {
    await expect(requireTeamTier(db, "pro")).rejects.toBeInstanceOf(TeamError)
  })

  it("caps the roster at 10 students", async () => {
    for (let i = 0; i < 10; i++) await addStudent(db, "coach", "research-team", `Student${i}@Example.com`)
    expect(await listStudents(db, "coach")).toHaveLength(10)
    expect((await listStudents(db, "coach"))[0]).toBe("student0@example.com")
    await expect(addStudent(db, "coach", "research-team", "one-more@example.com")).rejects.toMatchObject({ status: 409 })
  })

  it("assigns lesson plans and drills to all students or to chosen ones", async () => {
    await addStudent(db, "coach", "research-team", "a@example.com")
    await addStudent(db, "coach", "research-team", "b@example.com")
    await createAssignment(db, "coach", "research-team", { kind: "lesson-plan", title: "Kritik basics" })
    await createAssignment(db, "coach", "research-team", {
      kind: "practice-drill",
      title: "Speed drill",
      studentEmails: ["B@example.com"],
      dueAt: "2026-10-01",
    })
    await expect(
      createAssignment(db, "coach", "research-team", { kind: "practice-drill", title: "x", studentEmails: ["c@example.com"] }),
    ).rejects.toMatchObject({ status: 400 })

    expect((await assignmentsForStudent(db, "a@example.com")).map((a) => a.title)).toEqual(["Kritik basics"])
    const forB = await assignmentsForStudent(db, "b@example.com")
    expect(forB.map((a) => a.title).sort()).toEqual(["Kritik basics", "Speed drill"])
    expect(forB[0].coachName).toBe("Coach Kim")
  })

  it("enforces the plan's assignment limit", async () => {
    await addStudent(db, "coach", "research-team", "a@example.com")
    const max = limitsFor("research-team").lessonPlans
    for (let i = 0; i < max; i++) {
      await createAssignment(db, "coach", "research-team", { kind: "lesson-plan", title: `Lesson ${i}` })
    }
    await expect(
      createAssignment(db, "coach", "research-team", { kind: "lesson-plan", title: "Too many" }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it("hides assignments once the coach's plan lapses", async () => {
    await addStudent(db, "coach", "research-team", "a@example.com")
    await createAssignment(db, "coach", "research-team", { kind: "lesson-plan", title: "Lesson" })
    await db.$client.execute(`UPDATE stripe_subscriptions SET status = 'canceled' WHERE subscription_id = 'sub_team'`)
    expect(await assignmentsForStudent(db, "a@example.com")).toEqual([])
  })
})
