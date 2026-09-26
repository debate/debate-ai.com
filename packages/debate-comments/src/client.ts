/**
 * @fileoverview The browser half of the comment API — the four calls the
 * discussion UI makes, and nothing else.
 *
 * Every call returns a typed result or throws an `Error` carrying a message
 * fit to show the reader, so the component never has to inspect a `Response`.
 * Reading a thread needs no session: a signed-out reader gets the comments and
 * a `viewer` of `null`, which is what switches the composer for a sign-in
 * prompt.
 *
 * @module client
 */

import type { Comment, CommentResourceType, CommentThreadResponse, CommentViewer } from "./types";

/** Where the comment API lives. Overridable so a host can mount it elsewhere. */
const DEFAULT_BASE_PATH = "/api/comments";

export interface CommentClientOptions {
  /** Prefix for the API routes. Defaults to `/api/comments`. */
  basePath?: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface ThreadQuery extends CommentClientOptions {
  resourceType: CommentResourceType;
  resourceId: string;
}

export interface NewComment extends CommentClientOptions {
  resourceType: CommentResourceType;
  resourceId: string;
  parentId?: string | null;
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

function requester(options: CommentClientOptions | undefined) {
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

/** A resource's whole thread, plus who the server thinks is reading it. */
export async function fetchCommentThread({
  resourceType,
  resourceId,
  ...options
}: ThreadQuery): Promise<CommentThreadResponse> {
  const request = requester(options);
  const query = new URLSearchParams({ resourceType, resourceId });
  return request<CommentThreadResponse>(
    `?${query.toString()}`,
    undefined,
    "Could not load the discussion.",
  );
}

/** Posts a root comment or a reply, and returns the stored comment. */
export async function createComment({
  resourceType,
  resourceId,
  parentId,
  body,
  ...options
}: NewComment): Promise<Comment> {
  const request = requester(options);
  return request<Comment>(
    "",
    {
      method: "POST",
      body: JSON.stringify({ resourceType, resourceId, parentId: parentId ?? null, body }),
    },
    "Could not post your comment.",
  );
}

/** Toggles the viewer's like on a comment, and returns the resulting count. */
export async function toggleCommentLike(
  commentId: string,
  options: CommentClientOptions = {},
): Promise<{ liked: boolean; likeCount: number }> {
  const request = requester(options);
  return request<{ liked: boolean; likeCount: number }>(
    `/${encodeURIComponent(commentId)}/like`,
    { method: "POST" },
    "Could not update your like.",
  );
}

/** Removes one of the viewer's own comments. */
export async function deleteComment(
  commentId: string,
  options: CommentClientOptions = {},
): Promise<void> {
  const request = requester(options);
  await request<{ deleted: boolean }>(
    `/${encodeURIComponent(commentId)}`,
    { method: "DELETE" },
    "Could not delete your comment.",
  );
}

export type { CommentViewer };
