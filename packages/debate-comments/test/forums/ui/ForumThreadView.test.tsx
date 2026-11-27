// @vitest-environment jsdom
/**
 * @fileoverview `ForumThreadView` mounted for real: it fetches its own thread,
 * shows the opening post, and re-reads the thread when a reply changes it.
 *
 * `CommentSection` has its own suite, so it is stubbed here to a button that
 * reports a change; what matters is that the view mounts it for this thread
 * and re-reads the thread when told something changed.
 */

import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForumThreadView } from "../../../src/forums/ui/ForumThreadView";
import type { ForumThreadDetail } from "../../../src/forums/types";
import { button, click, cleanup, find, flush, mount } from "../../helpers/mount";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const fetchThread = vi.fn();
vi.mock("../../../src/forums/client", () => ({
  fetchForumThread: (...args: unknown[]) => fetchThread(...args),
  toggleForumThreadLike: vi.fn(),
}));

const commentSectionProps = vi.fn();
vi.mock("../../../src/index", async () => {
  const actual = await vi.importActual<typeof import("../../../src/CommentAvatar")>(
    "../../../src/CommentAvatar",
  );
  return {
    CommentAvatar: actual.CommentAvatar,
    CommentSection: (props: { onChanged?: () => void }) => {
      commentSectionProps(props);
      return (
        <button type="button" data-testid="reply-posted" onClick={props.onChanged}>
          reply posted
        </button>
      );
    },
  };
});

function detail(overrides: Partial<ForumThreadDetail> = {}): ForumThreadDetail {
  return {
    id: "t1",
    title: "Is the aff topical?",
    excerpt: "Walk me",
    body: "Walk me through it.\nSlowly.",
    category: "policy",
    author: { id: "u1", name: "Ana Ruiz", imageUrl: null },
    likeCount: 2,
    viewerHasLiked: true,
    replyCount: 1,
    createdAt: 1_700_000_000,
    lastActivityAt: 1_700_000_000,
    ...overrides,
  };
}

describe("ForumThreadView", () => {
  afterEach(async () => {
    await cleanup();
    fetchThread.mockReset();
    commentSectionProps.mockReset();
  });

  it("shows a loading state until the thread arrives", async () => {
    let resolve!: (value: ForumThreadDetail) => void;
    fetchThread.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { container } = await mount(<ForumThreadView threadId="t1" />);
    expect(container.textContent).toContain("Loading thread…");

    await flush(() => resolve(detail()));

    expect(container.textContent).not.toContain("Loading thread…");
    expect(fetchThread).toHaveBeenCalledWith("t1");
  });

  it("renders the opening post with its board, author, reply count and like state", async () => {
    fetchThread.mockResolvedValue(detail());
    const { container } = await mount(<ForumThreadView threadId="t1" />);

    expect(find(container, "h1").textContent).toBe("Is the aff topical?");
    expect(find(container, "article").textContent).toContain("Walk me through it.");
    expect(find(container, "article").textContent).toContain("Ana Ruiz");
    expect(find(container, "article").textContent).toContain("1 reply");
    const chip = find<HTMLAnchorElement>(container, "article a");
    expect(chip.getAttribute("href")).toBe("/news?section=forums&category=policy");
    expect(chip.textContent).toBe("Policy");
    const like = find(container, "article button");
    expect(like.getAttribute("aria-pressed")).toBe("true");
    expect(like.textContent).toBe("2");
  });

  it("links back to the thread's board, and to the whole forum when it has none", async () => {
    fetchThread.mockResolvedValueOnce(detail());
    const board = await mount(<ForumThreadView threadId="t1" />);
    const back = find<HTMLAnchorElement>(board.container, "a");
    expect(back.getAttribute("href")).toBe("/news?section=forums&category=policy");
    expect(back.textContent).toContain("to Policy");

    fetchThread.mockResolvedValueOnce(detail({ category: undefined as never }));
    const none = await mount(<ForumThreadView threadId="t2" />);
    const backAll = find<HTMLAnchorElement>(none.container, "a");
    expect(backAll.getAttribute("href")).toBe("/news?section=forums");
    expect(backAll.textContent).toContain("to Forums");
    expect(none.container.querySelector("article a")).toBeNull();
  });

  it("mounts the reply section for this thread", async () => {
    fetchThread.mockResolvedValue(detail());
    await mount(<ForumThreadView threadId="t1" />);

    expect(commentSectionProps).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "thread",
        resourceId: "t1",
        title: "Replies",
        expandAllReplies: true,
      }),
    );
  });

  it("re-reads the thread without a spinner when a reply changes it", async () => {
    fetchThread.mockResolvedValueOnce(detail({ replyCount: 1 }));
    const { container } = await mount(<ForumThreadView threadId="t1" />);
    expect(container.textContent).toContain("1 reply");

    fetchThread.mockResolvedValueOnce(detail({ replyCount: 2 }));
    await click(find(container, "[data-testid=reply-posted]"));

    expect(fetchThread).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("2 replies");
    expect(container.textContent).not.toContain("Loading thread…");
  });

  it("shows the server's message with a retry and a way back when the load fails", async () => {
    fetchThread.mockRejectedValueOnce(new Error("Thread not found"));
    const { container } = await mount(<ForumThreadView threadId="t1" />);

    expect(find(container, "[role=alert]").textContent).toBe("Thread not found");
    expect(find<HTMLAnchorElement>(container, "a").getAttribute("href")).toBe("/news?section=forums");

    fetchThread.mockResolvedValueOnce(detail());
    await click(button(container, "Try again"));

    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(find(container, "h1").textContent).toBe("Is the aff topical?");
  });

  it("uses a generic message when the failure is not an Error", async () => {
    fetchThread.mockRejectedValueOnce("boom");
    const { container } = await mount(<ForumThreadView threadId="t1" />);
    expect(find(container, "[role=alert]").textContent).toBe("Could not load that thread.");
  });

  it("loads the new thread, with a spinner, when the route changes", async () => {
    fetchThread.mockResolvedValueOnce(detail());
    const view = await mount(<ForumThreadView threadId="t1" />);

    let resolve!: (value: ForumThreadDetail) => void;
    fetchThread.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await view.rerender(<ForumThreadView threadId="t2" />);
    expect(view.container.textContent).toContain("Loading thread…");

    await flush(() => resolve(detail({ id: "t2", title: "Another thread" })));
    expect(find(view.container, "h1").textContent).toBe("Another thread");
    expect(fetchThread).toHaveBeenLastCalledWith("t2");
  });

  it("ignores a response for a thread the reader has already left", async () => {
    let resolveFirst!: (value: ForumThreadDetail) => void;
    fetchThread.mockReturnValueOnce(new Promise((r) => (resolveFirst = r)));
    const view = await mount(<ForumThreadView threadId="t1" />);

    fetchThread.mockResolvedValueOnce(detail({ id: "t2", title: "Second" }));
    await view.rerender(<ForumThreadView threadId="t2" />);
    await flush(() => resolveFirst(detail({ id: "t1", title: "First" })));

    expect(find(view.container, "h1").textContent).toBe("Second");
  });

  it("disables liking for a signed-out reader", async () => {
    fetchThread.mockResolvedValue(detail());
    const { container } = await mount(<ForumThreadView threadId="t1" isAuthenticated={false} />);

    await click(find(container, "article button"));

    expect(find(container, "article button").getAttribute("title")).toBe("Sign in to like threads.");
  });
});
