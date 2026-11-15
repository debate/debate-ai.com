/**
 * @fileoverview `/api/live-rounds` against a real in-memory SQLite database
 * and a fake R2 bucket: switching a round's stream on, who may broadcast,
 * segments numbered in arrival order, the public library listing, private
 * rounds answering only their invitees, and replays kept after switching off.
 */

import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { beforeEach, describe, expect, it, vi } from "vitest"

import * as schema from "@/lib/database/schema"

const db = drizzle(createClient({ url: ":memory:" }), { schema })
const objects = new Map<string, { body: ArrayBuffer; contentType?: string }>()
const bucket = {
  async put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
    objects.set(key, { body: value, contentType: options?.httpMetadata?.contentType })
  },
  async get(key: string) {
    const object = objects.get(key)
    if (!object) return null
    return { body: new Blob([object.body]).stream(), size: object.body.byteLength, httpMetadata: { contentType: object.contentType } }
  },
  async list() {
    return { objects: [], truncated: false }
  },
}
let signedIn: { id: string; email: string } | null = null

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }))
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (signedIn ? { session: { id: "s", userId: signedIn.id }, user: { id: signedIn.id, name: "", email: signedIn.email } } : null),
}))
vi.mock("@/lib/round-recordings/storage", () => ({ getRoundRecordingsBucket: () => bucket }))

const route = await import("@/app/api/live-rounds/route")
const segmentRoute = await import("@/app/api/live-rounds/segment/route")

const req = (path: string, init?: RequestInit) => new Request(`https://debate-ai.com${path}`, init) as never
const as = (id: string, email: string) => (signedIn = { id, email })

const registration = (overrides: Record<string, unknown> = {}) => ({
  slug: "2025-glenbrooks/lynbrook-bz-monta-ey",
  title: "2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY",
  tournamentName: "2025 Glenbrooks",
  roundLevel: "Octos",
  aff: "Lynbrook",
  neg: "Monta Vista",
  debaters: ["a1@x.org", "A2@x.org", "n1@x.org", "n2@x.org"],
  invitees: ["judge@x.org"],
  isPrivate: false,
  enabled: true,
  ...overrides,
})
const ID = "2025-glenbrooks-lynbrook-bz-monta-ey"

const register = (body: unknown) =>
  route.PUT(req("/api/live-rounds", { method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" } }))
const send = (id: string, speech: string, text = "opus", type = "audio/webm;codecs=opus") =>
  route.POST(req(`/api/live-rounds?id=${id}&speech=${speech}&durationMs=5000`, { method: "POST", body: text, headers: { "content-type": type } }))
const detail = async (id: string, after = -1) => route.GET(req(`/api/live-rounds?id=${id}&after=${after}`))
const library = async () => (await (await route.GET(req("/api/live-rounds"))).json()).streams as Array<{ id: string; status: string; onAirSpeech: string | null; segmentCount: number }>

describe("/api/live-rounds", () => {
  beforeEach(() => {
    signedIn = null
  })

  it("needs a signed-in account and a slug to switch a stream on", async () => {
    expect((await register(registration())).status).toBe(401)
    as("owner", "coach@x.org")
    expect((await register(registration({ slug: "" }))).status).toBe(400)
  })

  it("creates the stream for its first caller and lists it while live", async () => {
    as("owner", "coach@x.org")
    const res = await register(registration())
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe(ID)
    const streams = await library()
    expect(streams.map((s) => s.id)).toContain(ID)
    expect(streams.find((s) => s.id === ID)).toMatchObject({ status: "live", onAirSpeech: null, segmentCount: 0 })
  })

  it("lets only the owner and the debaters broadcast, numbering segments in order", async () => {
    as("stranger", "fan@x.org")
    expect((await send(ID, "1AC")).status).toBe(403)
    as("judge", "judge@x.org")
    expect((await send(ID, "1AC")).status).toBe(403)

    as("deb1", "a1@x.org")
    expect(await (await send(ID, "1AC", "one")).json()).toEqual({ seq: 0 })
    expect(await (await send(ID, "1AC", "two")).json()).toEqual({ seq: 1 })
    as("deb2", "a2@x.org") // emails match case-insensitively
    expect(await (await send(ID, "2AC", "three")).json()).toEqual({ seq: 2 })
    expect((await send(ID, "2AC", "x", "video/webm")).status).toBe(415)
    expect((await send(ID, "2AC", "")).status).toBe(400)
    expect((await send("missing-stream", "1AC")).status).toBe(404)

    signedIn = null
    const body = await (await detail(ID)).json()
    expect(body.segments.map((s: { seq: number; speech: string }) => [s.seq, s.speech])).toEqual([[0, "1AC"], [1, "1AC"], [2, "2AC"]])
    expect(body.stream).toMatchObject({ status: "live", onAirSpeech: "2AC", segmentCount: 3, durationMs: 15000 })
    expect((await (await detail(ID, 1)).json()).segments).toHaveLength(1)
  })

  it("serves segments publicly, cached forever", async () => {
    const res = await segmentRoute.GET(req(`/api/live-rounds/segment?id=${ID}&seq=1`))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("two")
    expect(res.headers.get("content-type")).toBe("audio/webm")
    expect(res.headers.get("cache-control")).toContain("immutable")
    expect((await segmentRoute.GET(req(`/api/live-rounds/segment?id=${ID}&seq=9`))).status).toBe(404)
    expect((await segmentRoute.GET(req(`/api/live-rounds/segment?id=${ID}&seq=-1`))).status).toBe(400)
  })

  it("refuses changes from anyone but the owner and debaters", async () => {
    as("stranger", "fan@x.org")
    expect((await register(registration({ title: "Hijacked" }))).status).toBe(403)
    as("deb3", "n1@x.org")
    expect((await register(registration())).status).toBe(200)
  })

  it("keeps the replay after the stream is switched off, and stops taking audio", async () => {
    as("owner", "coach@x.org")
    expect((await register(registration({ enabled: false }))).status).toBe(200)
    as("deb1", "a1@x.org")
    expect((await send(ID, "1NC")).status).toBe(409)
    const listed = (await library()).find((s) => s.id === ID)
    expect(listed).toMatchObject({ status: "ended", segmentCount: 3, onAirSpeech: null })
  })

  it("hides a stream switched off before anyone spoke", async () => {
    as("owner2", "coach2@x.org")
    await register(registration({ slug: "silent/round" }))
    expect((await library()).map((s) => s.id)).toContain("silent-round")
    await register(registration({ slug: "silent/round", enabled: false }))
    expect((await library()).map((s) => s.id)).not.toContain("silent-round")
  })

  it("answers a private round's listeners only, and never lists it", async () => {
    as("owner3", "coach3@x.org")
    await register(registration({ slug: "private/round", isPrivate: true }))
    as("deb1", "a1@x.org")
    expect((await send("private-round", "1AC", "secret")).status).toBe(201)

    expect((await library()).map((s) => s.id)).not.toContain("private-round")
    signedIn = null
    expect((await detail("private-round")).status).toBe(404)
    expect((await segmentRoute.GET(req("/api/live-rounds/segment?id=private-round&seq=0"))).status).toBe(404)
    as("fan", "fan@x.org")
    expect((await detail("private-round")).status).toBe(404)

    as("judge", "JUDGE@x.org")
    expect((await detail("private-round")).status).toBe(200)
    const res = await segmentRoute.GET(req("/api/live-rounds/segment?id=private-round&seq=0"))
    expect(await res.text()).toBe("secret")
    expect(res.headers.get("cache-control")).toBe("private, no-store")
  })
})
