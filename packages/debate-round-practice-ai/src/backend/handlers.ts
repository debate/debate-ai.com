/**
 * @fileoverview The four vs-bot endpoints — the port of Go
 * `backend/controllers/debatevsbot_controller.go` and the route group in
 * `backend/routes/debatevsbot.go` (`/vsbot/create`, `/vsbot/debate`,
 * `/vsbot/judge`, `/vsbot/concede`).
 *
 * Gin handlers took a `*gin.Context`, pulled a bearer token off the header
 * and wrote JSON straight to the socket. These take plain parsed bodies plus
 * an already-resolved `DebateActor` and return `{ status, body }`, so the
 * host app owns auth and transport — a Next.js route handler is then four
 * lines, and the same backend runs under any other server.
 *
 * @module backend/handlers
 */

import { computeGamificationAward } from "./gamification"
import type { ModelClient } from "./model-client"
import { generateBotResponse, judgeDebate, resolveResultStatus } from "./service"
import type { DebateStore } from "./store"
import type {
  ConcedeRequestBody,
  CreateDebateResponse,
  DebateActor,
  DebateMessage,
  DebateMessageResponse,
  DebateRequestBody,
  DebateVsBotRecord,
  HandlerResult,
  JudgeRequestBody,
  JudgeResponse,
  PhaseTiming,
  StoredPhaseTiming,
} from "./types"

export interface PracticeVsAiBackendOptions {
  /** Where debates live. Defaults to a process-local store. */
  store: DebateStore
  /**
   * Text generation. `null` keeps the round playable with the personas'
   * in-character "my systems are offline" fallbacks, exactly as the Go
   * server behaved with an unset Gemini key.
   */
  model: ModelClient | null
  /** Word cap on a bot turn. The Go controller passed 150. */
  maxBotWords?: number
}

/**
 * Split one client-supplied phase duration into the user/bot pair the
 * storage model holds. Ported from the Go controller's conversion loop.
 */
export function toStoredPhaseTimings(timings: PhaseTiming[] | undefined): StoredPhaseTiming[] {
  return (timings ?? []).map((pt) => ({ name: pt.name, userTime: pt.time, botTime: pt.time }))
}

/** The inverse: collapse a stored pair back to the client's single duration. */
export function toClientPhaseTimings(timings: StoredPhaseTiming[] | undefined): PhaseTiming[] {
  return (timings ?? []).map((pt) => ({ name: pt.name, time: pt.userTime }))
}

function missingFields(body: DebateRequestBody): string[] {
  // Go used gin's `binding:"required"` on these four fields.
  return (["botName", "botLevel", "topic", "stance"] as const).filter((field) => !body?.[field])
}

/**
 * Build the four handlers over one store and one model client.
 *
 * @example
 * ```ts
 * const backend = createPracticeVsAiBackend({ store, model })
 * const { status, body } = await backend.createDebate(actor, await req.json())
 * ```
 */
