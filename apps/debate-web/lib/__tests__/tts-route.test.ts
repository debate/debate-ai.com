/**
 * @fileoverview `POST /api/tts`: Cloudflare read-aloud (the docs Voice button
 * pins `route: "cloudflare"`) runs through the Worker's `AI` binding, refuses
 * signed-out readers with a 401 rather than a 503, and still answers 503 with
 * a reason when Workers AI isn't reachable at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let signedInAs: string | null = "user-1"
let env: Record<string, unknown> = {}

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (signedInAs ? { user: { id: signedInAs } } : null),
}))
vi.mock("@/lib/database/context", () => ({ getCloudflareContext: () => ({ env }) }))
vi.mock("@/lib/env", () => ({ getEnv: () => undefined }))
vi.mock("@/lib/qwksearch/store", () => ({ loadConnection: async () => null }))

const { POST } = await import("@/app/api/tts/route")

const speak = (body: Record<string, unknown>) =>
  POST(
    new Request("https://d.ebate.app/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )

const docsVoice = { text: "Activism forecloses persuasion.", provider: "deepgram", voice: "luna", route: "cloudflare" }

describe("POST /api/tts", () => {
  beforeEach(() => {
    signedInAs = "user-1"
    env = {}
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it("speaks through the AI binding with the requested Aura speaker", async () => {
    const run = vi.fn(async () => new Uint8Array([1, 2, 3]))
    env = { AI: { run } }
    const res = await speak(docsVoice)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("audio/mpeg")
    expect(res.headers.get("x-tts-backend")).toBe("cloudflare")
    expect(run).toHaveBeenCalledWith("@cf/deepgram/aura-1", { text: docsVoice.text, speaker: "luna" })
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it("refuses a signed-out reader pinned to Cloudflare with a 401, without running the model", async () => {
    const run = vi.fn()
    env = { AI: { run } }
    signedInAs = null
    const res = await speak(docsVoice)
    expect(res.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it("answers 503 with the reason when neither the binding nor an API token is configured", async () => {
    const res = await speak(docsVoice)
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/isn't configured/)
  })

  it("answers 503 when the binding throws", async () => {
    env = { AI: { run: async () => { throw new Error("capacity") } } }
    const res = await speak(docsVoice)
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe("cloudflare is unreachable.")
  })
})
