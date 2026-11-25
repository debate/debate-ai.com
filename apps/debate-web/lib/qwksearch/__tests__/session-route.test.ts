/**
 * @fileoverview GET /api/qwksearch/session answers 503 busy, not a bare 500,
 * when D1 is overloaded while reading the saved connection.
 */
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

let loadConnection: () => Promise<unknown> = async () => null

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ user: { id: "u1" }, session: { id: "s1", userId: "u1" } }),
}))
vi.mock("@/lib/qwksearch/store", () => ({
  loadConnection: () => loadConnection(),
  saveConnection: async () => {},
}))

import { GET } from "@/app/api/qwksearch/session/route"

const request = () => new NextRequest("https://d.ebate.app/api/qwksearch/session")

describe("GET /api/qwksearch/session", () => {
  beforeEach(() => {
    loadConnection = async () => null
  })

  it("returns the payload when the connection loads", async () => {
    const res = await GET(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ connected: false })
  })

  it("answers 503 busy with Retry-After when D1 is overloaded", async () => {
    const overloaded = new Error("Failed query", {
      cause: new Error("D1 DB is overloaded. Too many resources consumed within a 10 second window."),
    })
    loadConnection = async () => {
      throw overloaded
    }
    const res = await GET(request())
    expect(res.status).toBe(503)
    expect(res.headers.get("Retry-After")).toBe("5")
    expect(await res.json()).toMatchObject({ busy: true })
  })
})
