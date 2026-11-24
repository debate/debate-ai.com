/**
 * @fileoverview The D1/libSQL half of `lib/tournaments/judge-ballots.ts`
 * against a real SQLite database — the table created on first use, ballots
 * stored and listed per judge, the two-hour window for changing a winner, the
 * hosted-Tabroom person lookup — plus the forwarding endpoint's configuration
 * and the account check the Ballot tab reads.
 */

import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { sql } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { StoredJudgeBallot } from "@debate-ai/tournaments/ballots"

let workerEnv: Record<string, unknown> | undefined
vi.mock("@/lib/database/context", () => ({
  getCloudflareContext: () => (workerEnv ? { env: workerEnv } : undefined),
  getDBFromContext: async () => {
    throw new Error("not used")
  },
}))

const ballots = await import("../judge-ballots")

// One database for the file: the module creates its table once per isolate.
const db = drizzle(createClient({ url: ":memory:" }))
const store = ballots.createD1BallotStore(db as never)

const ballot = (overrides: Partial<StoredJudgeBallot> = {}): StoredJudgeBallot => ({
  id: crypto.randomUUID(),
  tournId: 101,
  event: "VPF",
  round: "Round 3",
  aff: "Strake AB",
  neg: "Lake Highland CD",
  winner: "aff",
  speakerPoints: [{ speaker: "A", side: "aff", points: 29.1 } as never],
  tabroomEmail: "judge@example.com",
  destination: "local",
  judgeEmail: "judge@example.com",
  tabroomStatus: null,
  tabroomDetail: null,
  createdAt: new Date().toISOString(),
  ...overrides,
})

afterEach(() => {
  workerEnv = undefined
  delete process.env.TABROOM_BALLOT_URL
  vi.useRealTimers()
})

describe("createD1BallotStore", () => {
  it("creates the table on first use and round-trips every field", async () => {
    const full = ballot({
      tournamentName: "TOC",
      room: "B-12",
      lowPointWin: true,
      rfd: "Cleaner extension of the turn.",
      destination: "tabroom",
      tabroomStatus: "failed",
      tabroomDetail: "Tabroom answered 500",
    })
    await store.insert(full, "user-full")
    expect(await store.list("user-full")).toEqual([full])
  })

  it("omits optional fields that were not set, and reads lowPointWin only when true", async () => {
    const bare = ballot()
    await store.insert(bare, "user-bare")
    const [read] = await store.list("user-bare")
    expect(read).toEqual(bare)
    expect(read).not.toHaveProperty("room")
    expect(read).not.toHaveProperty("rfd")
    expect(read).not.toHaveProperty("lowPointWin")
    expect(read).not.toHaveProperty("tournamentName")
  })

  it("lists only the judge's own ballots, newest first, optionally by tournament", async () => {
    await store.insert(ballot({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }), "user-list")
    await store.insert(ballot({ id: "new", createdAt: "2026-02-01T00:00:00.000Z" }), "user-list")
    await store.insert(ballot({ id: "other-tourn", tournId: 202, createdAt: "2026-03-01T00:00:00.000Z" }), "user-list")
    await store.insert(ballot({ id: "someone-else" }), "user-other")
    expect((await store.list("user-list")).map((b) => b.id)).toEqual(["other-tourn", "new", "old"])
    expect((await store.list("user-list", 101)).map((b) => b.id)).toEqual(["new", "old"])
    expect(await store.list("nobody")).toEqual([])
  })

  it("reads corrupt speaker points as none", async () => {
    await store.insert(ballot({ id: "corrupt" }), "user-corrupt")
    await db.run(sql`UPDATE judge_ballot SET speaker_points = '{oops' WHERE id = 'corrupt'`)
    expect((await store.list("user-corrupt"))[0].speakerPoints).toEqual([])
    await db.run(sql`UPDATE judge_ballot SET speaker_points = '{"not":"a list"}' WHERE id = 'corrupt'`)
    expect((await store.list("user-corrupt"))[0].speakerPoints).toEqual([])
  })

  it("changes the winner within two hours, for the owner only", async () => {
    await store.insert(ballot({ id: "fresh", winner: "aff" }), "user-win")
    expect(await store.updateWinner("fresh", "user-intruder", "neg")).toBeNull()
    const updated = await store.updateWinner("fresh", "user-win", "neg")
    expect(updated?.winner).toBe("neg")
    expect(await store.updateWinner("missing", "user-win", "neg")).toBeNull()
  })

  it("refuses to change a winner after two hours", async () => {
    const created = new Date(Date.now() - 2 * 60 * 60 * 1000 - 1000).toISOString()
    await store.insert(ballot({ id: "stale", winner: "aff", createdAt: created }), "user-stale")
    expect(await store.updateWinner("stale", "user-stale", "neg")).toBeNull()
    expect((await store.list("user-stale"))[0].winner).toBe("aff")
  })

  it("finds no Tabroom person without the hosted tables, then finds one by normalized email", async () => {
    expect(await store.findTabroomPerson("judge@example.com")).toBeNull()
    await db.run(sql`CREATE TABLE person (id INTEGER PRIMARY KEY, first TEXT, last TEXT, email TEXT)`)
    await db.run(sql`INSERT INTO person VALUES (7, 'Pat', 'Judge', 'judge@example.com'), (8, NULL, NULL, 'anon@example.com')`)
    expect(await store.findTabroomPerson("  Judge@Example.com ")).toEqual({ id: 7, name: "Pat Judge", email: "judge@example.com" })
    expect(await store.findTabroomPerson("anon@example.com")).toEqual({ id: 8, name: "anon@example.com", email: "anon@example.com" })
    expect(await store.findTabroomPerson("nobody@example.com")).toBeNull()
  })

  it("rethrows a lookup failure that is not a missing table", async () => {
    const broken = ballots.createD1BallotStore({ all: async () => { throw new Error("D1 overloaded") } } as never)
    await expect(broken.findTabroomPerson("a@b.co")).rejects.toThrow("D1 overloaded")
  })
})

