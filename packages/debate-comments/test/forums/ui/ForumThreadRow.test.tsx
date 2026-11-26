// @vitest-environment jsdom
/**
 * @fileoverview `ForumThreadRow`: what a feed row shows for a thread, and
 * which optional parts it leaves out.
 */

import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForumThreadRow } from "../../../src/forums/ui/ForumThreadRow";
import type { ForumThreadSummary } from "../../../src/forums/types";
import { click, cleanup, find, findAll, mount } from "../../helpers/mount";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const toggle = vi.fn();
vi.mock("../../../src/forums/client", () => ({
  toggleForumThreadLike: (...args: unknown[]) => toggle(...args),
}));

const CREATED = 1_700_000_000;

function thread(overrides: Partial<ForumThreadSummary> = {}): ForumThreadSummary {
  return {
    id: "t1",
    title: "Is the aff topical?",
    excerpt: "Walk me through it.",
    category: "policy",
    author: { id: "u1", name: "Ana Ruiz", imageUrl: null },
    likeCount: 3,
    viewerHasLiked: false,
    replyCount: 2,
    createdAt: CREATED,
    lastActivityAt: CREATED,
    ...overrides,
  };
}

function row(element: ReactNode) {
  return <ul>{element}</ul>;
}

describe("ForumThreadRow", () => {
  afterEach(async () => {
    await cleanup();
    toggle.mockReset();
  });

  it("links the title and the reply count to the thread page", async () => {
    const { container } = await mount(row(<ForumThreadRow thread={thread()} />));

    const links = findAll<HTMLAnchorElement>(container, "a[href='/practice/forums/t1']");
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe("Is the aff topical?");
    expect(links[1].textContent).toBe("2 replies");
  });

  it("shows the excerpt, author and board chip linking to that board's listing", async () => {
    const { container } = await mount(row(<ForumThreadRow thread={thread()} />));

    expect(container.textContent).toContain("Walk me through it.");
    expect(container.textContent).toContain("Ana Ruiz");
    const chip = find<HTMLAnchorElement>(container, "a[href='/news?section=forums&category=policy']");
    expect(chip.textContent).toBe("Policy");
  });

  it("omits the board chip when showCategory is off", async () => {
    const { container } = await mount(
      row(<ForumThreadRow thread={thread()} showCategory={false} />),
    );
    expect(container.querySelector("a[href^='/news']")).toBeNull();
  });

  it("omits the excerpt paragraph when the thread has none", async () => {
    const { container } = await mount(row(<ForumThreadRow thread={thread({ excerpt: "" })} />));
    expect(container.querySelector("p.line-clamp-2")).toBeNull();
  });

  it("marks recent activity only when it is later than the opening post", async () => {
    const quiet = await mount(row(<ForumThreadRow thread={thread()} />));
    expect(quiet.container.textContent).not.toContain("active ");

    const busy = await mount(
      row(<ForumThreadRow thread={thread({ lastActivityAt: CREATED + 3600 })} />),
    );
    expect(busy.container.textContent).toContain("active ");
  });

  it("puts the absolute post time on the time element", async () => {
    const { container } = await mount(row(<ForumThreadRow thread={thread()} />));
    const time = find<HTMLTimeElement>(container, "time");
    expect(time.getAttribute("datetime")).toBe(new Date(CREATED * 1000).toISOString());
    expect(time.getAttribute("title")).toBeTruthy();
  });

  it("reports a like to onLikeChange with the thread id and the server's count", async () => {
    toggle.mockResolvedValueOnce({ liked: true, likeCount: 4 });
    const onLikeChange = vi.fn();
    const { container } = await mount(
      row(<ForumThreadRow thread={thread()} canLike onLikeChange={onLikeChange} />),
    );

    await click(find(container, "button"));

    expect(onLikeChange).toHaveBeenCalledWith("t1", true, 4);
  });

  it("does not call the server when the reader cannot like", async () => {
    const onLikeChange = vi.fn();
    const { container } = await mount(
      row(<ForumThreadRow thread={thread()} onLikeChange={onLikeChange} />),
    );

    await click(find(container, "button"));

    expect(toggle).not.toHaveBeenCalled();
    expect(onLikeChange).not.toHaveBeenCalled();
  });
});
