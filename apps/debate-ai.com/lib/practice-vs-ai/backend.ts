/**
 * @fileoverview Wires the ported Practice vs AI backend to this app: the
 * signed-in user becomes the round's actor, D1 becomes its store, and the
 * app's existing `ANTHROPIC_API_KEY` becomes its model.
 *
 * The four `/api/vsbot/*` route handlers all go through `withVsBotBackend`,
 * so auth, store construction and model selection live in one place.
 */

import { NextResponse } from "next/server"
import {
  createAnthropicModelClient,
  createGeminiModelClient,
  createPracticeVsAiBackend,
  type DebateActor,
  type ModelClient,
  type PracticeVsAiBackend,
} from "debate-practice-vs-ai"
import { getEnv } from "@/lib/env"
import { getSession } from "@/lib/auth/session"
import { createPracticeVsAiStore } from "./store"

/**
 * Pick a text-generation provider. Anthropic first, since that is the key
 * this app already holds; Gemini second, since it is what the Go server ran.
 * `null` keeps the round playable — the personas answer in character with
 * their "my systems are offline" lines, exactly as the Go server behaved
 * with no key configured.
 */
function resolveModelClient(): ModelClient | null {
  const anthropicKey = getEnv("ANTHROPIC_API_KEY")
  if (anthropicKey) return createAnthropicModelClient({ apiKey: anthropicKey })

  const geminiKey = getEnv("GEMINI_API_KEY")
  if (geminiKey) return createGeminiModelClient({ apiKey: geminiKey })

  console.warn("[practice-vs-ai] no ANTHROPIC_API_KEY or GEMINI_API_KEY; bot replies will be canned")
  return null
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
    model: resolveModelClient(),
  })

  const result = await run(backend, actor, body)
  return NextResponse.json(result.body, { status: result.status })
}
