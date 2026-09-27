/**
 * @fileoverview The forum UI's three calls, driven through an injected `fetch`.
 *
 * The point of the client being a module of its own is that this is testable
 * without a DOM: what each call sends, what it does with a failed response, and
 * — the part that is easy to get wrong — that the server's own error message is
 * shown to the reader verbatim rather than replaced by a generic one.
 */

import { describe, expect, it, vi } from "vitest";

import { createForumThread, fetchForumThread, fetchForumThreads } from "../../../src/lib/forums/client";
import {
  DEFAULT_FEED_LIMIT,
  MAX_FEED_LIMIT,
  type ForumFeedResponse,
  type ForumThreadDetail,
} from "../../../src/lib/forums/types";

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

const EMPTY_FEED: ForumFeedResponse = { threads: [], viewer: null, nextCursor: null };

const THREAD: ForumThreadDetail = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  title: "Worth a round?",
  excerpt: "Front, please.",
  body: "Front, please.",
  author: { id: "u1", name: "Ada", imageUrl: null },
  replyCount: 0,
  createdAt: 1_700_000_000,
  lastActivityAt: 1_700_000_000,
};

describe("fetchForumThreads", () => {
  it("asks for the default page and sends no cursor on the first read", async () => {
    const { impl, calls } = stubFetch(EMPTY_FEED);

    await fetchForumThreads({ fetchImpl: impl });

    expect(calls[0].url).toBe(`/api/forums?limit=${DEFAULT_FEED_LIMIT}`);
    expect(calls[0].init?.method).toBeUndefined();
    expect(calls[0].init?.headers).toEqual({});
  });

  it("resumes from a cursor when it has one", async () => {
    const { impl, calls } = stubFetch(EMPTY_FEED);

    await fetchForumThreads({ limit: 10, cursor: "MTcwMDAwMDAwMC5hYmM", fetchImpl: impl });

    expect(calls[0].url).toBe("/api/forums?limit=10&cursor=MTcwMDAwMDAwMC5hYmM");
  });

  it("clamps a nonsense page size rather than spending a request on it", async () => {
    const { impl, calls } = stubFetch(EMPTY_FEED);

    await fetchForumThreads({ limit: 0, fetchImpl: impl });
    expect(calls[0].url).toContain(`limit=1`);

    await fetchForumThreads({ limit: 10_000, fetchImpl: impl });
    expect(calls[1].url).toContain(`limit=${MAX_FEED_LIMIT}`);
  });

  it("returns the feed as the server sent it", async () => {
    const { impl } = stubFetch({
      ...EMPTY_FEED,
      viewer: { id: "u1", name: "Ada", imageUrl: null },
    });

    const feed = await fetchForumThreads({ fetchImpl: impl });
    expect(feed.viewer?.name).toBe("Ada");
    expect(feed.threads).toEqual([]);
  });

  it("shows the server's own error message", async () => {
    const { impl } = stubFetch({ error: "That is not a page of the forum." }, { ok: false, status: 400 });

    await expect(fetchForumThreads({ fetchImpl: impl })).rejects.toThrow(
      "That is not a page of the forum.",
    );
  });

  it("falls back to its own wording when the error body is not JSON", async () => {
    const { impl } = stubFetch(null, { ok: false, status: 502, text: "not json" });

    await expect(fetchForumThreads({ fetchImpl: impl })).rejects.toThrow("Could not load the forum.");
  });
});

describe("fetchForumThread", () => {
  it("addresses the thread by id", async () => {
    const { impl, calls } = stubFetch(THREAD);

    await fetchForumThread(THREAD.id, { fetchImpl: impl });

    expect(calls[0].url).toBe(`/api/forums/${THREAD.id}`);
  });

  it("escapes an id it did not expect, rather than splicing it into the path", async () => {
    const { impl, calls } = stubFetch(THREAD);

    await fetchForumThread("a/../b", { fetchImpl: impl });

    expect(calls[0].url).toBe("/api/forums/a%2F..%2Fb");
  });
});

describe("createForumThread", () => {
  it("posts the title and the post as JSON, trimmed", async () => {
    const { impl, calls } = stubFetch(THREAD);

    await createForumThread({ title: "  Worth a round?  ", body: " Front, please. ", fetchImpl: impl });

    expect(calls[0].url).toBe("/api/forums");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      title: "Worth a round?",
      body: "Front, please.",
    });
  });

  it("shows the reason the server refused the post", async () => {
    const { impl } = stubFetch({ error: "A thread needs a title." }, { ok: false, status: 400 });

    await expect(createForumThread({ title: "", body: "x", fetchImpl: impl })).rejects.toThrow(
      "A thread needs a title.",
    );
  });
});
