// @vitest-environment jsdom
/**
 * @fileoverview `ForumsHub` mounted for real: it reads its board and order off
 * the URL, fetches the feed, pages it by cursor, and files new threads.
 *
 * The forum client is mocked at the module boundary — its own request/response
 * handling is covered in `client.test.ts` — so these tests assert what the
 * page asks for and what it shows for each answer.
 */

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForumsHub } from "../../../src/forums/ui/ForumsHub";
import type {
  ForumFeedResponse,
  ForumThreadSummary,
  ForumViewer,
} from "../../../src/forums/types";
import { button, click, cleanup, find, findAll, flush, mount, setValue } from "../../helpers/mount";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const fetchThreads = vi.fn();
const createThread = vi.fn();
vi.mock("../../../src/forums/client", () => ({
  fetchForumThreads: (...args: unknown[]) => fetchThreads(...args),
  createForumThread: (...args: unknown[]) => createThread(...args),
  toggleForumThreadLike: vi.fn(),
}));

const VIEWER: ForumViewer = { id: "me", name: "Me", imageUrl: null };

function thread(id: string, overrides: Partial<ForumThreadSummary> = {}): ForumThreadSummary {
  return {
    id,
    title: `Thread ${id}`,
    excerpt: `excerpt ${id}`,
    category: "general",
    author: { id: "u1", name: "Ana Ruiz", imageUrl: null },
    likeCount: 0,
    viewerHasLiked: false,
    replyCount: 0,
    createdAt: 1_700_000_000,
    lastActivityAt: 1_700_000_000,
    ...overrides,
  };
}

function feed(
  threads: ForumThreadSummary[],
  overrides: Partial<ForumFeedResponse> = {},
): ForumFeedResponse {
  return { threads, viewer: VIEWER, nextCursor: null, category: null, sort: "active", ...overrides };
}

function titles(container: HTMLElement): string[] {
  return findAll(container, "h3").map((heading) => heading.textContent ?? "");
}

