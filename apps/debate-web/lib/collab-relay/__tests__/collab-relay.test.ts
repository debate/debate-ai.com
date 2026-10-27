/**
 * @fileoverview The collaboration relay (`lib/collab-relay`) against a real
 * SQLite database: rooms opened by a signed-in account, joined with a guest
 * pass, their update log, snapshot compaction and live stream, and the card
 * mailboxes behind the Send / Receive pills.
 */

import { beforeEach, describe, expect, it } from "vitest"

import * as schema from "@/lib/database/schema"
import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql"
import { ACCOUNT_BEARER, handleCollabRelay, type RelayContext } from "@/lib/collab-relay/handler"
import { PART_CHARS } from "@/lib/collab-relay/store"

type Db = Awaited<ReturnType<typeof freshSchemaDb>>
let db: Db

const users = {
  ada: { id: "ada", email: "ada@example.com", name: "Ada" },
  bo: { id: "bo", email: "bo@example.com", name: "Bo" },
}

function ctx(user: RelayContext["user"], extra: Partial<RelayContext> = {}): RelayContext {
  return { db: db as never, user, ...extra }
}

function call(user: RelayContext["user"], method: string, path: string, init: RequestInit = {}, extra: Partial<RelayContext> = {}) {
  const url = new URL(`https://debate-ai.test/api/collab-relay/${path}`)
  const segments = url.pathname.replace("/api/collab-relay/", "").split("/").filter(Boolean)
  const headers = new Headers(init.headers)
  if (!headers.has("authorization")) headers.set("authorization", `Bearer ${user ? ACCOUNT_BEARER : ""}`)
  return handleCollabRelay(new Request(url, { ...init, method, headers }), segments, ctx(user, extra))
}

async function body<T = Record<string, any>>(res: Response): Promise<T> {
  return (await res.json()) as T
}

const bytes = (...values: number[]) => new Uint8Array(values)

async function openRoom(user = users.ada) {
  const res = await call(user, "POST", "rooms")
  expect(res.status).toBe(200)
  return body<{ roomId: string; guestPass: string }>(res)
}

async function post(user: RelayContext["user"], roomId: string, data: Uint8Array, headers?: Record<string, string>) {
  return call(user, "POST", `rooms/${roomId}/updates`, { body: data as BodyInit, headers })
}

/** Reads an SSE response to the end and returns its frames. */
async function readFrames(res: Response): Promise<Array<{ event: string; data: string }>> {
  const text = await res.text()
  return text
    .split("\n\n")
    .filter((frame) => frame.trim() && !frame.startsWith(":"))
    .map((frame) => {
      let event = ""
      const data: string[] = []
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim()
        else if (line.startsWith("data:")) data.push(line.slice(5).trim())
      }
      return { event, data: data.join("\n") }
    })
}

