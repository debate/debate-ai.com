// @vitest-environment jsdom
/**
 * @fileoverview `CommentSection` mounted for real: it fetches its own thread on
 * mount, posts, replies, and likes.
 *
 * These are the parts of the feature `renderToStaticMarkup` cannot reach — a
 * fetch resolving, a reply landing under its parent, a like rolling back when
 * the request fails — and each of them is a way for the UI to disagree with the
 * database. The rule they all follow: what the reader sees is what the server
 * said, and a failed request leaves the thread as it was rather than half
 * changed.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import { CommentSection } from "../src/CommentSection";
import type { Comment, CommentThreadResponse } from "../src/types";
import {
  button,
  click,
  composerButton,
  find,
  findAll,
  focus,
  mount,
  type,
  type Mounted,
} from "./helpers/mount";

const VIEWER = { id: "ana", name: "Ana Ruiz", imageUrl: null };

function comment(overrides: Partial<Comment> & Pick<Comment, "id" | "parentId">): Comment {
  return {
    resourceType: "video",
    resourceId: "v1",
    body: `body ${overrides.id}`,
    author: { id: `user-${overrides.id}`, name: `Author ${overrides.id}`, imageUrl: null },
    likeCount: 0,
    viewerHasLiked: false,
    createdAt: Date.UTC(2026, 0, 2, 12),
    deletedAt: null,
    replies: [],
    ...overrides,
  };
}

const ROOT = comment({ id: "r1", parentId: null, body: "the root" });
const REPLY = comment({ id: "r1a", parentId: "r1", body: "the reply" });

interface StubRoute {
  status?: number;
  body: unknown;
}

/**
 * A `fetch` that answers by route, and records every call. The routes are
 * matched by the URL's shape, so a test says what it means rather than
 * enumerating query strings.
 */
function stubFetch(routes: {
  thread: CommentThreadResponse | StubRoute;
  post?: StubRoute;
  like?: StubRoute;
}) {
  const calls: string[] = [];

  const resolve = (route: CommentThreadResponse | StubRoute) => {
    const status = "status" in route ? (route.status ?? 200) : 200;
    const body = "body" in route ? route.body : route;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  };

  const impl = vi.fn(async (url: string | URL | Request) => {
    const href = String(url);
    calls.push(href);
    if (href.includes("/like")) return resolve(routes.like ?? { body: { liked: true, likeCount: 1 } });
    if (href.endsWith("/api/comments") && calls.filter((call) => !call.includes("/like")).length > 1) {
      return resolve(routes.post ?? { body: comment({ id: "new", parentId: null, body: "posted" }) });
    }
    return resolve(routes.thread);
  });

  return { impl: impl as unknown as typeof fetch, calls };
}

let mounted: Mounted | undefined;

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
});

/** Mounts a section for `v1` with the given stubbed API. */
async function mountSection(
  routes: Parameters<typeof stubFetch>[0],
  props: { onSignIn?: () => void } = {},
) {
  const { impl, calls } = stubFetch(routes);
  const element = () =>
    createElement(CommentSection, {
      resourceType: "video" as const,
      resourceId: "v1",
      // An inline object on purpose: a caller writing this must not put the
      // section into a refetch loop.
      clientOptions: { fetchImpl: impl },
      ...props,
    });

  mounted = await mount(element());
  return { ...mounted, calls, render: element };
}