describe("ForumsHub", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/news?section=forums");
  });

  afterEach(async () => {
    await cleanup();
    fetchThreads.mockReset();
    createThread.mockReset();
  });

  it("shows a loading state, then the feed", async () => {
    let resolve!: (value: ForumFeedResponse) => void;
    fetchThreads.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { container } = await mount(<ForumsHub isAuthenticated />);
    expect(container.textContent).toContain("Loading threads…");

    await flush(() => resolve(feed([thread("a"), thread("b")])));

    expect(container.textContent).not.toContain("Loading threads…");
    expect(titles(container)).toEqual(["Thread a", "Thread b"]);
    expect(fetchThreads).toHaveBeenCalledWith({
      limit: 25,
      category: null,
      sort: "active",
    });
  });

  it("opens on the board and order the URL names, over the props", async () => {
    window.history.replaceState(null, "", "/news?section=forums&category=policy&sort=top");
    fetchThreads.mockResolvedValue(feed([thread("a", { category: "policy" })]));

    const { container } = await mount(
      <ForumsHub isAuthenticated initialCategory="college" initialSort="new" />,
    );

    expect(fetchThreads).toHaveBeenCalledTimes(1);
    expect(fetchThreads).toHaveBeenCalledWith({ limit: 25, category: "policy", sort: "top" });
    expect(container.textContent).toContain("Affs, DAs, counterplans, Ks and the topic.");
  });

  it("treats category=all in the URL as every board, and ignores unknown values", async () => {
    window.history.replaceState(null, "", "/news?section=forums&category=all&sort=bogus");
    fetchThreads.mockResolvedValue(feed([thread("a")]));

    await mount(<ForumsHub isAuthenticated initialCategory="college" />);

    expect(fetchThreads).toHaveBeenCalledWith({ limit: 25, category: null, sort: "active" });
  });

  it("falls back to the props when the URL names neither", async () => {
    fetchThreads.mockResolvedValue(feed([]));

    await mount(<ForumsHub isAuthenticated initialCategory="college" initialSort="new" />);

    expect(fetchThreads).toHaveBeenCalledWith({ limit: 25, category: "college", sort: "new" });
  });

  it("refetches from the top and rewrites the query string when the board changes", async () => {
    fetchThreads.mockResolvedValue(feed([thread("a")]));
    const { container } = await mount(<ForumsHub isAuthenticated />);

    fetchThreads.mockResolvedValueOnce(feed([thread("p", { category: "policy" })]));
    await click(button(find(container, "nav"), "Policy"));

    expect(fetchThreads).toHaveBeenLastCalledWith({ limit: 25, category: "policy", sort: "active" });
    expect(titles(container)).toEqual(["Thread p"]);
    expect(new URLSearchParams(window.location.search).get("category")).toBe("policy");
    expect(new URLSearchParams(window.location.search).get("section")).toBe("forums");

    await click(button(find(container, "nav"), "All"));
    expect(new URLSearchParams(window.location.search).has("category")).toBe(false);
  });

  it("refetches when the order changes, keeping the default order out of the URL", async () => {
    fetchThreads.mockResolvedValue(feed([thread("a")]));
    const { container } = await mount(<ForumsHub isAuthenticated />);

    await click(button(find(container, "[role=group]"), "Top"));
    expect(fetchThreads).toHaveBeenLastCalledWith({ limit: 25, category: null, sort: "top" });
    expect(new URLSearchParams(window.location.search).get("sort")).toBe("top");

    await click(button(find(container, "[role=group]"), "Recent activity"));
    expect(new URLSearchParams(window.location.search).has("sort")).toBe(false);
  });

  it("appends the next page from the cursor and hides the button at the end", async () => {
    fetchThreads.mockResolvedValueOnce(feed([thread("a")], { nextCursor: "cur-1" }));
    const { container } = await mount(<ForumsHub isAuthenticated />);

    fetchThreads.mockResolvedValueOnce(feed([thread("b")], { nextCursor: null }));
    await click(button(container, "Load more"));

    expect(fetchThreads).toHaveBeenLastCalledWith({
      limit: 25,
      cursor: "cur-1",
      category: null,
      sort: "active",
    });
    expect(titles(container)).toEqual(["Thread a", "Thread b"]);
    expect(container.textContent).not.toContain("Load more");
  });

  it("keeps the rows and shows the error when loading more fails", async () => {
    fetchThreads.mockResolvedValueOnce(feed([thread("a")], { nextCursor: "cur-1" }));
    const { container } = await mount(<ForumsHub isAuthenticated />);

    fetchThreads.mockRejectedValueOnce(new Error("Rate limited"));
    await click(button(container, "Load more"));

    expect(find(container, "[role=alert]").textContent).toContain("Rate limited");
    expect(titles(container)).toEqual(["Thread a"]);
    expect(button(container, "Load more").disabled).toBe(false);
  });

  it("uses a generic message when loading more fails without an Error", async () => {
    fetchThreads.mockResolvedValueOnce(feed([thread("a")], { nextCursor: "cur-1" }));
    const { container } = await mount(<ForumsHub isAuthenticated />);

    fetchThreads.mockRejectedValueOnce("boom");
    await click(button(container, "Load more"));

    expect(find(container, "[role=alert]").textContent).toContain("Could not load more threads.");
  });

  it("offers a retry when the first load fails", async () => {
    fetchThreads.mockRejectedValueOnce(new Error("Offline"));
    const { container } = await mount(<ForumsHub isAuthenticated />);
    expect(find(container, "[role=alert]").textContent).toContain("Offline");

    fetchThreads.mockResolvedValueOnce(feed([thread("a")]));
    await click(button(container, "Try again"));

    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(titles(container)).toEqual(["Thread a"]);
  });

  it("uses a generic message when the first load fails without an Error", async () => {
    fetchThreads.mockRejectedValueOnce(undefined);
    const { container } = await mount(<ForumsHub isAuthenticated />);
    expect(find(container, "[role=alert]").textContent).toContain("Could not load the forum.");
  });

  it("shows an empty state that depends on the board and on who is reading", async () => {
    window.history.replaceState(null, "", "/news?section=forums&category=policy");
    fetchThreads.mockResolvedValueOnce(feed([]));
    const signedIn = await mount(<ForumsHub isAuthenticated />);
    expect(signedIn.container.textContent).toContain("No threads in Policy yet. Start the first one.");

    window.history.replaceState(null, "", "/news?section=forums");
    fetchThreads.mockResolvedValueOnce(feed([], { viewer: null }));
    const anonymous = await mount(<ForumsHub isAuthenticated={false} />);
    expect(anonymous.container.textContent).toContain(
      "No threads yet. Sign in to start the discussion.",
    );
  });

  it("shows a sign-in prompt instead of the thread form when signed out", async () => {
    fetchThreads.mockResolvedValue(feed([thread("a")], { viewer: null }));
    const { container } = await mount(<ForumsHub isAuthenticated={false} />);

    expect(container.querySelector("form")).toBeNull();
    expect(find<HTMLAnchorElement>(container, "a[href='/login']").textContent).toBe("Sign in");
  });

  it("files a new thread at the top of the feed", async () => {
    fetchThreads.mockResolvedValue(feed([thread("a")]));
    createThread.mockResolvedValue(thread("new", { title: "Brand new" }));
    const { container } = await mount(<ForumsHub isAuthenticated />);

    await setValue(find<HTMLInputElement>(container, "#forum-thread-title"), "Brand new");
    await setValue(find<HTMLTextAreaElement>(container, "#forum-thread-body"), "Body text");
    await flush(() => {
      find(container, "form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(createThread).toHaveBeenCalledWith({
      title: "Brand new",
      body: "Body text",
      category: "general",
    });
    expect(titles(container)).toEqual(["Brand new", "Thread a"]);
  });

  it("does not show a new thread filed under another board in the board being browsed", async () => {
    window.history.replaceState(null, "", "/news?section=forums&category=policy");
    fetchThreads.mockResolvedValue(feed([thread("a", { category: "policy" })]));
    createThread.mockResolvedValue(thread("new", { category: "general" }));
    const { container } = await mount(<ForumsHub isAuthenticated />);

    const select = find<HTMLSelectElement>(container, "form select");
    expect(select.value).toBe("policy");
    await setValue(select, "general");
    await setValue(find<HTMLInputElement>(container, "#forum-thread-title"), "Elsewhere");
    await setValue(find<HTMLTextAreaElement>(container, "#forum-thread-body"), "Body");
    await flush(() => {
      find(container, "form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(createThread).toHaveBeenCalledTimes(1);
    expect(titles(container)).toEqual(["Thread a"]);
  });

  it("updates a row's like state in place when its like button settles", async () => {
    const { toggleForumThreadLike } = await import("../../../src/forums/client");
    vi.mocked(toggleForumThreadLike).mockResolvedValueOnce({ liked: true, likeCount: 1 });
    fetchThreads.mockResolvedValue(feed([thread("a")]));
    const { container } = await mount(<ForumsHub isAuthenticated />);

    await click(find(container, 'button[aria-label$="this thread"]'));

    const like = find(container, 'button[aria-label$="this thread"]');
    expect(like.getAttribute("aria-pressed")).toBe("true");
    expect(like.textContent).toBe("1");
  });
});
