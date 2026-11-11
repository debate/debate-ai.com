// @vitest-environment jsdom
/**
 * @fileoverview Reddit-style folding: a comment folds to one line from its
 * `[–]` button or from the connector line beside its replies, taking its whole
 * subtree with it, and unfolds from the `[+]` it leaves behind. Plus the
 * forum's `expandAllReplies`, which opens every level on arrival.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CommentRow } from "../src/CommentRow";
import type { Comment } from "../src/types";
import { flush, mount, type Mounted } from "./helpers/mount";

function comment(overrides: Partial<Comment> & Pick<Comment, "id" | "parentId">): Comment {
  return {
    resourceType: "thread",
    resourceId: "t1",
    body: `body of ${overrides.id}`,
    author: { id: `user-${overrides.id}`, name: `Author ${overrides.id}`, imageUrl: null },
    likeCount: 0,
    viewerHasLiked: false,
    createdAt: Date.UTC(2026, 0, 2, 12),
    deletedAt: null,
    replies: [],
    ...overrides,
  };
}

const THREAD: Comment = {
  ...comment({ id: "r1", parentId: null }),
  replies: [
    {
      ...comment({ id: "r1a", parentId: "r1" }),
      replies: [{ ...comment({ id: "r1a1", parentId: "r1a" }), replies: [] }],
    },
  ],
};

const noop = async () => {};

function element(expandAllReplies = false) {
  return createElement(CommentRow, {
    comment: THREAD,
    depth: 0,
    viewerId: null,
    onLike: noop,
    onReply: noop,
    onDelete: noop,
    expandAllReplies,
  });
}

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("CommentRow folding", () => {
  it("opens only a root's replies by default, and every level with expandAllReplies", () => {
    expect(renderToStaticMarkup(element(false))).not.toContain("body of r1a1");
    expect(renderToStaticMarkup(element(true))).toContain("body of r1a1");
  });

  it("folds a comment and its whole subtree from the [–] button, and unfolds it", async () => {
    mounted = await mount(element(true));
    const { container } = mounted;

    const collapse = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Author r1\'s comment and 2 replies"][title="Collapse"]',
    );
    expect(collapse).not.toBeNull();
    await flush(() => collapse!.click());

    expect(container.textContent).not.toContain("body of r1");
    expect(container.textContent).not.toContain("body of r1a1");
    expect(container.textContent).toContain("Author r1");
    expect(container.textContent).toContain("(2 replies)");

    const expand = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Expand Author r1\'s comment"]',
    );
    await flush(() => expand!.click());
    expect(container.textContent).toContain("body of r1a1");
  });

  it("folds from the connector line beside the replies", async () => {
    mounted = await mount(element(true));
    const { container } = mounted;

    const line = container.querySelector<HTMLButtonElement>(
      'button[title="Collapse thread"][aria-label^="Collapse Author r1a\'s"]',
    );
    expect(line).not.toBeNull();
    await flush(() => line!.click());

    // The reply folded; its parent did not.
    expect(container.textContent).toContain("body of r1");
    expect(container.textContent).not.toContain("body of r1a1");
    expect(container.textContent).toContain("(1 reply)");
  });
});
