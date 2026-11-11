import {
  EmptyReplyError,
  writeLanguageChat,
  type WriteLanguageChatReply,
  type WriteLanguageChatRequest,
} from "@/lib/ai/write-language-chat"
import { OPENROUTER_FREE_MODEL } from "@/lib/ai/provider-key"

/**
 * One chat call that keeps going when the model answers with nothing.
 *
 * OpenRouter's free router (`openrouter/free`) picks a free model per request,
 * and many of them are reasoning models: their thinking counts against the
 * output budget, so a long prompt (the watch page's Detect speeches sends a
 * whole caption track) can end with every token spent thinking and an empty
 * answer. For free-router calls this:
 *
 * - asks for low reasoning effort,
 * - adds `FREE_REASONING_HEADROOM` output tokens on top of what the caller
 *   asked for (free models cost nothing, so the plan's token cap — which
 *   guards paid spend — need not starve the thinking), and
 * - asks again, up to `FREE_ATTEMPTS` times, when the reply is still empty
 *   (the router may pick another model).
 *
 * Any other model is called once. An empty final reply throws
 * `EmptyReplyError`, which `tryKeysInTurn` treats as a reason to try the next
 * key (e.g. the shared Anthropic key).
 */

export { OPENROUTER_FREE_MODEL }
export const FREE_REASONING_HEADROOM = 6000
export const FREE_ATTEMPTS = 3
const MAX_OUTPUT_TOKENS = 16384

export function isFreeRouterCall(req: Pick<WriteLanguageChatRequest, "key" | "model">): boolean {
  return req.key.provider === "openrouter" && req.model === OPENROUTER_FREE_MODEL
}

export async function chatUntilAnswered(
  req: WriteLanguageChatRequest,
  call: (req: WriteLanguageChatRequest) => Promise<WriteLanguageChatReply> = writeLanguageChat,
): Promise<WriteLanguageChatReply> {
  const free = isFreeRouterCall(req)
  const attempt: WriteLanguageChatRequest = free
    ? {
        ...req,
        maxTokens: Math.min(MAX_OUTPUT_TOKENS, req.maxTokens + FREE_REASONING_HEADROOM),
        providerOptions: {
          ...req.providerOptions,
          openrouter: { reasoning: { effort: "low" }, ...req.providerOptions?.openrouter },
        },
      }
    : req
  const attempts = free ? FREE_ATTEMPTS : 1

  let stopReason: string | undefined
  for (let i = 0; i < attempts; i++) {
    if (req.abortSignal?.aborted) break
    const reply = await call(attempt)
    if (reply.text.trim()) return reply
    stopReason = reply.stopReason
  }
  throw new EmptyReplyError(stopReason)
}
