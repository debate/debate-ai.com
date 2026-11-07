import { APICallError, generateText, type ModelMessage } from "ai"
import { createLLMProvider } from "write-language"
import type { ProviderKey } from "@/lib/ai/provider-key"

/**
 * One chat call to OpenRouter or Anthropic through write-language's provider
 * factory (Vercel AI SDK under the hood), for the AI routes that take an
 * Anthropic-shaped `{ system, messages }` body.
 *
 * Going through the SDK rather than a hand-rolled `fetch` means the key goes
 * out in the header each provider expects, the system prompt and image blocks
 * are translated for Chat Completions, and a provider error comes back as an
 * `APICallError` with its status and message.
 */

export type ChatContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }

export interface ChatMessage {
  role: "user" | "assistant"
  content: string | ChatContentBlock[]
}

export interface WriteLanguageChatRequest {
  key: ProviderKey
  model: string
  system?: string
  messages: ChatMessage[]
  maxTokens: number
  temperature?: number
  /** Gives up on the call (e.g. a time limit); surfaces as a network error. */
  abortSignal?: AbortSignal
  /** Per-provider options passed through to the SDK, e.g. `{ openrouter: { reasoning: { effort: "low" } } }`. */
  providerOptions?: Record<string, Record<string, unknown>>
}

export interface WriteLanguageChatReply {
  text: string
  /** Anthropic's names, so callers' `stopReason === "max_tokens"` checks keep working. */
  stopReason?: string
  /** The model's thinking, when it sent any (reasoning models on OpenRouter's free router). */
  reasoningText?: string
}

/** A provider refusal or network failure, with the HTTP status the route should answer. */
export class WriteLanguageChatError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The provider's own message, for `keyExhaustedResponse`. */
    readonly detail: string,
  ) {
    super(message)
  }
}

/**
 * The provider answered, but with no text — typically a reasoning model on
 * OpenRouter's free router that spent its whole output budget thinking. Worth
 * asking again (the router may pick another model) or on the next key.
 */
export class EmptyReplyError extends WriteLanguageChatError {
  constructor(readonly stopReason?: string) {
    super(
      stopReason === "max_tokens"
        ? "AI API returned an empty response (the model used its whole token budget thinking)."
        : "AI API returned an empty response.",
      502,
      "",
    )
  }
}

/** True when the provider rejected the key itself, so another key is worth trying. */
export function isAuthError(error: unknown): boolean {
  return error instanceof WriteLanguageChatError && (error.status === 401 || error.status === 403)
}

function toModelMessage(m: ChatMessage): ModelMessage {
  if (typeof m.content === "string") return { role: m.role, content: m.content } as ModelMessage
  if (m.role === "assistant") {
    return {
      role: "assistant",
      content: m.content.filter((b) => b.type === "text").map((b) => ({ type: "text" as const, text: b.text })),
    }
  }
  return {
    role: "user",
    content: m.content.map((block) =>
      block.type === "text"
        ? { type: "text" as const, text: block.text }
        : { type: "image" as const, image: block.source.data, mediaType: block.source.media_type },
    ),
  }
}

function providerName(key: ProviderKey): string {
  return key.provider === "openrouter" ? "OpenRouter" : "Anthropic"
}

export async function writeLanguageChat(req: WriteLanguageChatRequest): Promise<WriteLanguageChatReply> {
  const llm = createLLMProvider(req.key.provider, req.key.key, req.model, req.temperature ?? 1)
  if (!llm) throw new WriteLanguageChatError(`Unsupported AI provider "${req.key.provider}".`, 500, "")

  let result: Awaited<ReturnType<typeof generateText>>
  try {
    result = await generateText({
      model: llm,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages.map(toModelMessage),
      maxOutputTokens: req.maxTokens,
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
      ...(req.abortSignal ? { abortSignal: req.abortSignal } : {}),
      ...(req.providerOptions ? { providerOptions: req.providerOptions as never } : {}),
      // The routes answer the caller with the provider's error; retrying a bad key is pointless.
      maxRetries: 0,
    })
  } catch (error) {
    if (APICallError.isInstance(error)) {
      const status = error.statusCode ?? 502
      const detail = providerMessage(error)
      const hint =
        status === 401 && !req.key.own
          ? ` (${providerName(req.key)} rejected the server's ${req.key.provider === "openrouter" ? "OPENROUTER_API_KEY" : "ANTHROPIC_API_KEY"} — it is revoked, mistyped or from a deleted account)`
          : ""
      throw new WriteLanguageChatError(`AI API returned ${status}${detail ? `: ${detail}` : ""}${hint}`, status, detail)
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new WriteLanguageChatError(`Network error contacting AI provider: ${message}`, 502, message)
  }

  const fr = result.finishReason
  return {
    text: result.text,
    stopReason: fr === "length" ? "max_tokens" : fr === "stop" ? "end_turn" : fr,
    ...(result.reasoningText ? { reasoningText: result.reasoningText } : {}),
  }
}

/** `{ error: { message } }` from the response body, else the SDK's message. */
function providerMessage(error: APICallError): string {
  try {
    const body = JSON.parse(error.responseBody ?? "") as { error?: { message?: string } }
    if (body?.error?.message) return body.error.message
  } catch {
    // Body wasn't JSON.
  }
  return error.message
}
