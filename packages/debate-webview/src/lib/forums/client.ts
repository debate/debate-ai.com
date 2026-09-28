/**
 * @fileoverview The browser half of the forum API — the three calls the forum
 * pages make, and nothing else.
 *
 * Every call returns a typed result or throws an `Error` carrying a message fit
 * to show the reader, so a component never has to inspect a `Response`. Reading
 * the feed needs no session: a signed-out reader gets the threads and a
 * `viewer` of `null`, which is what swaps the new-thread form for a sign-in
 * prompt.
 *
 * Replies are not here. They are comments, so a thread page posts them through
 * `debate-comments`' client and renders them with its `CommentSection` — which
 * is the whole reason forum threads hang off the `comments` table.
 *
 * @module lib/forums/client
 */

import {
  DEFAULT_FEED_LIMIT,
  MAX_FEED_LIMIT,
  MAX_THREAD_BODY_LENGTH,
  MAX_THREAD_TITLE_LENGTH,
  type ForumFeedResponse,
  type ForumThreadDetail,
} from "./types";

/** Where the forum API lives. Overridable so a host can mount it elsewhere. */
const DEFAULT_BASE_PATH = "/api/forums";

export interface ForumClientOptions {
  /** Prefix for the API routes. Defaults to `/api/forums`. */
  basePath?: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface ForumFeedQuery extends ForumClientOptions {
  /** Page size; clamped here as well as on the server, so a bad value costs a request, not a 400. */
  limit?: number;
  /** Where to resume, from a previous response's `nextCursor`. */
  cursor?: string | null;
}

export interface NewThread extends ForumClientOptions {
  title: string;
  body: string;
}

/** Everything `fetch` is allowed to be blamed for, said the way a reader should read it. */
async function errorFrom(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload?.error === "string" && payload.error.length > 0) {
      return new Error(payload.error);
    }
  } catch {
    // A non-JSON error body (a proxy's HTML 502, an empty 500) is not worth
    // parsing twice; the fallback already says something useful.
  }
  return new Error(fallback);
}

function requester(options: ForumClientOptions | undefined) {
  const basePath = options?.basePath ?? DEFAULT_BASE_PATH;
  const doFetch = options?.fetchImpl ?? globalThis.fetch.bind(globalThis);
  return async <T>(path: string, init?: RequestInit, fallback?: string): Promise<T> => {
    const response = await doFetch(`${basePath}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      throw await errorFrom(response, fallback ?? `Request failed (${response.status}).`);
    }
    return (await response.json()) as T;
  };
}

/** One page of the forum, plus who the server thinks is reading it. */
export async function fetchForumThreads({
  limit = DEFAULT_FEED_LIMIT,
  cursor,
  ...options
}: ForumFeedQuery): Promise<ForumFeedResponse> {
  const request = requester(options);
  // Clamped exactly as the server clamps it, so the two never disagree about
  // what page two is: a limit of 0 is one thread on both sides, and a nonsense
  // one is the default on both.
  const requested = Math.floor(Number(limit));
  const size = Number.isFinite(requested)
    ? Math.min(Math.max(1, requested), MAX_FEED_LIMIT)
    : DEFAULT_FEED_LIMIT;
  const query = new URLSearchParams({ limit: String(size) });
  if (cursor) query.set("cursor", cursor);

  return request<ForumFeedResponse>(
    `?${query.toString()}`,
    undefined,
    "Could not load the latest news.",
  );
}

/** One thread, opening post whole. */
export async function fetchForumThread(
  threadId: string,
  options: ForumClientOptions = {},
): Promise<ForumThreadDetail> {
  const request = requester(options);
  return request<ForumThreadDetail>(
    `/${encodeURIComponent(threadId)}`,
    undefined,
    "Could not load that thread.",
  );
}

/** Opens a thread, and returns it as the feed will show it. */
export async function createForumThread({
  title,
  body,
  ...options
}: NewThread): Promise<ForumThreadDetail> {
  const request = requester(options);
  return request<ForumThreadDetail>(
    "",
    {
      method: "POST",
      // Sent trimmed: the server trims anyway, and trimming here means the
      // character counter a reader is watching counts what will be stored.
      body: JSON.stringify({ title: title.trim(), body: body.trim() }),
    },
    "Could not post your thread.",
  );
}

export { MAX_THREAD_BODY_LENGTH, MAX_THREAD_TITLE_LENGTH };
