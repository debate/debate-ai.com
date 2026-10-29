/**
 * @fileoverview Wires the ported Practice vs AI backend to this app: the
 * signed-in user becomes the round's actor, D1 becomes its store, and the
 * user's own AI key or the site's shared keys (through write-language)
 * become its model.
 *
 * The four `/api/vsbot/*` route handlers all go through `withVsBotBackend`,
 * so auth, store construction and model selection live in one place.
 */

import { NextResponse } from "next/server"
import {
  createGeminiModelClient,
  createPracticeVsAiBackend,
  type DebateActor,
  type ModelClient,
  type PracticeVsAiBackend,
} from "@debate-ai/practice-vs-ai"
import { getEnv } from "@/lib/env"
import { getSession } from "@/lib/auth/session"
import { cleanApiKey, parseOwnKeyHeader, sharedProviderKeys, type ProviderKey } from "@/lib/ai/provider-key"
import { writeLanguageChat } from "@/lib/ai/write-language-chat"
import { createPracticeVsAiStore } from "./store"

const OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6"
const ANTHROPIC_MODEL = "claude-sonnet-4-6"

/** Room for a judge's JSON scorecard, the longest thing the backend asks for. */
const MAX_OUTPUT_TOKENS = 2048

/** Bot turns are capped at this many words; real constructives need more than Go's 150. */
const MAX_BOT_WORDS = 250

/** One provider key as a `ModelClient`, through write-language like `/api/reason-ai`. */
function writeLanguageModelClient(key: ProviderKey): ModelClient {
  return {
    async generateText(prompt) {
      const reply = await writeLanguageChat({
        key,
        model: key.provider === "openrouter" ? OPENROUTER_MODEL : ANTHROPIC_MODEL,
        messages: [{ role: "user", content: prompt }],
        maxTokens: MAX_OUTPUT_TOKENS,
      })
      return reply.text.trim()
    },
  }
}

/**
 * Try each client in order until one answers. A revoked or out-of-credit
 * OpenRouter key used to turn every bot turn into the persona's canned
 * "glitch" line even when an Anthropic key was set; now the next key gets
 * its turn. The last error is rethrown so the backend's in-character
 * fallback still covers the case where every key fails.
 */
export function createFallbackModelClient(clients: ModelClient[]): ModelClient | null {
  if (clients.length === 0) return null
  if (clients.length === 1) return clients[0]
  return {
    async generateText(prompt, signal) {
      let lastError: unknown
      for (const client of clients) {
        try {
          return await client.generateText(prompt, signal)
        } catch (error) {
          lastError = error
          console.error("[practice-vs-ai] model call failed, trying the next key:", error instanceof Error ? error.message : error)
        }
      }
      throw lastError
    },
  }
}

/**
 * Pick text generation for this request. The caller's own key
 * (`x-user-ai-key`) is used alone when present — they pay for it, and a
 * failure there shouldn't quietly spend the site's key. Otherwise the
 * shared keys in order: OpenRouter, Anthropic, then Gemini (what the Go
 * server ran). `null` keeps the round playable — the personas answer in
 * character with their "my systems are offline" lines.
 */
function resolveModelClient(request: Request): ModelClient | null {
  const own = parseOwnKeyHeader(request)
  if (own) return writeLanguageModelClient(own)

  const clients = sharedProviderKeys().map(writeLanguageModelClient)
  const geminiKey = cleanApiKey(getEnv("GEMINI_API_KEY"))
  if (geminiKey) clients.push(createGeminiModelClient({ apiKey: geminiKey }))

  if (clients.length === 0) {
    console.warn("[practice-vs-ai] no OPENROUTER_API_KEY, ANTHROPIC_API_KEY or GEMINI_API_KEY; bot replies will be canned")
  }
  return createFallbackModelClient(clients)
}

/**
 * Resolve the caller, build the backend against their own rows, and run one
 * handler. Returns a 401 when signed out — the Go routes likewise required a
 * bearer token on all four endpoints.
 */
export async function withVsBotBackend<T>(
  request: Request,
  run: (backend: PracticeVsAiBackend, actor: DebateActor, body: any) => Promise<{ status: number; body: T | { error: string } }>,
): Promise<NextResponse> {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to practice against an AI opponent." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const actor: DebateActor = { userId: session.user.id, email: session.user.email ?? "" }
  const backend = createPracticeVsAiBackend({
    store: createPracticeVsAiStore(session.user.id),
    model: resolveModelClient(request),
    maxBotWords: MAX_BOT_WORDS,
  })

  const result = await run(backend, actor, body)
  return NextResponse.json(result.body, { status: result.status })
}
