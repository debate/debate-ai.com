/**
 * @fileoverview The browser half of the Topic Sign-ups API. A signed-out read
 * resolves to `null` (the panel then shows a sign-in prompt); every other
 * failure throws an `Error` whose message is fit to show.
 *
 * @module debate-practice-rounds/topic-signups/client
 */

import type { TopicSignupTarget } from "@debate-ai/rankings/src/topics/topic-signup-link"
import type { ActiveTopicsResponse, TopicAction, TopicBoardResponse } from "./types"

export const TOPIC_SIGNUPS_API = "/api/topic-signups"

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: unknown }
    if (typeof payload?.error === "string" && payload.error) return new Error(payload.error)
  } catch {
    // fall through
  }
  return new Error(fallback)
}

function query(target: TopicSignupTarget): string {
  const params = new URLSearchParams({ topic: target.text })
  if (target.format) params.set("format", target.format)
  if (target.source) params.set("source", target.source)
  return params.toString()
}

/** One topic's board, or `null` when signed out. */
export async function fetchTopicBoard(
  target: TopicSignupTarget,
  fetchImpl: typeof fetch = fetch,
): Promise<TopicBoardResponse | null> {
  const response = await fetchImpl(`${TOPIC_SIGNUPS_API}?${query(target)}`, { cache: "no-store" })
  if (response.status === 401) return null
  if (!response.ok) throw await errorFrom(response, "Couldn't load this topic.")
  return (await response.json()) as TopicBoardResponse
}

/** The most active topic boards (public). */
export async function fetchActiveTopics(fetchImpl: typeof fetch = fetch): Promise<ActiveTopicsResponse> {
  const response = await fetchImpl(TOPIC_SIGNUPS_API, { cache: "no-store" })
  if (!response.ok) throw await errorFrom(response, "Couldn't load active topics.")
  return (await response.json()) as ActiveTopicsResponse
}

/** Applies one write and returns the refreshed board. */
export async function postTopicAction(
  target: TopicSignupTarget,
  action: TopicAction,
  fetchImpl: typeof fetch = fetch,
): Promise<TopicBoardResponse> {
  const response = await fetchImpl(TOPIC_SIGNUPS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: target.text, format: target.format, source: target.source, ...action }),
  })
  if (!response.ok) throw await errorFrom(response, "That didn't save. Try again.")
  return (await response.json()) as TopicBoardResponse
}
