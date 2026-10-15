/**
 * @fileoverview The server side of judge ballots: the signed-in email must
 * match the ballot's Tabroom account email, every accepted ballot is stored,
 * and a Tabroom-bound one is forwarded with the judge's own token — never a
 * stored credential. Tabroom itself is mocked; nothing here reaches the network.
 */
import { describe, expect, it, vi } from "vitest"
import type { StoredJudgeBallot } from "@debate/tournaments/ballots"
import { createTabroomForward, submitJudgeBallot, type TabroomForward } from "../judge-ballots"

const user = { id: "u1", email: "Judge@Example.com" }
const raw = {
  tournId: 38436,
  event: "VCX",
  round: "3",
  aff: "Lexington AB",
  neg: "Bronx CD",
  winner: "aff",
  tabroomEmail: "judge@example.com",
  destination: "local",
}

function setup(forward: TabroomForward = vi.fn(async () => ({ status: "sent" as const, detail: null }))) {
  const saved: Array<{ ballot: StoredJudgeBallot; userId: string }> = []
  const store = { insert: vi.fn(async (ballot: StoredJudgeBallot, userId: string) => void saved.push({ ballot, userId })) }
  const run = (over: Partial<Parameters<typeof submitJudgeBallot>[0]> = {}) =>
    submitJudgeBallot({ user, raw, store, forward, now: () => new Date("2026-10-12T00:00:00Z"), newId: () => "b1", ...over })
  return { saved, store, forward, run }
}

describe("submitJudgeBallot", () => {
  it("needs a signed-in user", async () => {
    const { run, saved } = setup()
    expect((await run({ user: null })).status).toBe(401)
    expect(saved).toHaveLength(0)
  })

  it("turns away a ballot whose Tabroom email is not the signed-in email", async () => {
    const { run, saved } = setup()
    const result = await run({ raw: { ...raw, tabroomEmail: "someone-else@example.com" } })
    expect(result.status).toBe(403)
    expect(String(result.body.error)).toContain("does not match")
    expect(saved).toHaveLength(0)
  })

  it("returns validation errors for an incomplete ballot", async () => {
    const { run } = setup()
    const result = await run({ raw: { ...raw, winner: undefined } })
    expect(result.status).toBe(400)
    expect(result.body.errors).toEqual(['winner must be "aff" or "neg".'])
  })

  it("stores a local ballot without contacting Tabroom", async () => {
    const { run, saved, forward } = setup()
    const result = await run()
    expect(result.status).toBe(201)
    expect(forward).not.toHaveBeenCalled()
    expect(saved).toEqual([
      {
        userId: "u1",
        ballot: expect.objectContaining({
          id: "b1",
          judgeEmail: "judge@example.com",
          winner: "aff",
          speakerPoints: [],
          tabroomStatus: null,
          createdAt: "2026-10-12T00:00:00.000Z",
        }),
      },
    ])
  })

  it("needs the judge's token to send to Tabroom", async () => {
    const { run, saved } = setup()
    const result = await run({ raw: { ...raw, destination: "tabroom" }, tabroomToken: "  " })
    expect(result.status).toBe(400)
    expect(saved).toHaveLength(0)
  })

  it("forwards to Tabroom with the judge's token and keeps a copy", async () => {
    const { run, saved, forward } = setup()
    const result = await run({ raw: { ...raw, destination: "tabroom" }, tabroomToken: "judge-token" })
    expect(result.status).toBe(201)
    expect(forward).toHaveBeenCalledWith(expect.objectContaining({ destination: "tabroom" }), "judge-token")
    expect(saved[0].ballot.tabroomStatus).toBe("sent")
  })

  it("keeps the ballot when Tabroom refuses it", async () => {
    const { run, saved } = setup(async () => ({ status: "failed", detail: "Tabroom answered 403" }))
    const result = await run({ raw: { ...raw, destination: "tabroom" }, tabroomToken: "t" })
    expect(result.status).toBe(201)
    expect(saved[0].ballot).toMatchObject({ tabroomStatus: "failed", tabroomDetail: "Tabroom answered 403" })
  })
})

describe("createTabroomForward", () => {
  const ballot = { ...raw, winner: "aff" as const, destination: "tabroom" as const }

  it("reports unavailable when no endpoint is configured", async () => {
    const fetchImpl = vi.fn()
    expect(await createTabroomForward(null, fetchImpl as never)(ballot, "t")).toEqual({
      status: "unavailable",
      detail: expect.any(String),
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("posts the ballot with the judge's bearer token", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }))
    const result = await createTabroomForward("https://tabroom.example/ballots", fetchImpl as never)(ballot, "judge-token")
    expect(result).toEqual({ status: "sent", detail: null })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://tabroom.example/ballots")
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer judge-token")
    expect(JSON.parse(String(init.body))).toMatchObject({ aff: "Lexington AB", winner: "aff" })
  })

  it("passes on Tabroom's reason for a refusal", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ detail: "Not your ballot" }, { status: 403 }))
    expect(await createTabroomForward("https://tabroom.example/b", fetchImpl as never)(ballot, "t")).toEqual({
      status: "failed",
      detail: "Tabroom answered 403: Not your ballot",
    })
  })

  it("reports an unreachable Tabroom", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    expect(await createTabroomForward("https://tabroom.example/b", fetchImpl as never)(ballot, "t")).toEqual({
      status: "failed",
      detail: "Tabroom could not be reached.",
    })
  })
})
