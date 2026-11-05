import { NextResponse } from "next/server"
import { getAuth } from "@/lib/auth"
import {
  keyExhaustedResponse,
  parseOwnKeyHeader,
  resolveProviderKey,
  sharedProviderKeys,
  type ProviderKey,
} from "@/lib/ai/provider-key"
import {
  WriteLanguageChatError,
  isAuthError,
  writeLanguageChat,
  type ChatMessage,
  type WriteLanguageChatReply,
} from "@/lib/ai/write-language-chat"
import { getDBFromContext } from "@/lib/database/context"
import { limitsFor } from "@debate-ai/webview/lib/stripe/limits"
import { consumeDailyUsage, getUserTier, limitMessage, planLimitHeaders, usageSubject } from "@/lib/stripe/usage"

/**
 * General-purpose server-side proxy for this app's Anthropic-backed AI
 * features. Originally built for reason-editor's AI features (cite
 * formatting, OCR/PDF text repair, image alt text, the research-coach
 * "explain"), it's a plain `{ system?, messages, maxTokens?, temperature? }`
 * passthrough to the Anthropic Messages API, so any package in this repo
 * can reuse it rather than standing up its own proxy route — e.g.
 * debate-card-search's LLM Card Scoring AI assessment.
 *
 * The Debate Editor upstream reason-editor was ported from calls Anthropic
 * directly from the browser with a user-pasted API key. debate-ai.com is a
 * shared multi-tenant app, so instead callers hit this route and the
 * server holds the one Anthropic key (ANTHROPIC_API_KEY).
 *
 * Requests need a signed-in account, except free ones (`free: true`, run on
 * OpenRouter's free models). A signed-out caller that sends `free` or
 * `allowGuest` is served as a free request, metered per IP at the free plan's
 * limit, so the docs' Suggest questions works without forcing a sign-in.
 *
 * Metered by plan tier (`@debate-ai/webview/src/lib/stripe/limits.ts`): each request counts toward
 * the caller's `llmRequestsPerDay`, and `maxTokens` is capped at the tier's
 * `llmMaxTokens`. A caller who sends their own OpenRouter or Anthropic key
 * (`x-user-ai-key`, `lib/ai/provider-key.ts`) is billed on it instead, under
 * the spending limit they set with their provider, so neither plan limit
 * applies — only `MAX_TOKENS_CAP`.
 *
 * The call itself goes through write-language's provider factory
 * (`lib/ai/write-language-chat.ts`), which sends each provider its own auth
 * header and translates the Anthropic-shaped body for OpenRouter.
 */

const ANTHROPIC_MODEL = "claude-sonnet-4-6"
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6"
const OPENROUTER_FREE_MODEL = "openrouter/free"
const MAX_TOKENS_CAP = 16384
const MAX_REQUEST_CHARS = 400_000

type AnthropicMessage = ChatMessage

interface ReasonAiRequestBody {
  system?: string
  messages?: AnthropicMessage[]
  maxTokens?: number
  temperature?: number
  free?: boolean
  /**
   * Serve a signed-out caller as a free request instead of answering 401
   * (the docs' Suggest questions and Ask). Signed-in callers are unaffected.
   */
  allowGuest?: boolean
}

function requestSize(messages: AnthropicMessage[], system?: string): number {
  let size = system?.length ?? 0
  for (const m of messages) {
    if (typeof m.content === "string") {
      size += m.content.length
    } else {
      for (const block of m.content) {
        size += block.type === "text" ? block.text.length : block.source.data.length
      }
    }
  }
  return size
}

export async function POST(request: Request) {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  let body: ReasonAiRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  // Signed-out callers may only make free requests, or ask to be served as
  // one (`allowGuest`: the docs' Suggest questions and Ask, so they work
  // without forcing a sign-in). Those run on OpenRouter's free models and are
  // metered per IP at the free plan's daily limit.
  const userId = session?.user.id ?? null
  if (!userId && !body.free && !body.allowGuest) {
    return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 })
  }
  const free = body.free === true || !userId

  const ownKey = parseOwnKeyHeader(request)

  // Free requests (video speech detection and summaries) run on OpenRouter's
  // free models. They go out on the caller's own key when they supplied one,
  // else on the shared keys in turn, so one rejected shared key (OpenRouter's
  // 401 "User not found") falls through to the next instead of failing.
  const candidates: ProviderKey[] = free
    ? [...(ownKey ? [ownKey] : []), ...sharedProviderKeys()]
    : [resolveProviderKey(request)].filter((k): k is ProviderKey => k !== null)
  const providerKey = candidates[0]
  if (!providerKey) {
    return NextResponse.json(
      { error: "AI features are not configured on the server." },
      { status: 503 },
    )
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "`messages` must be a non-empty array." }, { status: 400 })
  }
  const messages = body.messages as AnthropicMessage[]
  if (requestSize(messages, body.system) > MAX_REQUEST_CHARS) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 })
  }

  let tierMaxTokens = MAX_TOKENS_CAP
  if (!providerKey.own) {
    const db = await getDBFromContext()
    const tier = await getUserTier(db, userId)
    const limits = limitsFor(tier)
    const usage = await consumeDailyUsage(db, usageSubject(userId, request), "llmRequests", limits)
    if (!usage.allowed) {
      return NextResponse.json(
        { error: limitMessage("llmRequests", usage, tier), limit: usage.limit, tier },
        { status: 429, headers: planLimitHeaders("llmRequests") },
      )
    }
    tierMaxTokens = limits.llmMaxTokens
  }

  const maxTokens = Math.min(body.maxTokens ?? 1024, MAX_TOKENS_CAP, tierMaxTokens)

  let reply: WriteLanguageChatReply | null = null
  let failure: WriteLanguageChatError | null = null
  let failedKey = providerKey
  for (const key of candidates) {
    try {
      reply = await writeLanguageChat({
        key,
        model: modelFor(key, free),
        system: body.system,
        messages,
        maxTokens,
        temperature: body.temperature,
      })
      break
    } catch (e) {
      failure = e instanceof WriteLanguageChatError ? e : new WriteLanguageChatError(String(e), 502, "")
      failedKey = key
      // Only a rejected shared key falls through: the next one is metered the same.
      if (key.own || !isAuthError(failure)) break
    }
  }

  if (!reply) {
    const status = failure?.status ?? 502
    const exhausted = keyExhaustedResponse(failedKey, status, failure?.detail ?? "")
    if (exhausted) return exhausted
    return NextResponse.json(
      { error: failure?.message ?? "AI request failed." },
      { status: status >= 400 && status < 500 ? status : 502 },
    )
  }

  if (!reply.text) {
    return NextResponse.json({ error: "AI API returned an empty response." }, { status: 502 })
  }

  return NextResponse.json({ text: reply.text, stopReason: reply.stopReason })
}

/** The model each provider is asked for: OpenRouter's free router for free requests. */
function modelFor(key: ProviderKey, free: boolean): string {
  if (key.provider === "openrouter") return free ? OPENROUTER_FREE_MODEL : OPENROUTER_MODEL
  return ANTHROPIC_MODEL
}