describe("collab relay", () => {
  beforeEach(async () => {
    db = await freshSchemaDb()
    const now = new Date()
    await db.insert(schema.user).values(Object.values(users).map((u) => ({ ...u, createdAt: now, updatedAt: now })))
  })

  it("reports the signed-in account, and 401s when signed out", async () => {
    expect(await body(await call(users.ada, "GET", "account"))).toEqual({
      signedIn: true,
      userId: "ada",
      email: "ada@example.com",
      name: "Ada",
    })
    expect((await call(null, "GET", "account")).status).toBe(401)
  })

  it("only lets a signed-in account open a room", async () => {
    const res = await call(null, "POST", "rooms")
    expect(res.status).toBe(401)
    expect(await body(res)).toHaveProperty("detail")
    const room = await openRoom()
    expect(room.roomId).toMatch(/^[0-9a-f]{32}$/)
    expect(room.guestPass).toMatch(/^gp1\./)
  })

  it("numbers updates in order and pages them back", async () => {
    const { roomId } = await openRoom()
    expect(await body(await post(users.ada, roomId, bytes(1, 2, 3)))).toEqual({ seq: 1 })
    expect(await body(await post(users.bo, roomId, bytes(4)))).toEqual({ seq: 2 })

    const page = await body(await call(users.bo, "GET", `rooms/${roomId}/updates?after=0`))
    expect(page).toMatchObject({ snapshotUnchanged: false, snapCovers: 0, lastSeq: 2, more: false })
    expect(page.updates.map((u: { seq: number; blob: string }) => [u.seq, atob(u.blob).length])).toEqual([
      [1, 3],
      [2, 1],
    ])
    expect((await body(await call(users.bo, "GET", `rooms/${roomId}/updates?after=2`))).updates).toEqual([])
  })

  it("stores an update bigger than one row in parts and returns it whole", async () => {
    const { roomId } = await openRoom()
    const big = new Uint8Array(Math.ceil((PART_CHARS * 2.5 * 3) / 4)).map((_, i) => i % 251)
    expect(await body(await post(users.ada, roomId, big))).toEqual({ seq: 1 })
    expect(await body(await post(users.ada, roomId, bytes(9)))).toEqual({ seq: 2 })
    const rows = await db.select().from(schema.collabRelayBlobs)
    expect(rows.filter((r) => r.seq === 1)).toHaveLength(3)

    const page = await body(await call(users.ada, "GET", `rooms/${roomId}/updates?after=0`))
    const first = Uint8Array.from(atob(page.updates[0].blob), (c) => c.charCodeAt(0))
    expect(first.length).toBe(big.length)
    expect(first[1000]).toBe(big[1000])
    expect(page.updates[1].seq).toBe(2)
  })

  it("compacts the log into a snapshot and skips it for a caller that has it", async () => {
    const { roomId } = await openRoom()
    for (let i = 0; i < 3; i++) await post(users.ada, roomId, bytes(i))
    const snap = await call(users.ada, "POST", `rooms/${roomId}/snapshot`, {
      body: JSON.stringify({ blob: btoa("snapshot"), coversThroughSeq: 2 }),
      headers: { "content-type": "application/json" },
    })
    expect(snap.status).toBe(200)
    expect(await body(await post(users.ada, roomId, bytes(7)))).toEqual({ seq: 4 })

    const fresh = await body(await call(users.bo, "GET", `rooms/${roomId}/updates?after=0`))
    expect(fresh.snapshot).toEqual({ blob: btoa("snapshot"), coversThroughSeq: 2 })
    expect(fresh.updates.map((u: { seq: number }) => u.seq)).toEqual([3, 4])
    expect(fresh.snapCovers).toBe(2)

    const cached = await body(await call(users.bo, "GET", `rooms/${roomId}/updates?after=0&haveSnap=2`))
    expect(cached.snapshot).toBeUndefined()
    expect(cached.snapshotUnchanged).toBe(true)
    expect(cached.updates.map((u: { seq: number }) => u.seq)).toEqual([3, 4])

    // A snapshot past the log is refused; an older one is a no-op.
    const ahead = await call(users.ada, "POST", `rooms/${roomId}/snapshot`, {
      body: JSON.stringify({ blob: "eA==", coversThroughSeq: 99 }),
    })
    expect(ahead.status).toBe(400)
    const older = await call(users.ada, "POST", `rooms/${roomId}/snapshot`, {
      body: JSON.stringify({ blob: "eA==", coversThroughSeq: 1 }),
    })
    expect(older.status).toBe(200)
    expect((await body(await call(users.bo, "GET", `rooms/${roomId}/updates?after=0`))).snapshot.blob).toBe(btoa("snapshot"))
  })

  it("lets a signed-out invitee in with the guest pass, and nobody else", async () => {
    const { roomId, guestPass } = await openRoom()
    await post(users.ada, roomId, bytes(1))
    const guest = { authorization: `Bearer ${guestPass}` }
    expect((await call(null, "GET", `rooms/${roomId}/updates?after=0`, { headers: guest })).status).toBe(200)
    expect((await post(null, roomId, bytes(2), guest)).status).toBe(200)
    expect((await call(null, "GET", `rooms/${roomId}/updates?after=0`, { headers: { authorization: "Bearer nope" } })).status).toBe(401)
    // Guests can't open rooms or manage this one.
    expect((await call(null, "POST", "rooms", { headers: guest })).status).toBe(401)
    expect((await call(null, "DELETE", `rooms/${roomId}`, { headers: guest })).status).toBe(401)
  })

  it("leaves ending a session and its guest pass to the owner", async () => {
    const { roomId, guestPass } = await openRoom()
    expect((await call(users.bo, "GET", `rooms/${roomId}/guest-pass`)).status).toBe(403)
    expect(await body(await call(users.ada, "GET", `rooms/${roomId}/guest-pass`))).toEqual({ guestPass })
    expect((await call(users.bo, "DELETE", `rooms/${roomId}`)).status).toBe(403)
    expect((await call(users.ada, "DELETE", `rooms/${roomId}`)).status).toBe(200)
    expect((await call(users.bo, "GET", `rooms/${roomId}/updates?after=0`)).status).toBe(410)
    expect((await call(users.bo, "GET", `rooms/${"0".repeat(32)}/updates?after=0`)).status).toBe(404)
  })

  it("streams hello, new updates and other participants' presence", async () => {
    const { roomId } = await openRoom()
    await post(users.ada, roomId, bytes(1))
    let ticks = 0
    const sleep = async () => {
      ticks++
      if (ticks === 1) {
        await post(users.ada, roomId, bytes(5, 6))
        await call(users.ada, "POST", `rooms/${roomId}/presence?from=ada-sid`, { body: bytes(8) })
        await call(users.bo, "POST", `rooms/${roomId}/presence?from=bo-sid`, { body: bytes(9) })
      }
      if (ticks === 3) await call(users.ada, "DELETE", `rooms/${roomId}`)
    }
    const res = await call(users.bo, "GET", `rooms/${roomId}/stream?sid=bo-sid`, {}, { sleep, pollMs: 0 })
    expect(res.headers.get("content-type")).toBe("text/event-stream")
    const frames = await readFrames(res)
    expect(frames[0]).toEqual({ event: "hello", data: JSON.stringify({ lastSeq: 1 }) })
    const data = frames.slice(1).map((f) => JSON.parse(f.data))
    expect(data).toEqual([
      { t: "u", seq: 2, blob: btoa(String.fromCharCode(5, 6)) },
      { t: "p", blob: btoa(String.fromCharCode(8)) },
      { t: "end" },
    ])
  })

  it("closes a quiet stream after its time is up", async () => {
    const { roomId } = await openRoom()
    let clock = 0
    const res = await call(users.ada, "GET", `rooms/${roomId}/stream`, {}, {
      now: () => clock,
      sleep: async () => {
        clock += 30_000
      },
      streamMs: 60_000,
    })
    const text = await res.text()
    expect(text).toContain("event: hello")
    expect(text).toContain(": hb")
  })

  describe("card mailboxes", () => {
    const sealed = (recipientCode: string) =>
      JSON.stringify({ v: 1, recipientCode, sentAt: 1, epk: "e", iv: "i", ct: "c", tag: "t" })

    it("needs a signed-in account both ways", async () => {
      expect((await call(null, "POST", "messages", { body: sealed("mailbox-ada-1") })).status).toBe(401)
      expect((await call(null, "GET", "messages?recipient=mailbox-ada-1")).status).toBe(401)
      expect((await call(null, "GET", "stream?recipient=mailbox-ada-1")).status).toBe(401)
    })

    it("delivers a sealed card to the mailbox's account until it is cleared", async () => {
      // Ada's browser claims its mailbox by reading it first.
      expect(await body(await call(users.ada, "GET", "messages?recipient=mailbox-ada-1"))).toEqual({ messages: [] })
      const sent = await body(await call(users.bo, "POST", "messages", { body: sealed("mailbox-ada-1") }))
      expect(sent.msgId).toBeTruthy()

      const res = await call(users.ada, "GET", "messages?recipient=mailbox-ada-1")
      const etag = res.headers.get("etag")!
      expect((await body(res)).messages).toEqual([
        { v: 1, sentAt: 1, epk: "e", iv: "i", ct: "c", tag: "t", msgId: sent.msgId },
      ])
      const unchanged = await call(users.ada, "GET", "messages?recipient=mailbox-ada-1", { headers: { "if-none-match": etag } })
      expect(unchanged.status).toBe(304)

      // Someone else can neither read the mailbox nor clear its cards.
      expect((await call(users.bo, "GET", "messages?recipient=mailbox-ada-1")).status).toBe(403)
      await call(users.bo, "DELETE", `messages/${sent.msgId}`)
      expect((await body(await call(users.ada, "GET", "messages?recipient=mailbox-ada-1"))).messages).toHaveLength(1)

      await call(users.ada, "DELETE", `messages/${sent.msgId}`)
      expect((await body(await call(users.ada, "GET", "messages?recipient=mailbox-ada-1"))).messages).toEqual([])
    })

    it("refuses a card with no recipient or missing seal fields", async () => {
      expect((await call(users.bo, "POST", "messages", { body: JSON.stringify({ recipientCode: "x" }) })).status).toBe(400)
      expect((await call(users.bo, "POST", "messages", { body: JSON.stringify({ recipientCode: "mailbox-ada-1", epk: "e" }) })).status).toBe(400)
    })

    it("streams cards that arrive after the stream opens", async () => {
      await call(users.bo, "POST", "messages", { body: sealed("mailbox-ada-1") })
      let ticks = 0
      const res = await call(users.ada, "GET", "stream?recipient=mailbox-ada-1", {}, {
        pollMs: 0,
        streamMs: 1,
        now: () => (ticks > 1 ? 10 : 0),
        sleep: async () => {
          ticks++
          if (ticks === 1) await call(users.bo, "POST", "messages", { body: sealed("mailbox-ada-1") })
        },
      })
      const frames = await readFrames(res)
      // Only the card sent after connecting — the editor polls for the backlog itself.
      expect(frames).toHaveLength(1)
      expect(JSON.parse(frames[0].data)).toMatchObject({ ct: "c", msgId: expect.any(String) })
    })
  })
})
