import { NextResponse } from "next/server"
import {
  AI_KEY_NEEDED_HEADER,
  OWN_AI_KEY_HEADER,
  isKeyExhaustedError,
  parseOwnAiKey,
  type AiKeyProvider,
} from "@debate/webview/lib/ai/own-ai-key"
import { getEnv } from "@/lib/env"

/**
 * Which key an AI route calls the model with: the caller's own OpenRouter or
 * Anthropic key when the request carries one (`x-user-ai-key`, see
 * `@debate/webview/src/lib/ai/own-ai-key.ts`), otherwise the site's shared
 * `OPENROUTER_API_KEY` (preferred) or `ANTHROPIC_API_KEY`.
 *
 * `own: true` means the caller pays, under their own provider-side spending
 * limit, so the route skips the daily plan limits. The key is used for this
 * one request only — never stored or logged.
 */
export interface ProviderKey {
  provider: AiKeyProvider
  key: string
  own: boolean
}

export function resolveProviderKey(request: Request): ProviderKey | null {
  const own = parseOwnAiKey(request.headers.get(OWN_AI_KEY_HEADER))
  if (own) return { ...own, own: true }
  const openrouter = getEnv("OPENROUTER_API_KEY")
  if (openrouter) return { provider: "openrouter", key: openrouter, own: false }
  const anthropic = getEnv("ANTHROPIC_API_KEY")
  if (anthropic) return { provider: "anthropic", key: anthropic, own: false }
  return null
}

/**
 * The reply when a provider refused the request because the key is out of
 * credit or past its spending limit. For the shared key it says how to keep
 * going with your own (and sets the header that opens the own-key dialog);
 * for the caller's own key it says to top that key up.
 */
export function keyExhaustedResponse(key: ProviderKey, status: number, detail: string): NextResponse | null {
  if (!isKeyExhaustedError(status, detail)) return null
  const provider = key.provider === "openrouter" ? "OpenRouter" : "Anthropic"
  if (key.own) {
    return NextResponse.json(
      { error: `Your ${provider} key has hit its spending limit or is out of credit. Raise its limit with ${provider}, or remove it in Settings → Preferences to use Debate AI's shared key.` },
      { status: 402 },
    )
  }
  return NextResponse.json(
    { error: "Debate AI's shared AI key has hit its API limit. Add your own OpenRouter or Anthropic key in Settings → Preferences, with whatever spending limit you choose, to keep going." },
    { status: 503, headers: { [AI_KEY_NEEDED_HEADER]: "shared-limit" } },
  )
}
