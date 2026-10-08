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
  ConcedeResponse,
  CreateDebateResponse,
  DebateMessage,
  DebateRequestBody,
  DebateVsBotRecord,
  JudgeResponse,
  PhaseTiming,
  StoredPhaseTiming,
} from "../backend/types"
import type { CaseBrief, PrepCard, PrepCaseDocument, PrepareCaseInput } from "../backend/case-prep"

export type { DebateMessage, PhaseTiming, DebateVsBotRecord }

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

async function getJson<T>(path: string, options: VsBotClientOptions, failure: string): Promise<T> {
  const baseUrl = options.baseUrl ?? DEFAULT_VSBOT_BASE_URL
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    credentials: "include",
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
): Promise<ConcedeResponse> {
  const body: ConcedeRequestBody = { debateId, history }
  return postJson<ConcedeResponse>("/concede", body, options, "Failed to concede debate")
}

/** Score a finished round. Returns the judge's raw reply, as upstream did. */
export async function judgeDebate(
  data: { history: DebateMessage[]; debateId?: string },
  options: VsBotClientOptions = {},
): Promise<JudgeResponse> {
  return postJson<JudgeResponse>("/judge", data, options, "Failed to judge debate")
}

/** The signed-in user's past debates, newest first, full transcript included. */
export async function listDebateHistory(options: VsBotClientOptions = {}): Promise<DebateVsBotRecord[]> {
  const result = await getJson<{ debates: DebateVsBotRecord[] }>(
    "/history",
    options,
    "Failed to load debate history",
  )
  return result.debates
}

/**
 * Ask the opponent to prep: turns the cards and caselist outlines found for
 * the topic into a case brief for both sides.
 */
export async function prepareCase(data: PrepareCaseInput, options: VsBotClientOptions = {}): Promise<CaseBrief> {
  const result = await postJson<{ brief: CaseBrief }>("/prep", data, options, "Failed to prepare the case")
  return result.brief
}

/** Where the host app's card search is mounted. */
export const DEFAULT_CARD_SEARCH_URL = "/api/search"

const SEARCH_STOPWORDS = new Set(
  "a an and are as at be by do does for from has have how in is it its of on or should that the this to was we what when which who why will with would".split(" "),
)

/**
 * Turn a topic ("Should social media be regulated?") into a card-search
 * query ("social media regulated"): lower-cased, punctuation and filler
 * words dropped, at most six words. The search ranks cards matching more of
 * them higher, so the words that remain are the ones worth matching.
 */
export function topicSearchQuery(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !SEARCH_STOPWORDS.has(word))
    .slice(0, 6)
    .join(" ")
}

const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

async function searchResults(url: string, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetch(url, { credentials: "include", signal })
    if (!response.ok) return []
    const payload = (await response.json()) as { results?: unknown }
    return Array.isArray(payload.results)
      ? payload.results.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      : []
  } catch (error) {
    if (signal?.aborted) throw error
    return []
  }
}

const str = (value: unknown): string => (typeof value === "string" ? value : "")

export interface FindPrepEvidenceOptions {
  /** The host app's card search. Defaults to `/api/search`. */
  searchUrl?: string
  signal?: AbortSignal
  maxCards?: number
  maxCases?: number
}

/**
 * The opponent's research: search the card corpus and the caselist
 * outlines for the topic. A failed or rate-limited search yields an empty
 * list rather than an error, so prep still produces a brief.
 */
export async function findPrepEvidence(
  topic: string,
  options: FindPrepEvidenceOptions = {},
): Promise<{ cards: PrepCard[]; cases: PrepCaseDocument[] }> {
  const { searchUrl = DEFAULT_CARD_SEARCH_URL, signal, maxCards = 8, maxCases = 4 } = options
  const q = topicSearchQuery(topic)
  if (!q) return { cards: [], cases: [] }
  const query = encodeURIComponent(q)
  const [cardRows, caseRows] = await Promise.all([
    searchResults(`${searchUrl}?q=${query}`, signal),
    searchResults(`${searchUrl}?q=${query}&searchOutlines=1`, signal),
  ])
  const cards: PrepCard[] = cardRows
    .map((r) => ({
      id: r.id == null ? undefined : String(r.id),
      tag: stripHtml(str(r.tag)),
      cite: str(r.cite_short) || str(r.cite) || undefined,
      excerpt: stripHtml(str(r.summary)).slice(0, 300) || undefined,
      side: str(r.side) || undefined,
    }))
    .filter((c) => c.tag)
    .slice(0, maxCards)
  const cases: PrepCaseDocument[] = caseRows
    .map((r) => ({
      id: r.id == null ? undefined : String(r.id),
      title: str(r.tag),
      owner: str(r.cite_short) || undefined,
      side: str(r.side) || undefined,
    }))
    .filter((c) => c.title)
    .slice(0, maxCases)
  return { cards, cases }
}
