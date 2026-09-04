/**
 * @fileoverview The vs-bot debate service — the port of the generation half
 * of Go `backend/services/debatevsbot.go` (`GenerateBotResponse`,
 * `JudgeDebate`) and of the judge-result classification the Go controller
 * did inline in `JudgeDebate`.
 *
 * Where the Go functions read a process-global Gemini client, these take a
 * `ModelClient`, so the host app owns provider and key selection.
 *
 * @module backend/service
 */

import type { ModelClient } from "./model-client"
import { getBotPersonality } from "./personalities"
import { personalityClarificationRequest, personalityErrorResponse } from "./persona-fallbacks"
import { constructJudgePrompt, constructPrompt } from "./prompt"
import type { DebateMessage, DebateResultStatus, JudgmentData } from "./types"

/** The Go controller asked for 150-word bot turns. */
export const DEFAULT_MAX_BOT_WORDS = 150

export interface GenerateBotResponseInput {
  botName: string
  botLevel: string
  topic: string
  history: DebateMessage[]
  stance: string
  /** Turn-level nudge, e.g. "Ask a clear and concise question…". */
  context?: string
  maxWords?: number
}

/**
 * Generate the bot's next turn. Ported from Go `GenerateBotResponse`,
 * including its three in-character bail-outs: no client, a generation error,
 * an empty completion — plus its "the model asked to clarify" check, which
 * swaps a model response containing "clarify" for the persona's own
 * clarification line.
 */
export async function generateBotResponse(
  client: ModelClient | null,
  input: GenerateBotResponseInput,
): Promise<string> {
  const { botName, botLevel, topic, history, stance, context = "" } = input
  const maxWords = input.maxWords ?? DEFAULT_MAX_BOT_WORDS

  if (!client) {
    return personalityErrorResponse(botName, "My systems are offline, it seems.")
  }

  // The Go service resolved the persona by name but took the level from the
  // request, so a caller can run a known persona at a different difficulty.
  const bot = { ...getBotPersonality(botName), level: botLevel || getBotPersonality(botName).level }
  const prompt = constructPrompt(bot, topic, history, stance, context, maxWords)

  let response: string
  try {
    response = await client.generateText(prompt)
  } catch (error) {
    console.error("[practice-vs-ai] model error in generateBotResponse:", error)
    return personalityErrorResponse(botName, "A glitch in my logic, there is.")
  }

  if (!response) {
    return personalityErrorResponse(botName, "Lost in translation, my thoughts are.")
  }
  if (response.toLowerCase().includes("clarify")) {
    return personalityClarificationRequest(botName)
  }
  return response
}

/**
 * Score a finished transcript. Ported from Go `services.JudgeDebate`,
 * including how it picked the bot's persona (the first non-"User" sender in
 * the transcript) and its "Unable to judge." fallback string, which the UI
 * already knows how to recover from.
 */
export async function judgeDebate(
  client: ModelClient | null,
  history: DebateMessage[],
): Promise<string> {
  if (!client) return "Unable to judge."

  let botName = "Default"
  for (const msg of history) {
    if (msg.sender !== "User") {
      botName = msg.sender
      break
    }
  }
  const bot = getBotPersonality(botName)
  const prompt = constructJudgePrompt(bot, history)

  try {
    const text = await client.generateText(prompt)
    return text || "Unable to judge."
  } catch (error) {
    console.error("[practice-vs-ai] model error in judgeDebate:", error)
    return "Unable to judge."
  }
}

/**
 * Pull the JSON object out of a judge reply that may be fenced or padded
 * with prose. Mirrors the `extractJSON` helper the Go server's React client
 * used on the same payload.
 */
export function extractJudgmentJson(response: string): string {
  if (!response) return "{}"
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(response)
  if (fenced?.[1]) return fenced[1].trim()
  const bare = response.match(/\{[\s\S]*\}/)
  if (bare) return bare[0]
  return "{}"
}

/** Parse a judge reply into `JudgmentData`, or null when it isn't valid JSON. */
export function parseJudgment(result: string): JudgmentData | null {
  try {
    const parsed = JSON.parse(extractJudgmentJson(result)) as Partial<JudgmentData>
    if (parsed && parsed.opening_statement && parsed.verdict) return parsed as JudgmentData
    return null
  } catch {
    return null
  }
}

/**
 * Classify a judge reply as a win/loss/draw for the user. Ported from the
 * Go controller's `JudgeDebate` body, keeping both paths: read
 * `verdict.winner` when the reply parses as JSON, otherwise fall back to
 * substring matching — and, as in Go, default to a loss when neither is
 * conclusive.
 */
export function resolveResultStatus(result: string): DebateResultStatus {
  const judgment = parseJudgment(result)
  if (judgment) {
    const winner = judgment.verdict?.winner
    if (typeof winner === "string") {
      if (winner.toLowerCase() === "user") return "win"
      if (winner.toLowerCase() === "bot") return "loss"
      if (winner.toLowerCase() === "draw") return "draw"
    }
    return "loss"
  }

  const lower = result.toLowerCase()
  if (
    lower.includes("user win") ||
    lower.includes("user wins") ||
    (lower.includes("user") && lower.includes("win"))
  ) {
    return "win"
  }
  if (
    lower.includes("bot win") ||
    lower.includes("bot wins") ||
    lower.includes("lose") ||
    lower.includes("loss") ||
    (lower.includes("bot") && lower.includes("win"))
  ) {
    return "loss"
  }
  if (lower.includes("draw")) return "draw"
  return "loss"
}
