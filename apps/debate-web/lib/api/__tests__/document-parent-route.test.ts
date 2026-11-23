/**
 * @fileoverview `POST /api/doc/documents` and `PUT /api/doc/documents/:id`
 * against a real in-memory SQLite database: a `parentId` that would drop the
 * file out of the sidebar's tree (itself, one of its own sub-folders, a plain
 * file, someone else's or a missing folder) answers 400 and writes nothing;
 * a good move still saves; a field of the wrong type is a 400, not a crash.
 */

import { createClient } from "@libsql/client"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/libsql"
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import * as schema from "@/lib/database/schema"
import { documents, user } from "@/lib/database/schema"
import { applySchema } from "@/lib/database/__tests__/schema-sql"
import { PARENT_ERRORS } from "@debate-ai/reason-docs/lib/reason-docs/doc-parent"

let db: ReturnType<typeof drizzle<typeof schema>>
const session = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => db,
  getCloudflareContext: () => undefined,
}))
vi.mock("@/lib/auth/session", () => ({
  getUserId: async () => session.userId,
  getUserIdOrUnavailable: async () => session.userId,
  getSession: async () => (session.userId ? { user: { id: session.userId, name: "One" } } : null),
}))

const collection = await import("@/app/api/doc/documents/route")
const single = await import("@/app/api/doc/documents/[id]/route")

const send = (method: string, path: string, body: unknown) =>
  new NextRequest(`https://debate-ai.com${path}`, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
const put = (id: number | string, body: unknown) =>
  single.PUT(send("PUT", `/api/doc/documents/${id}`, body), { params: Promise.resolve({ id: String(id) }) })
const post = (body: unknown) => collection.POST(send("POST", "/api/doc/documents", body))
const parentOf = async (id: number) =>
  (await db.select({ parentId: documents.parentId }).from(documents).where(eq(documents.id, id)))[0]?.parentId

beforeEach(async () => {
  const client = createClient({ url: ":memory:" })
  await applySchema(client)
  db = drizzle(client, { schema })
  const now = new Date("2026-01-01T00:00:00Z")
  await db.insert(user).values([
    { id: "u1", name: "One", email: "u1@example.com", createdAt: now, updatedAt: now },
    { id: "u2", name: "Two", email: "u2@example.com", createdAt: now, updatedAt: now },
  ])
  // 1 Aff (folder) ── 2 Contentions (folder) ── 3 C1 (file)
  // 4 Neg (folder)    5 Theirs (u2's folder)
  await db.insert(documents).values([
    { id: 1, title: "Aff", userId: "u1", isFolder: true, parentId: null },
    { id: 2, title: "Contentions", userId: "u1", isFolder: true, parentId: 1 },
    { id: 3, title: "C1", userId: "u1", isFolder: false, parentId: 2 },
    { id: 4, title: "Neg", userId: "u1", isFolder: true, parentId: null },
    { id: 5, title: "Theirs", userId: "u2", isFolder: true, parentId: null },
  ])
  session.userId = "u1"
})

describe("PUT /api/doc/documents/:id moving a file", () => {
  it("saves a move into another of the owner's folders, and to the top level", async () => {
    const res = await put(2, { parentId: 4 })
    expect(res.status).toBe(200)
    expect(await parentOf(2)).toBe(4)
    expect((await put(2, { parentId: null })).status).toBe(200)
    expect(await parentOf(2)).toBeNull()
  })

  it.each([
    ["itself", 1, 1, PARENT_ERRORS.ownSubtree],
    ["one of its own sub-folders", 1, 2, PARENT_ERRORS.ownSubtree],
    ["a plain file", 4, 3, PARENT_ERRORS.notFolder],
    ["someone else's folder", 3, 5, PARENT_ERRORS.missing],
    ["a folder that doesn't exist", 3, 999, PARENT_ERRORS.missing],
  ])("refuses a move into %s and writes nothing", async (_label, id, parentId, error) => {
    const before = await parentOf(id)
    const res = await put(id, { parentId, title: "Renamed" })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error })
    expect(await parentOf(id)).toBe(before)
    const [{ title }] = await db.select({ title: documents.title }).from(documents).where(eq(documents.id, id))
    expect(title).not.toBe("Renamed")
  })

  it("lets a queued patch re-send the parent the row already has", async () => {
    const res = await put(3, { parentId: 2, title: "C1 updated" })
    expect(res.status).toBe(200)
    expect((await res.json()).title).toBe("C1 updated")
  })

  it("answers 400 for a field of the wrong type instead of throwing", async () => {
    expect((await put(3, { title: 7 })).status).toBe(400)
    expect((await put(3, { parentId: "4" })).status).toBe(400)
  })

  it("answers 404 for an id that isn't a row id", async () => {
    expect((await put("abc", { title: "x" })).status).toBe(404)
  })
})

describe("POST /api/doc/documents with a parent", () => {
  it("creates a file inside one of the creator's folders", async () => {
    const res = await post({ title: "C2", parentId: 2 })
    expect(res.status).toBe(201)
    expect((await res.json()).parentId).toBe(2)
  })

  it.each([
    ["a plain file", 3, PARENT_ERRORS.notFolder],
    ["someone else's folder", 5, PARENT_ERRORS.missing],
    ["a folder that doesn't exist", 999, PARENT_ERRORS.missing],
  ])("refuses a parent that is %s and creates nothing", async (_label, parentId, error) => {
    const res = await post({ title: "Stray", parentId })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error })
    expect(await db.select().from(documents).where(eq(documents.title, "Stray"))).toEqual([])
  })

  it("keeps a signed-out visitor's new file out of a signed-in user's folder", async () => {
    session.userId = null
    expect((await post({ title: "Anon", parentId: 1 })).status).toBe(400)
  })

  it("still creates a top-level file with no body fields", async () => {
    const res = await post({})
    expect(res.status).toBe(201)
    expect((await res.json()).parentId).toBeNull()
  })
})