describe("rowToBallot", () => {
  it("coerces a string tourn id and a null Tabroom status", () => {
    const b = ballots.rowToBallot({
      id: "x", judge_email: "j@x.co", tabroom_email: "j@x.co", tourn_id: "42" as never, tournament_name: null, event: "LD",
      round: "R1", room: null, aff: "A", neg: "B", winner: "neg", low_point_win: 0, speaker_points: "[]", rfd: null,
      destination: "local", tabroom_status: undefined as never, tabroom_detail: undefined as never, created_at: "2026-01-01",
    })
    expect(b.tournId).toBe(42)
    expect(b.tabroomStatus).toBeNull()
    expect(b.tabroomDetail).toBeNull()
  })
})

describe("tabroomBallotUrl", () => {
  it("is null when unset, malformed or not https", () => {
    expect(ballots.tabroomBallotUrl()).toBeNull()
    process.env.TABROOM_BALLOT_URL = "not a url"
    expect(ballots.tabroomBallotUrl()).toBeNull()
    process.env.TABROOM_BALLOT_URL = "http://tabroom.example/ballot"
    expect(ballots.tabroomBallotUrl()).toBeNull()
  })

  it("prefers the Worker binding over process.env", () => {
    process.env.TABROOM_BALLOT_URL = "https://env.example/ballot"
    expect(ballots.tabroomBallotUrl()).toBe("https://env.example/ballot")
    workerEnv = { TABROOM_BALLOT_URL: "https://worker.example/ballot" }
    expect(ballots.tabroomBallotUrl()).toBe("https://worker.example/ballot")
  })
})

describe("createTabroomForward", () => {
  it("reports a timeout distinctly from an unreachable host", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" })
    const forward = ballots.createTabroomForward("https://t.example", (async () => { throw timeout }) as never)
    expect(await forward({} as never, "tok")).toEqual({ status: "failed", detail: "Tabroom did not answer in time." })
  })

  it("reports a refusal with no readable body, and clips a long reason", async () => {
    const plain = ballots.createTabroomForward("https://t.example", (async () => new Response("<html>", { status: 502 })) as never)
    expect(await plain({} as never, "tok")).toEqual({ status: "failed", detail: "Tabroom answered 502" })

    const long = ballots.createTabroomForward("https://t.example", (async () => Response.json({ error: "e".repeat(500) }, { status: 422 })) as never)
    const result = await long({} as never, "tok")
    expect(result.detail).toBe(`Tabroom answered 422: ${"e".repeat(300)}`)
  })
})

describe("checkBallotAccount", () => {
  it("reports signed out without a lookup", async () => {
    const findTabroomPerson = vi.fn()
    expect(await ballots.checkBallotAccount(null, { findTabroomPerson }, true)).toEqual({ signedIn: false, email: null, tabroomPerson: null, tabroomForwarding: true })
    expect(await ballots.checkBallotAccount({ id: "u", email: "" }, { findTabroomPerson }, false)).toMatchObject({ signedIn: false })
    expect(findTabroomPerson).not.toHaveBeenCalled()
  })

  it("normalizes the email and attaches the Tabroom person", async () => {
    const person = { id: 1, name: "Pat", email: "pat@example.com" }
    const check = await ballots.checkBallotAccount({ id: "u", email: " Pat@Example.com " }, { findTabroomPerson: async () => person }, false)
    expect(check).toEqual({ signedIn: true, email: "pat@example.com", tabroomPerson: person, tabroomForwarding: false })
  })
})
