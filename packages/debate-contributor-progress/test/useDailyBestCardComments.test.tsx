// @vitest-environment jsdom
/**
 * @fileoverview Tests for `hooks/useDailyBestCardComments.ts` — the local
 * comment store plus its one-time, module-level account merge. Each test
 * re-imports the hook after `vi.resetModules()` so the module-level
 * "remote available" flag and shared merge promise start fresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import type { UseDailyBestCardCommentsResult } from "../src/hooks/useDailyBestCardComments";
import type { DailyBestCardComment } from "../src/state/dailyBestCardComments";
import { flush, mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;

let latest: UseDailyBestCardCommentsResult;
let view: Mounted;
let fetchMock: FetchMock;

async function load() {
  vi.resetModules();
  const hooks = await import("../src/hooks/useDailyBestCardComments");
  const state = await import("../src/state/dailyBestCardComments");
  function Harness() {
    latest = hooks.useDailyBestCardComments();
    return null;
  }
  return { Harness, state };
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal("fetch", fetchMock);
}

const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method).map(([url]) => String(url));

const remoteComment: DailyBestCardComment = {
  id: "remote-1",
  dayKey: "2026-05-01",
  authorId: "remote-author",
  text: "Synced from the account",
  postedAt: 1,
} as DailyBestCardComment;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useDailyBestCardComments signed out", () => {
  it("reads, posts and deletes locally without touching the account", async () => {
    stubFetch(() => new Response(null, { status: 401 }));
    const { Harness, state } = await load();
    state.postDailyBestCardComment({ dayKey: "2026-05-01", authorId: "a", text: "Existing" });

    view = await mount(createElement(Harness));
    await flush(async () => {});
    expect(latest.synced).toBe(false);
    expect(latest.comments?.map((c) => c.text)).toEqual(["Existing"]);
    expect(latest.commentsForDay("2026-05-01").map((c) => c.text)).toEqual(["Existing"]);
    expect(latest.commentsForDay("2026-05-02")).toEqual([]);

    await flush(() => latest.postComment("2026-05-02", "b", "New one"));
    expect(latest.comments?.map((c) => c.text)).toEqual(["Existing", "New one"]);

    const id = latest.comments![0].id;
    await flush(() => latest.deleteComment(id));
    expect(latest.comments?.map((c) => c.text)).toEqual(["New one"]);

    // Another tab writes directly to storage; refreshComments re-reads it.
    state.postDailyBestCardComment({ dayKey: "2026-05-03", authorId: "c", text: "Other tab" });
    await flush(() => latest.refreshComments());
    expect(latest.comments?.map((c) => c.text)).toEqual(["New one", "Other tab"]);

    expect(calls("PUT")).toEqual([]);
    expect(calls("DELETE")).toEqual([]);
  });

  it("treats a failed account load as signed out", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "down" }), { status: 500 }));
    const { Harness } = await load();
    view = await mount(createElement(Harness));
    await flush(async () => {});
    expect(latest.synced).toBe(false);
    expect(latest.comments).toEqual([]);
  });
});

describe("useDailyBestCardComments signed in", () => {
  it("adopts remote-only comments, uploads local-only ones, and syncs posts and deletes", async () => {
    stubFetch((_url, init) => {
      if (!init?.method) return new Response(JSON.stringify([remoteComment]));
      return new Response("{}");
    });
    const { Harness, state } = await load();
    const local = state.postDailyBestCardComment({ dayKey: "2026-05-01", authorId: "me", text: "Local only" });

    view = await mount(createElement(Harness));
    await flush(async () => {});

    expect(latest.synced).toBe(true);
    expect(latest.comments?.map((c) => c.id).sort()).toEqual([local.id, "remote-1"].sort());
    expect(calls("PUT")).toEqual([`/api/daily-best-card-comments/${encodeURIComponent(local.id)}`]);

    await flush(() => latest.postComment("2026-05-02", "me", "Posted while synced"));
    const posted = latest.comments!.find((c) => c.text === "Posted while synced")!;
    expect(calls("PUT")).toContain(`/api/daily-best-card-comments/${encodeURIComponent(posted.id)}`);

    await flush(() => latest.deleteComment("remote-1"));
    expect(calls("DELETE")).toEqual(["/api/daily-best-card-comments/remote-1"]);
    expect(latest.comments?.some((c) => c.id === "remote-1")).toBe(false);
  });

  it("shares one account fetch across mounts and tolerates failed pushes", async () => {
    stubFetch((_url, init) => {
      if (!init?.method) return new Response(JSON.stringify([]));
      return new Response(JSON.stringify({ error: "nope" }), { status: 500 });
    });
    const { Harness, state } = await load();
    state.postDailyBestCardComment({ dayKey: "2026-05-01", authorId: "me", text: "Unsynced" });

    view = await mount(createElement(Harness));
    await flush(async () => {});
    const second = await mount(createElement(Harness));
    await flush(async () => {});
    expect(calls("GET")).toHaveLength(1);
    expect(latest.synced).toBe(true);

    await flush(() => latest.postComment("2026-05-01", "me", "Push fails"));
    await flush(() => latest.deleteComment(latest.comments![0].id));
    await flush(async () => {});
    // Local state still reflects both changes despite the failed pushes.
    expect(latest.comments?.map((c) => c.text)).toEqual(["Push fails"]);
    expect(calls("DELETE")).toHaveLength(1);
    await second.unmount();
  });
});