describe("CommentSection", () => {
  it("shows a loading state, then the thread it fetched", async () => {
    const { container } = await mountSection({
      thread: { comments: [ROOT], viewer: VIEWER, totalCount: 1, truncated: false },
    });

    expect(container.textContent).toContain("the root");
    // The header count counts replies, not just the rows at the top level.
    expect(container.textContent).toContain("Comments1");
  });

  it("fetches once, however many times its parent re-renders it", async () => {
    const { container, calls, render } = await mountSection({
      thread: { comments: [], viewer: VIEWER, totalCount: 0, truncated: false },
    });

    await mounted!.rerender(render());
    await mounted!.rerender(render());
    await mounted!.rerender(render());

    // `clientOptions` is a new object each render. If the reload were keyed on
    // its identity, this would be four requests and climbing.
    expect(calls).toHaveLength(1);
    expect(container.textContent).toContain("No comments yet");
  });

  it("fetches the thread it is pointed at", async () => {
    const { calls } = await mountSection({
      thread: { comments: [], viewer: VIEWER, totalCount: 0, truncated: false },
    });

    expect(calls[0]).toContain("resourceType=video");
    expect(calls[0]).toContain("resourceId=v1");
  });

  it("shows a sign-in prompt instead of a composer when signed out", async () => {
    const { container } = await mountSection({
      thread: { comments: [ROOT], viewer: null, totalCount: 1, truncated: false },
    });

    expect(container.textContent).toContain("Sign in");
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("uses the host's sign-in when it is given one", async () => {
    const onSignIn = vi.fn();
    const { container } = await mountSection(
      { thread: { comments: [ROOT], viewer: null, totalCount: 1, truncated: false } },
      { onSignIn },
    );

    await click(button(container, "Sign in"));
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it("gives a signed-in reader a composer, revealed once they touch it", async () => {
    const { container } = await mountSection({
      thread: { comments: [], viewer: VIEWER, totalCount: 0, truncated: false },
    });

    // Quiet on arrival: the box is there, but its buttons are not. A page
    // should not open with a wall of empty input.
    expect(findAll(container, "textarea")).toHaveLength(1);
    expect(container.textContent).not.toContain("Cancel");

    await focus(find<HTMLTextAreaElement>(container, "textarea"));
    await type(find<HTMLTextAreaElement>(container, "textarea"), "nice round");
    expect(button(container, "Comment")).toBeDefined();
  });

  it("puts a new top-level comment at the top of the thread", async () => {
    const { container } = await mountSection({
      thread: { comments: [ROOT], viewer: VIEWER, totalCount: 1, truncated: false },
      post: { body: comment({ id: "new", parentId: null, body: "just posted" }) },
    });

    const composer = find<HTMLTextAreaElement>(container, "textarea");
    await focus(composer);
    await type(composer, "just posted");
    await click(button(container, "Comment"));

    const bodies = findAll(container, "li p").map((node) => node.textContent);
    expect(bodies[0]).toBe("just posted");
    expect(bodies).toContain("the root");
  });

  it("puts a reply under the comment it answers, and opens the thread to it", async () => {
    const { container } = await mountSection({
      thread: {
        comments: [{ ...ROOT, replies: [REPLY] }],
        viewer: VIEWER,
        totalCount: 2,
        truncated: false,
      },
      post: { body: comment({ id: "r1b", parentId: "r1", body: "a new reply" }) },
    });

    // A root's replies start open, so the reply box opens beside them.
    expect(container.textContent).toContain("Hide replies");

    // A row's "Reply" action and its composer's "Reply" submit share a label,
    // and so does every other row's — the composer's own container is what
    // tells them apart.
    await click(button(container, "Reply"));
    const composer = findAll<HTMLTextAreaElement>(container, "textarea").at(-1)!;
    await type(composer, "a new reply");
    await click(composerButton(composer, "Reply"));

    expect(container.textContent).toContain("a new reply");
    // Two replies now: the one that came with the thread, and the new one.
    expect(findAll(container, "li").length).toBe(3);
    expect(container.querySelector("h2")?.textContent).toContain("3");
  });

  it("opens a collapsed thread so a reply posted into it is visible", async () => {
    const collapsed: Comment = { ...ROOT, replies: [REPLY] };
    const { container } = await mountSection({
      thread: { comments: [collapsed], viewer: VIEWER, totalCount: 2, truncated: false },
      post: { body: comment({ id: "r1b", parentId: "r1", body: "a new reply" }) },
    });

    // Start from a collapsed thread by collapsing it.
    await click(button(container, "Hide replies"));
    expect(container.textContent).not.toContain("the reply");

    await click(button(container, "Reply"));
    const composer = findAll<HTMLTextAreaElement>(container, "textarea").at(-1)!;
    await type(composer, "a new reply");
    await click(composerButton(composer, "Reply"));

    // Posted into a thread the reader had collapsed, so posting has to open it
    // — a reply that lands where nobody can see it reads as a lost post.
    expect(container.textContent).toContain("a new reply");
    expect(container.textContent).toContain("Hide replies");
  });

  it("likes optimistically, then settles on the count the server reports", async () => {
    const { container } = await mountSection({
      thread: { comments: [ROOT], viewer: VIEWER, totalCount: 1, truncated: false },
      like: { body: { liked: true, likeCount: 12 } },
    });

    await click(button(container, "Like Author"));

    expect(button(container, "Remove your like")).toBeDefined();
    expect(container.textContent).toContain("12");
  });

  it("puts a failed like back the way it was", async () => {
    const { container } = await mountSection({
      thread: { comments: [ROOT], viewer: VIEWER, totalCount: 1, truncated: false },
      like: { status: 500, body: { error: "Could not update your like." } },
    });

    await click(button(container, "Like Author"));

    // The heart is un-pressed again, and the reader is told why.
    expect(button(container, "Like Author")).toBeDefined();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not update your like.",
    );
  });

  it("turns a deleted comment into a tombstone, keeping its replies", async () => {
    const { container } = await mountSection({
      thread: {
        comments: [{ ...ROOT, author: { id: "ana", name: "Ana Ruiz", imageUrl: null }, replies: [REPLY] }],
        viewer: VIEWER,
        totalCount: 2,
        truncated: false,
      },
    });

    expect(button(container, "Delete your comment")).toBeDefined();
    await click(button(container, "Delete your comment"));

    expect(container.textContent).toContain("This comment was deleted.");
    expect(container.textContent).not.toContain("the root");
    // The sub-conversation outlives the post.
    expect(container.textContent).toContain("the reply");
  });

  it("says so when a thread is longer than one response can carry", async () => {
    const { container } = await mountSection({
      thread: { comments: [ROOT], viewer: VIEWER, totalCount: 500, truncated: true },
    });

    expect(container.textContent).toContain("longer than one page");
  });

  it("offers a retry when the thread could not be loaded", async () => {
    const { container } = await mountSection({
      thread: { status: 503, body: { error: "The database is missing tables." } },
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("The database is missing tables.");
    expect(button(container, "Try again")).toBeDefined();
  });
});
