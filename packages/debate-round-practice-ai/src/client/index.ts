/**
 * @fileoverview Browser client for the vs-bot endpoints — the port of the
 * upstream `frontend/src/services/vsbot.ts`.
 *
 * Two things changed from upstream. The base URL is no longer read from
 * `import.meta.env.VITE_BASE_URL`, since this runs under Next.js: it
 * defaults to the app's own `/api/vsbot` routes and is overridable per call.
 * And the bearer token is gone — debate-ai.com authenticates API routes with
 * a session cookie, which `credentials: "include"` already carries.
 *
 * @module client
 */

import type {
  ConcedeRequestBody,
  CreateDebateResponse,
  DebateMessage,
  DebateRequestBody,
  JudgeResponse,
  PhaseTiming,
  StoredPhaseTiming,
} from "../backend/types"

export type { DebateMessage, PhaseTiming }

/** Where the vs-bot routes are mounted in the host app. */
export const DEFAULT_VSBOT_BASE_URL = "/api/vsbot"

export interface VsBotClientOptions {
  baseUrl?: string
  signal?: AbortSignal
}

/** The client's create payload — phase timings in the single-duration shape. */
export interface CreateDebateInput extends Omit<DebateRequestBody, "phaseTimings"> {
  phaseTimings?: PhaseTiming[]
}

/** The create response, converted back to the single-duration shape. */
export interface CreateDebateResult extends Omit<CreateDebateResponse, "phaseTimings"> {
  phaseTimings?: PhaseTiming[]
}

async function postJson<T>(path: string, body: unknown, options: VsBotClientOptions, failure: string): Promise<T> {
  const baseUrl = options.baseUrl ?? DEFAULT_VSBOT_BASE_URL
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!response.ok) {
    let detail = ""
    try {
      const payload = (await response.json()) as { error?: string }
      detail = payload?.error ? `: ${payload.error}` : ""
    } catch {
      // A non-JSON error body adds nothing beyond the status.
    }
    throw new Error(`${failure}${detail}`)
  }

  return (await response.json()) as T
}

/**
 * Start a debate. Converts the UI's one-duration phase timings into the
 * `userTime`/`botTime` pair the backend stores, and converts the response
 * back — the same round trip the upstream service performed.
 */
export async function createDebate(
  data: CreateDebateInput,
  options: VsBotClientOptions = {},
): Promise<CreateDebateResult> {
  const payload: DebateRequestBody = {
    ...data,
    phaseTimings: data.phaseTimings,
  }
  const result = await postJson<CreateDebateResponse>(
    "/create",
    payload,
    options,
    "Failed to create debate",
  )
  return {
    ...result,
    phaseTimings: result.phaseTimings?.map((pt: StoredPhaseTiming) => ({
      name: pt.name,
      time: pt.userTime,
    })),
  }
}

/** Ask the bot for its next turn. */
export async function sendDebateMessage(
  data: CreateDebateInput & { debateId?: string },
  options: VsBotClientOptions = {},
): Promise<{ response: string }> {
  const result = await postJson<{ response: string }>(
    "/debate",
    data,
    options,
    "Failed to send debate message",
  )
  return { response: result.response }
}

/** Concede the round. Counts as a loss, as it did on the Go server. */
export async function concedeDebate(
  debateId: string,
  history: DebateMessage[] = [],
  options: VsBotClientOptions = {},
): Promise<void> {
  const body: ConcedeRequestBody = { debateId, history }
  await postJson<{ message: string }>("/concede", body, options, "Failed to concede debate")
}

/** Score a finished round. Returns the judge's raw reply, as upstream did. */
export async function judgeDebate(
  data: { history: DebateMessage[]; debateId?: string },
  options: VsBotClientOptions = {},
): Promise<JudgeResponse> {
  return postJson<JudgeResponse>("/judge", data, options, "Failed to judge debate")
}