export function createPracticeVsAiBackend(options: PracticeVsAiBackendOptions) {
  const { store, model, maxBotWords = 150 } = options

  /**
   * POST /vsbot/create — persist a new debate and echo it back with its id.
   * Ported from Go `controllers.CreateDebate`.
   */
  async function createDebate(
    actor: DebateActor,
    body: DebateRequestBody,
  ): Promise<HandlerResult<CreateDebateResponse>> {
    const missing = missingFields(body)
    if (missing.length > 0) {
      return { status: 400, body: { error: `Invalid request payload: missing ${missing.join(", ")}` } }
    }

    const phaseTimings = toStoredPhaseTimings(body.phaseTimings)
    const debate: Omit<DebateVsBotRecord, "id"> = {
      email: actor.email,
      botName: body.botName,
      botLevel: body.botLevel,
      topic: body.topic,
      stance: body.stance,
      history: body.history ?? [],
      phaseTimings,
      createdAt: Math.floor(Date.now() / 1000),
    }

    let debateId: string
    try {
      debateId = await store.createDebate(debate)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { status: 500, body: { error: `Failed to create debate: ${message}` } }
    }

    return {
      status: 200,
      body: {
        debateId,
        botName: body.botName,
        botLevel: body.botLevel,
        topic: body.topic,
        stance: body.stance,
        phaseTimings,
      },
    }
  }

  /**
   * POST /vsbot/debate — generate the bot's next turn and append it to the
   * transcript. Ported from Go `controllers.SendDebateMessage`, which, like
   * this, treated a failed history write as non-fatal: the user still gets
   * the bot's reply.
   */
  async function sendDebateMessage(
    actor: DebateActor,
    body: DebateRequestBody & { debateId?: string },
  ): Promise<HandlerResult<DebateMessageResponse>> {
    const missing = missingFields(body)
    if (missing.length > 0) {
      return { status: 400, body: { error: `Invalid request payload: missing ${missing.join(", ")}` } }
    }

    const history = body.history ?? []
    const response = await generateBotResponse(model, {
      botName: body.botName,
      botLevel: body.botLevel,
      topic: body.topic,
      history,
      stance: body.stance,
      context: body.context,
      maxWords: maxBotWords,
    })

    const botMessage: DebateMessage = { sender: "Bot", text: response }

    let debateId = body.debateId ?? ""
    try {
      if (debateId && store.appendMessage) {
        await store.appendMessage(debateId, botMessage)
      } else if (!debateId) {
        debateId = await store.createDebate({
          email: actor.email,
          botName: body.botName,
          botLevel: body.botLevel,
          topic: body.topic,
          stance: body.stance,
          history: [...history, botMessage],
          phaseTimings: toStoredPhaseTimings(body.phaseTimings),
          createdAt: Math.floor(Date.now() / 1000),
        })
      }
    } catch (error) {
      console.error("[practice-vs-ai] failed to persist bot turn:", error)
    }

    return {
      status: 200,
      body: {
        debateId,
        botName: body.botName,
        botLevel: body.botLevel,
        topic: body.topic,
        stance: body.stance,
        response,
      },
    }
  }

  /**
   * Record a finished round: transcript, then the gamification award.
   * Ported from the Go controller's post-judge tail, which wrapped both in a
   * recover so a scoring failure never failed the request.
   */
  async function recordCompletedRound(
    actor: DebateActor,
    input: {
      topic: string
      opponentName: string
      result: ReturnType<typeof resolveResultStatus>
      history: DebateMessage[]
    },
  ): Promise<void> {
    try {
      await store.saveTranscript?.({
        userId: actor.userId,
        email: actor.email,
        debateType: "user_vs_bot",
        topic: input.topic,
        opponentName: input.opponentName,
        result: input.result,
        history: input.history,
      })
    } catch (error) {
      console.error("[practice-vs-ai] failed to save transcript:", error)
    }

    try {
      if (!store.getGamificationProfile || !store.applyGamificationAward) return
      const profile = await store.getGamificationProfile(actor.userId)
      if (!profile) return
      const award = computeGamificationAward(profile, input.result)
      await store.applyGamificationAward(actor.userId, award, {
        debateType: "user_vs_bot",
        topic: input.topic,
        result: input.result,
      })
    } catch (error) {
      console.error("[practice-vs-ai] failed to apply gamification award:", error)
    }
  }

  /**
   * POST /vsbot/judge — score the transcript, store the outcome, and record
   * the round. Ported from Go `controllers.JudgeDebate`, including its
   * fallback debate record ("Debate vs Bot" / "AI Bot") when the user's
   * latest debate can't be read.
   */
  async function judge(
    actor: DebateActor,
    body: JudgeRequestBody & { debateId?: string },
  ): Promise<HandlerResult<JudgeResponse>> {
    if (!Array.isArray(body?.history)) {
      return { status: 400, body: { error: "Invalid request payload: history is required" } }
    }

    const result = await judgeDebate(model, body.history)

    let latest = null
    try {
      latest = body.debateId
        ? await store.getDebate(body.debateId)
        : await store.getLatestDebate(actor.email)
    } catch (error) {
      console.error("[practice-vs-ai] failed to read latest debate:", error)
    }

    try {
      if (latest) await store.setOutcome(latest.id, result)
    } catch (error) {
      console.error("[practice-vs-ai] failed to store outcome:", error)
    }

    const resultStatus = resolveResultStatus(result)
    await recordCompletedRound(actor, {
      topic: latest?.topic ?? "Debate vs Bot",
      opponentName: latest?.botName ?? "AI Bot",
      result: resultStatus,
      history: body.history,
    })

    return { status: 200, body: { result } }
  }

  /**
   * POST /vsbot/concede — mark the debate conceded and score it as a loss.
   * Ported from Go `controllers.ConcedeDebate`, which preferred the
   * client-supplied transcript over the stored one when both were present.
   */
  async function concedeDebate(
    actor: DebateActor,
    body: ConcedeRequestBody,
  ): Promise<HandlerResult<{ message: string }>> {
    if (!body?.debateId) {
      return { status: 400, body: { error: "Invalid request payload: debateId is required" } }
    }

    let debate
    try {
      debate = await store.getDebate(body.debateId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { status: 500, body: { error: `Failed to load debate: ${message}` } }
    }
    if (!debate) return { status: 404, body: { error: "Debate not found" } }

    try {
      await store.setOutcome(debate.id, "User conceded")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { status: 500, body: { error: `Failed to update debate: ${message}` } }
    }

    const history = body.history && body.history.length > 0 ? body.history : debate.history
    await recordCompletedRound(actor, {
      topic: debate.topic,
      opponentName: debate.botName,
      result: "loss",
      history,
    })

    return { status: 200, body: { message: "Debate conceded successfully" } }
  }

  return { createDebate, sendDebateMessage, judgeDebate: judge, concedeDebate }
}

export type PracticeVsAiBackend = ReturnType<typeof createPracticeVsAiBackend>
