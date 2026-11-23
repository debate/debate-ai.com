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

  it("keeps the chosen arguments with the round, without the evidence cards", async () => {
    const { backend, store } = setup()
    const plan = {
      evidence: "with" as const,
      userArguments: [{ title: "Uninsured Deaths advantage", kind: "advantage" }],
      botArguments: [{ title: "Spending DA" }],
      cards: [{ tag: "Card", cite: "Smith 24" }],
    }
    const result = await backend.createDebate(actor, { ...validCreate, plan })
    const stored = await store.getDebate((result.body as { debateId: string }).debateId)
    expect(stored?.plan?.userArguments.map((a) => a.title)).toEqual(["Uninsured Deaths advantage"])
    expect(stored?.plan?.botArguments.map((a) => a.title)).toEqual(["Spending DA"])
    expect(stored?.plan).not.toHaveProperty("cards")
  })

  it("stores no plan when the request has none", async () => {
    const { backend, store } = setup()
    const result = await backend.createDebate(actor, validCreate)
    const stored = await store.getDebate((result.body as { debateId: string }).debateId)
    expect(stored).not.toHaveProperty("plan")
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

  it("keeps the plan on a round it creates on the fly", async () => {
    const { backend, store } = setup()
    const result = await backend.sendDebateMessage(actor, {
      ...validCreate,
      plan: { evidence: "without", userArguments: [], botArguments: [{ title: "Politics DA" }] },
    })
    const stored = await store.getDebate((result.body as { debateId: string }).debateId)
    expect(stored?.plan?.botArguments).toEqual([{ title: "Politics DA" }])
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

    // The response echoes the same award back for the scorecard to show.
    const award = (result.body as { gamification?: { newScore: number; badgesAwarded: string[] } })
      .gamification
    expect(award?.newScore).toBe(50)
    expect(award?.badgesAwarded).toEqual(["FirstWin", "Novice"])
  })

  it("falls back to the user's latest round when no debateId is given", async () => {
    const { backend, store } = setup(scorecard)
    await backend.createDebate(actor, validCreate)
    await backend.judgeDebate(actor, { history: [{ sender: "User", text: "Closing." }] })
    expect((await store.getLatestDebate(actor.email))?.outcome).toBe(scorecard)
  })

  it("passes the requested feedback style to the judge prompt", async () => {
    const model = { generateText: vi.fn().mockResolvedValue(scorecard) }
    const backend = createPracticeVsAiBackend({ store: createInMemoryDebateStore(), model })
    await backend.judgeDebate(actor, {
      history: [{ sender: "User", text: "Closing." }],
      feedbackStyle: "devils-advocate",
    })
    await backend.judgeDebate(actor, { history: [{ sender: "User", text: "Closing." }] })
    expect(model.generateText.mock.calls[0][0]).toContain("Feedback style — Devil's Advocate:")
    expect(model.generateText.mock.calls[1][0]).not.toContain("Feedback style")
  })

  it("stores the resolved feedback style with the verdict", async () => {
    const { backend, store } = setup(scorecard)
    const created = await backend.createDebate(actor, validCreate)
    const debateId = (created.body as { debateId: string }).debateId
    const history = [{ sender: "User", text: "Closing." }]

    await backend.judgeDebate(actor, { debateId, history, feedbackStyle: "socratic" })
    expect((await store.getDebate(debateId))?.judgeFeedbackStyle).toBe("socratic")

    // No style, or one the judge doesn't know, is judged — and stored — as Standard.
    await backend.judgeDebate(actor, { debateId, history, feedbackStyle: "made-up" })
    expect((await store.getDebate(debateId))?.judgeFeedbackStyle).toBe("standard")
    await backend.judgeDebate(actor, { debateId, history })
    expect((await store.getDebate(debateId))?.judgeFeedbackStyle).toBe("standard")
  })

  it("clears a stored feedback style when the round is then conceded", async () => {
    const { backend, store } = setup(scorecard)
    const created = await backend.createDebate(actor, validCreate)
    const debateId = (created.body as { debateId: string }).debateId
    await backend.judgeDebate(actor, { debateId, history: [{ sender: "User", text: "x" }], feedbackStyle: "socratic" })
    await backend.concedeDebate(actor, { debateId })
    const debate = await store.getDebate(debateId)
    expect(debate?.outcome).toBe("User conceded")
    expect(debate?.judgeFeedbackStyle).toBeUndefined()
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

    const award = (result.body as { gamification?: { newScore: number; points: number } }).gamification
    // A loss over the 10-point Novice threshold still earns that badge, just not FirstWin.
    expect(award).toEqual({ points: 10, action: "debate_loss", badgesAwarded: ["Novice"], newScore: 10 })
  })

  it("omits gamification from the response when the store doesn't implement the hooks", async () => {
    const bareStore = {
      async createDebate() {
        return "id-1"
      },
      async getDebate() {
        return {
          id: "id-1",
          email: actor.email,
          botName: "Yoda",
          botLevel: "Legends",
          topic: "Topic",
          stance: "for",
          history: [],
          phaseTimings: [],
          outcome: "",
          createdAt: 0,
        }
      },
      async getLatestDebate() {
        return null
      },
      async setOutcome() {},
    }
    const backend = createPracticeVsAiBackend({ store: bareStore, model: createStaticModelClient("") })

    const result = await backend.concedeDebate(actor, { debateId: "id-1", history: [] })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ message: "Debate conceded successfully" })
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

describe("listDebates", () => {
  it("returns the actor's past debates, newest first", async () => {
    const { backend, store } = setup()
    const base = {
      email: actor.email,
      botName: "Yoda",
      botLevel: "Legends",
      topic: "older",
      stance: "for",
      history: [],
      phaseTimings: [],
    }
    await store.createDebate({ ...base, topic: "older", createdAt: 100 })
    await store.createDebate({ ...base, topic: "newer", createdAt: 200 })

    const result = await backend.listDebates(actor)
    expect(result.status).toBe(200)
    const debates = (result.body as { debates: { topic: string }[] }).debates
    expect(debates.map((d) => d.topic)).toEqual(["newer", "older"])
  })

  it("returns an empty list for a store without listDebates", async () => {
    const bareStore = {
      async createDebate() {
        return "id-1"
      },
      async getDebate() {
        return null
      },
      async getLatestDebate() {
        return null
      },
      async setOutcome() {},
    }
    const backend = createPracticeVsAiBackend({ store: bareStore, model: null })
    const result = await backend.listDebates(actor)
    expect(result).toEqual({ status: 200, body: { debates: [] } })
  })
})

describe("deleteDebate", () => {
  const base = {
    email: actor.email,
    botName: "Yoda",
    botLevel: "Legends",
    topic: "Tariffs",
    stance: "for",
    history: [],
    phaseTimings: [],
    createdAt: 100,
  }

  it("removes the actor's debate so it no longer lists", async () => {
    const { backend, store } = setup()
    const id = await store.createDebate(base)
    expect(await backend.deleteDebate(actor, id)).toEqual({ status: 200, body: { deleted: true } })
    expect(await store.getDebate(id)).toBeNull()
    const listed = await backend.listDebates(actor)
    expect((listed.body as { debates: unknown[] }).debates).toEqual([])
  })

  it("answers 404 for an unknown id, a second removal, or another user's debate", async () => {
    const { backend, store } = setup()
    const theirs = await store.createDebate({ ...base, email: "someone@example.com" })
    const mine = await store.createDebate(base)
    await backend.deleteDebate(actor, mine)

    for (const id of ["nope", mine, theirs]) {
      const result = await backend.deleteDebate(actor, id)
      expect(result.status).toBe(404)
      expect(result.body).toEqual({ error: "This round is no longer in your account." })
    }
    expect(await store.getDebate(theirs)).not.toBeNull()
  })

  it("rejects a missing or blank id", async () => {
    const { backend } = setup()
    for (const id of [null, undefined, "", "   ", 42]) {
      expect((await backend.deleteDebate(actor, id)).status).toBe(400)
    }
  })

  it("answers { deleted: false } for a store that keeps nothing", async () => {
    const bareStore = {
      async createDebate() {
        return "id-1"
      },
      async getDebate() {
        return null
      },
      async getLatestDebate() {
        return null
      },
      async setOutcome() {},
    }
    const backend = createPracticeVsAiBackend({ store: bareStore, model: null })
    expect(await backend.deleteDebate(actor, "id-1")).toEqual({ status: 200, body: { deleted: false } })
  })

  it("describes a store failure as a 500", async () => {
    const store = {
      ...createInMemoryDebateStore(),
      async deleteDebate(): Promise<boolean> {
        throw new Error("D1 unavailable")
      },
    }
    const backend = createPracticeVsAiBackend({ store, model: null })
    expect(await backend.deleteDebate(actor, "1")).toEqual({
      status: 500,
      body: { error: "Failed to remove the debate: D1 unavailable" },
    })
  })
})

describe("saveDebrief", () => {
  async function createRound(store: ReturnType<typeof createInMemoryDebateStore>) {
    return store.createDebate({
      email: actor.email,
      botName: "Yoda",
      botLevel: "Legends",
      topic: "Should AI rule the world?",
      stance: "against",
      history: [],
      phaseTimings: [],
      createdAt: 100,
    })
  }

  it("keeps the debrief with the round, trimmed, and returns it", async () => {
    const { store, backend } = setup()
    const id = await createRound(store)

    const result = await backend.saveDebrief(actor, { debateId: id, personaId: " socratic ", text: "  Weigh earlier.  " })

    expect(result.status).toBe(200)
    const body = result.body as { saved: boolean; debrief: { personaId: string; text: string; savedAt: number } }
    expect(body.saved).toBe(true)
    expect(body.debrief).toMatchObject({ personaId: "socratic", text: "Weigh earlier." })
    expect(Number.isInteger(body.debrief.savedAt)).toBe(true)
    expect((await store.getDebate(id))?.debrief).toEqual(body.debrief)
  })

  it("replaces an earlier debrief instead of keeping both", async () => {
    const { store, backend } = setup()
    const id = await createRound(store)
    await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "First." })
    await backend.saveDebrief(actor, { debateId: id, personaId: "fact-checker", text: "Second." })
    expect((await store.getDebate(id))?.debrief).toMatchObject({ personaId: "fact-checker", text: "Second." })
  })

  it("keeps writtenAt with the debrief", async () => {
    const { store, backend } = setup()
    const id = await createRound(store)
    await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "Hi.", writtenAt: 5_000 })
    expect((await store.getDebate(id))?.debrief).toMatchObject({ text: "Hi.", writtenAt: 5_000 })
  })

  it("keeps the later-written debrief when an older one arrives last", async () => {
    const { store, backend } = setup()
    const id = await createRound(store)
    await backend.saveDebrief(actor, { debateId: id, personaId: "socratic", text: "Newer.", writtenAt: 2_000 })

    const late = await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "Older.", writtenAt: 1_000 })

    expect(late).toEqual({ status: 200, body: { saved: false, superseded: true } })
    expect((await store.getDebate(id))?.debrief).toMatchObject({ personaId: "socratic", text: "Newer.", writtenAt: 2_000 })
  })

  it("replaces on an equal or later writtenAt, and when either save has none", async () => {
    const { store, backend } = setup()
    const id = await createRound(store)
    await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "A.", writtenAt: 2_000 })
    await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "B.", writtenAt: 2_000 })
    expect((await store.getDebate(id))?.debrief?.text).toBe("B.")
    await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "C." })
    expect((await store.getDebate(id))?.debrief?.text).toBe("C.")
    await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "D.", writtenAt: 1 })
    expect((await store.getDebate(id))?.debrief?.text).toBe("D.")
  })

  it("answers superseded when the store's own re-check keeps a newer debrief", async () => {
    const store = createInMemoryDebateStore()
    const id = await createRound(store)
    const racing = { ...store, setDebrief: vi.fn(async () => false as const) }
    const backend = createPracticeVsAiBackend({ store: racing, model: null })
    const result = await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "Hi.", writtenAt: 9 })
    expect(result).toEqual({ status: 200, body: { saved: false, superseded: true } })
  })

  it("answers saved: false for a store that keeps no debriefs, without looking the round up", async () => {
    const getDebate = vi.fn(async () => null)
    const bareStore = {
      async createDebate() {
        return "id-1"
      },
      getDebate,
      async getLatestDebate() {
        return null
      },
      async setOutcome() {},
    }
    const backend = createPracticeVsAiBackend({ store: bareStore, model: null })
    const result = await backend.saveDebrief(actor, { debateId: "guest_1", personaId: "standard", text: "Hi." })
    expect(result).toEqual({ status: 200, body: { saved: false } })
    expect(getDebate).not.toHaveBeenCalled()
  })

  it("404s on an unknown debate", async () => {
    const { backend } = setup()
    const result = await backend.saveDebrief(actor, { debateId: "missing", personaId: "standard", text: "Hi." })
    expect(result.status).toBe(404)
  })

  it.each([
    ["a missing debateId", { personaId: "standard", text: "Hi." }],
    ["a blank personaId", { debateId: "x", personaId: "  ", text: "Hi." }],
    ["an over-long personaId", { debateId: "x", personaId: "p".repeat(65), text: "Hi." }],
    ["blank text", { debateId: "x", personaId: "standard", text: "   " }],
    ["non-string text", { debateId: "x", personaId: "standard", text: 42 }],
    ["a fractional writtenAt", { debateId: "x", personaId: "standard", text: "Hi.", writtenAt: 1.5 }],
    ["a zero writtenAt", { debateId: "x", personaId: "standard", text: "Hi.", writtenAt: 0 }],
    ["a string writtenAt", { debateId: "x", personaId: "standard", text: "Hi.", writtenAt: "now" }],
  ])("400s on %s", async (_label, body) => {
    const { backend } = setup()
    const result = await backend.saveDebrief(actor, body as never)
    expect(result.status).toBe(400)
  })

  it("413s on a debrief over the length cap and stores nothing", async () => {
    const { store, backend } = setup()
    const id = await createRound(store)
    const result = await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "x".repeat(8_001) })
    expect(result.status).toBe(413)
    expect((await store.getDebate(id))?.debrief).toBeUndefined()
  })

  it("500s when the store fails to write", async () => {
    const store = createInMemoryDebateStore()
    const id = await createRound(store)
    const failing = { ...store, setDebrief: vi.fn(async () => { throw new Error("disk full") }) }
    const backend = createPracticeVsAiBackend({ store: failing, model: null })
    const result = await backend.saveDebrief(actor, { debateId: id, personaId: "standard", text: "Hi." })
    expect(result).toEqual({ status: 500, body: { error: "Failed to save the debrief: disk full" } })
  })
})
