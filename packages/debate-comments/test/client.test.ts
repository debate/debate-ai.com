/**
 * @fileoverview The four calls the comment UI makes, driven through an
 * injected `fetch`.
 *
 * The point of the client module being separate from the components is that
 * this is testable without a DOM: what each call sends, what it does with a
 * failed response, and — the part that is easy to get wrong — that an error
 * message from the server is shown to the reader verbatim rather than being
 * replaced by a generic one.
 */

import { describe, it, expect, vi } from "vitest";

import {
  createComment,
  deleteComment,
  fetchCommentThread,
  toggleCommentLike,
} from "../src/client";
import type { CommentThreadResponse } from "../src/types";

/** A `fetch` that records its calls and answers with `body`. */
function stubFetch(body: unknown, init: { ok?: boolean; status?: number; text?: string } = {}) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    calls.push({ url: String(url), init: options });
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => {
        if (init.text) throw new SyntaxError("not json");
        return body;
      },
    } as Response;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const EMPTY_THREAD: CommentThreadResponse = {
  comments: [],
  viewer: null,
  totalCount: 0,
  truncated: false,
};

describe("fetchCommentThread", () => {
  it("addresses the thread by resource type and id", async () => {
    const { impl, calls } = stubFetch(EMPTY_THREAD);

    await fetchCommentThread({ resourceType: "video", resourceId: "abc 123", fetchImpl: impl });

    expect(calls[0].url).toBe("/api/comments?resourceType=video&resourceId=abc+123");
    // A read, not a write: no method, and no JSON content type on a GET.
    expect(calls[0].init?.method).toBeUndefined();
    expect(calls[0].init?.headers).toEqual({});
  });

  it("returns the thread and the viewer as the server sent them", async () => {
    const { impl } = stubFetch({
      ...EMPTY_THREAD,
      viewer: { id: "u1", name: "Ana", imageUrl: null },
    });

    const thread = await fetchCommentThread({
      resourceType: "lecture",
      resourceId: "l1",
      fetchImpl: impl,
    });

    expect(thread.viewer?.name).toBe("Ana");
  });

  it("shows the server's own error message to the reader", async () => {
    const { impl } = stubFetch(
      { error: "This feature is unavailable: the database is missing tables." },
      { ok: false, status: 503 },
    );

    await expect(
      fetchCommentThread({ resourceType: "video", resourceId: "v1", fetchImpl: impl }),
    ).rejects.toThrow(/database is missing tables/);
  });

  it("falls back to a readable message when the failure has no body", async () => {
    // A proxy's HTML 502 is not JSON, and must not surface as "Unexpected
    // token <" in the comments box.
    const { impl } = stubFetch(null, { ok: false, status: 502, text: "<html>bad gateway" });

    await expect(
      fetchCommentThread({ resourceType: "video", resourceId: "v1", fetchImpl: impl }),
    ).rejects.toThrow("Could not load the discussion.");
  });

  it("can be pointed at another base path", async () => {
    const { impl, calls } = stubFetch(EMPTY_THREAD);

    await fetchCommentThread({
      resourceType: "video",
      resourceId: "v1",
      basePath: "/api/host/comments",
      fetchImpl: impl,
    });

    expect(calls[0].url.startsWith("/api/host/comments?")).toBe(true);
  });
});

describe("createComment", () => {
  it("posts a root comment with a null parent", async () => {
    const { impl, calls } = stubFetch({ id: "c1" });

    await createComment({ resourceType: "video", resourceId: "v1", body: "hi", fetchImpl: impl });

    expect(calls[0].url).toBe("/api/comments");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      resourceType: "video",
      resourceId: "v1",
      parentId: null,
      body: "hi",
    });
  });

  it("posts a reply under the comment it answers", async () => {
    const { impl, calls } = stubFetch({ id: "c2" });

    await createComment({
      resourceType: "video",
      resourceId: "v1",
      parentId: "c1",
      body: "no",
      fetchImpl: impl,
    });

    expect(JSON.parse(String(calls[0].init?.body)).parentId).toBe("c1");
  });
});

describe("toggleCommentLike", () => {
  it("posts to the comment's like route and returns the resulting state", async () => {
    const { impl, calls } = stubFetch({ liked: true, likeCount: 4 });

    const result = await toggleCommentLike("c-1", { fetchImpl: impl });

    expect(calls[0].url).toBe("/api/comments/c-1/like");
    expect(calls[0].init?.method).toBe("POST");
    expect(result).toEqual({ liked: true, likeCount: 4 });
  });

  it("escapes an id so it cannot climb out of its own route", async () => {
    const { impl, calls } = stubFetch({ liked: true, likeCount: 1 });

    await toggleCommentLike("a/../b", { fetchImpl: impl });

    expect(calls[0].url).toBe("/api/comments/a%2F..%2Fb/like");
  });
});

describe("deleteComment", () => {
  it("deletes by id", async () => {
    const { impl, calls } = stubFetch({ deleted: true });

    await deleteComment("c-1", { fetchImpl: impl });

    expect(calls[0].url).toBe("/api/comments/c-1");
    expect(calls[0].init?.method).toBe("DELETE");
  });
});
