/**
 * Guards the port of the four gin handlers in Go
 * `backend/controllers/debatevsbot_controller.go`, driven against the
 * package's in-memory store.
 */
import { describe, expect, it, vi } from "vitest"
import { createPracticeVsAiBackend, toClientPhaseTimings, toStoredPhaseTimings } from "../src/backend/handlers"
import { createInMemoryDebateStore } from "../src/backend/store"
import { createStaticModelClient } from "../src/backend/model-client"
import type { DebateActor } from "../src/backend/types"

const actor: DebateActor = { userId: "user-1", email: "debater@example.com" }

const scorecard = JSON.stringify({
  opening_statement: { user: { score: 9, reason: "" }, bot: { score: 6, reason: "" } },
  cross_examination: { user: { score: 9, reason: "" }, bot: { score: 6, reason: "" } },
  answers: { user: { score: 9, reason: "" }, bot: { score: 6, reason: "" } },
  closing: { user: { score: 9, reason: "" }, bot: { score: 6, reason: "" } },
  total: { user: 36, bot: 24 },
  verdict: { winner: "User", reason: "", congratulations: "", opponent_analysis: "" },
})

function setup(reply = "A bot argument.") {
  const store = createInMemoryDebateStore()
  const backend = createPracticeVsAiBackend({ store, model: createStaticModelClient(reply) })
  return { store, backend }
}

const validCreate = {
  botName: "Yoda",
  botLevel: "Legends",
  topic: "Should AI rule the world?",
  stance: "against",
  history: [],
  phaseTimings: [{ name: "Opening Statements", time: 240 }],
}

describe("phase-timing conversion", () => {
  it("splits and recombines one duration, as the Go controller did", () => {
    const stored = toStoredPhaseTimings([{ name: "Opening Statements", time: 240 }])
    expect(stored).toEqual([{ name: "Opening Statements", userTime: 240, botTime: 240 }])
    expect(toClientPhaseTimings(stored)).toEqual([{ name: "Opening Statements", time: 240 }])
  })

  it("treats missing timings as none", () => {
    expect(toStoredPhaseTimings(undefined)).toEqual([])
    expect(toClientPhaseTimings(undefined)).toEqual([])
  })
})

describe("createDebate", () => {
  it("persists the round and echoes it back", async () => {
    const { backend, store } = setup()
    const result = await backend.createDebate(actor, validCreate)
    expect(result.status).toBe(200)
    const body = result.body as { debateId: string; phaseTimings: unknown }
    expect(body.debateId).toBeTruthy()
    expect(body.phaseTimings).toEqual([{ name: "Opening Statements", userTime: 240, botTime: 240 }])

    const stored = await store.getDebate(body.debateId)
    expect(stored?.email).toBe(actor.email)
    expect(stored?.topic).toBe(validCreate.topic)
  })

  it("rejects a payload missing a gin-required field", async () => {
    const { backend } = setup()
    const result = await backend.createDebate(actor, { ...validCreate, topic: "" })
    expect(result.status).toBe(400)
    expect((result.body as { error: string }).error).toContain("topic")
  })

  it("surfaces a store failure as a 500", async () => {
    const store = createInMemoryDebateStore()
    store.createDebate = vi.fn().mockRejectedValue(new Error("db down"))
    const backend = createPracticeVsAiBackend({ store, model: null })
    const result = await backend.createDebate(actor, validCreate)
    expect(result.status).toBe(500)
    expect((result.body as { error: string }).error).toContain("db down")
  })
})

describe("sendDebateMessage", () => {
  it("appends the bot's turn to the stored transcript", async () => {
    const { backend, store } = setup("Reasoned, my answer is.")
    const created = await backend.createDebate(actor, validCreate)
    const debateId = (created.body as { debateId: string }).debateId

    const result = await backend.sendDebateMessage(actor, {
      ...validCreate,
      debateId,
      history: [{ sender: "User", text: "Opening.", phase: "Opening Statements" }],
      context: "Make your statement",
    })
    expect(result.status).toBe(200)
    expect((result.body as { response: string }).response).toBe("Reasoned, my answer is.")

    const stored = await store.getDebate(debateId)
    expect(stored?.history.at(-1)).toEqual({ sender: "Bot", text: "Reasoned, my answer is." })
  })

  it("still answers when persisting the turn fails", async () => {
    const { backend, store } = setup("Still answering.")
    const created = await backend.createDebate(actor, validCreate)
    const debateId = (created.body as { debateId: string }).debateId
    store.appendMessage = vi.fn().mockRejectedValue(new Error("db down"))

    const result = await backend.sendDebateMessage(actor, { ...validCreate, debateId })
    expect(result.status).toBe(200)
    expect((result.body as { response: string }).response).toBe("Still answering.")
  })

  it("creates a round on the fly when no debateId is supplied", async () => {
    const { backend, store } = setup()
    const result = await backend.sendDebateMessage(actor, validCreate)
    const debateId = (result.body as { debateId: string }).debateId
    expect(debateId).toBeTruthy()
    expect((await store.getDebate(debateId))?.history).toHaveLength(1)
  })
})

describe("judgeDebate", () => {
  it("stores the verdict and scores the round", async () => {
    const { backend, store } = setup(scorecard)
    const created = await backend.createDebate(actor, validCreate)
    const debateId = (created.body as { debateId: string }).debateId

    const result = await backend.judgeDebate(actor, {
      debateId,
      history: [{ sender: "User", text: "Closing.", phase: "Closing Statements" }],
    })
    expect(result.status).toBe(200)
    expect((result.body as { result: string }).result).toBe(scorecard)
    expect((await store.getDebate(debateId))?.outcome).toBe(scorecard)

    // A win over a bot is worth 50 points and the FirstWin badge.
    const profile = await store.getGamificationProfile!(actor.userId)
    expect(profile?.score).toBe(50)
    expect(profile?.badges).toContain("FirstWin")
    expect(profile?.badges).toContain("Novice")
  })

  it("falls back to the user's latest round when no debateId is given", async () => {
    const { backend, store } = setup(scorecard)
    await backend.createDebate(actor, validCreate)
    await backend.judgeDebate(actor, { history: [{ sender: "User", text: "Closing." }] })
    expect((await store.getLatestDebate(actor.email))?.outcome).toBe(scorecard)
  })

  it("rejects a payload with no transcript", async () => {
    const { backend } = setup()
    const result = await backend.judgeDebate(actor, {} as never)
    expect(result.status).toBe(400)
  })
})

describe("concedeDebate", () => {
  it("marks the round conceded and scores it as a loss", async () => {
    const { backend, store } = setup()
    const created = await backend.createDebate(actor, validCreate)
    const debateId = (created.body as { debateId: string }).debateId

    const result = await backend.concedeDebate(actor, { debateId, history: [] })
    expect(result.status).toBe(200)
    expect((await store.getDebate(debateId))?.outcome).toBe("User conceded")
    // A loss still earns the 10 participation points, but no FirstWin.
    const profile = await store.getGamificationProfile!(actor.userId)
    expect(profile?.score).toBe(10)
    expect(profile?.badges).not.toContain("FirstWin")
  })

  it("404s on an unknown debate", async () => {
    const { backend } = setup()
    const result = await backend.concedeDebate(actor, { debateId: "nope" })
    expect(result.status).toBe(404)
  })

  it("requires a debateId", async () => {
    const { backend } = setup()
    const result = await backend.concedeDebate(actor, {} as never)
    expect(result.status).toBe(400)
  })
})
