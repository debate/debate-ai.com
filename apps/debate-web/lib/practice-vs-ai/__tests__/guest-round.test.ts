import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }))
vi.mock("@/lib/env", () => ({ getEnv: () => undefined }))
vi.mock("@/lib/ai/provider-key", () => ({
  OPENROUTER_FREE_MODEL: "openrouter/free",
  cleanApiKey: () => null,
  parseOwnKeyHeader: () => null,
  sharedProviderKeys: () => [],
}))
vi.mock("@/lib/ai/write-language-chat", () => ({ logAIFailure: vi.fn(), writeLanguageChat: vi.fn() }))
vi.mock("@/lib/database/context", () => ({
  getDBFromContext: () => {
    throw new Error("a guest round must not touch the database")
  },
}))

const { withVsBotBackend } = await import("../backend")
const { createGuestPracticeVsAiStore } = await import("../store")

const post = (body: unknown) =>
  new Request("https://example.test/api/vsbot/x", { method: "POST", body: JSON.stringify(body) })

const round = { botName: "Rookie Rick", botLevel: "Easy", topic: "Social media should be regulated", stance: "for" }

describe("Practice vs AI for signed-out players", () => {
  beforeEach(() => getSession.mockResolvedValue(null))

  it("preps the case instead of answering 401", async () => {
    const res = await withVsBotBackend(post(round), (backend, actor, body) => backend.prepareCase(actor, body))
    expect(res.status).toBe(200)
    expect((await res.json()).brief).toBeTruthy()
  })

  it("creates, plays and concedes a round without saving anything", async () => {
    const created = await withVsBotBackend(post({ ...round, history: [] }), (b, a, body) => b.createDebate(a, body))
    expect(created.status).toBe(200)
    const { debateId } = await created.json()
    expect(debateId).toMatch(/^guest_/)

    const turn = await withVsBotBackend(
      post({ ...round, debateId, history: [{ sender: "User", text: "Regulation protects teens." }] }),
      (b, a, body) => b.sendDebateMessage(a, body),
    )
    expect(turn.status).toBe(200)
    expect((await turn.json()).response).toBeTruthy()

    const conceded = await withVsBotBackend(post({ debateId, history: [] }), (b, a, body) => b.concedeDebate(a, body))
    expect(conceded.status).toBe(200)
    expect((await conceded.json()).gamification).toBeUndefined()
  })

  it("judges a guest round from the client's transcript", async () => {
    const judged = await withVsBotBackend(
      post({ debateId: "guest_x", history: [{ sender: "User", text: "hi" }] }),
      (b, a, body) => b.judgeDebate(a, body),
    )
    expect(judged.status).toBe(200)
    expect((await judged.json()).result).toBeTruthy()
  })

  it("the guest store only answers its own throwaway ids", async () => {
    const store = createGuestPracticeVsAiStore()
    expect(await store.getDebate("42")).toBeNull()
    expect(await store.listDebates?.("")).toEqual([])
  })
})
