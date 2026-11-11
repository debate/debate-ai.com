import type { ProviderKey } from "@/lib/ai/provider-key"
import { EmptyReplyError, WriteLanguageChatError, isAuthError } from "@/lib/ai/write-language-chat"

/**
 * Runs one AI call over a list of keys in order — the caller's own key first
 * (when they saved one), then the site's shared keys — until one answers.
 *
 * - The caller's own key falls through to the shared keys on **any** failure
 *   when `ownFallsThrough` is set (free requests: the watch page's speech
 *   summaries and Detect speeches), so a mistyped, revoked or empty own key
 *   still gets an answer from the site key instead of an error.
 * - A shared key only falls through to the next shared key when the provider
 *   rejected the key itself (401/403) or answered with no text
 *   (`EmptyReplyError`); anything else is the answer.
 * - `beforeShared` runs once, just before the first shared key is tried — the
 *   place to meter the plan's daily limit, which an own-key answer never
 *   counts against. Returning a value stops there with that value.
 */
export type KeyFallbackResult<T, S> =
  | { kind: "reply"; reply: T; key: ProviderKey; ownFailure: WriteLanguageChatError | null }
  | { kind: "failed"; failure: WriteLanguageChatError; key: ProviderKey; ownFailure: WriteLanguageChatError | null }
  | { kind: "stopped"; stop: S; ownFailure: WriteLanguageChatError | null }

export interface KeyFallbackOptions<S> {
  ownFallsThrough?: boolean
  beforeShared?: () => Promise<S | null | undefined>
}

function asChatError(e: unknown): WriteLanguageChatError {
  return e instanceof WriteLanguageChatError ? e : new WriteLanguageChatError(String(e), 502, "")
}

export async function tryKeysInTurn<T, S = never>(
  keys: ProviderKey[],
  call: (key: ProviderKey) => Promise<T>,
  { ownFallsThrough = false, beforeShared }: KeyFallbackOptions<S> = {},
): Promise<KeyFallbackResult<T, S>> {
  if (keys.length === 0) throw new Error("tryKeysInTurn needs at least one key")
  let ownFailure: WriteLanguageChatError | null = null
  let metered = false
  let last: { failure: WriteLanguageChatError; key: ProviderKey } | null = null

  for (const key of keys) {
    if (!key.own && !metered) {
      metered = true
      const stop = beforeShared ? await beforeShared() : null
      if (stop !== null && stop !== undefined) return { kind: "stopped", stop, ownFailure }
    }
    try {
      return { kind: "reply", reply: await call(key), key, ownFailure }
    } catch (e) {
      const failure = asChatError(e)
      last = { failure, key }
      if (key.own) {
        ownFailure = failure
        if (!ownFallsThrough) break
      } else if (!isAuthError(failure) && !(failure instanceof EmptyReplyError)) {
        break
      }
    }
  }

  return { kind: "failed", failure: last!.failure, key: last!.key, ownFailure }
}
