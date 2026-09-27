/**
 * @fileoverview The comment thread as a reader sees it: the reply tree, the
 * expand/collapse toggle, the like count, and which actions a row offers to
 * whom.
 *
 * Rendered through `renderToStaticMarkup`, which is the server pass — enough to
 * assert the structure a reader gets (who is listed under whom, which buttons
 * exist, what a deleted comment leaves behind) without a DOM. What it cannot
 * reach is the state after a click, so those rules are tested where they live:
 * the tree maths in `tree.test.ts`, the timestamp strings in `format.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { CommentRow } from "../src/CommentRow";
import type { Comment } from "../src/types";

function comment(overrides: Partial<Comment> & Pick<Comment, "id" | "parentId">): Comment {
  return {
    resourceType: "video",
    resourceId: "abc123",
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

const noop = async () => {};

function render(comment: Comment, viewerId: string | null = null, depth = 0): string {
  return renderToStaticMarkup(
    createElement(CommentRow, {
      comment,
      depth,
      viewerId,
      onLike: noop,
      onReply: noop,
      onDelete: noop,
    }),
  );
}

/** Root → reply → reply-to-reply. */
const THREAD: Comment = {
  ...comment({ id: "r1", parentId: null, body: "Was the framework read right here?" }),
  likeCount: 12,
  replies: [
    {
      ...comment({ id: "r1a", parentId: "r1", body: "No, the neg dropped the second warrant" }),
      viewerHasLiked: true,
      replies: [
        {
          ...comment({ id: "r1a1", parentId: "r1a", body: "They extended it in the block" }),
          replies: [],
        },
      ],
    },
  ],
};

describe("CommentRow", () => {
  it("shows the author, the body and the like count", () => {
    const html = render(THREAD, "someone-else");

    expect(html).toContain("Author r1");
    expect(html).toContain("Was the");
    expect(html).toContain(">12<");
  });

  it("nests a reply under the comment it answers, not beside it", () => {
    const html = render(THREAD);

    const rootAt = html.indexOf("Was the");
    const replyAt = html.indexOf("No, the neg dropped");
    expect(rootAt).toBeGreaterThan(-1);
    expect(replyAt).toBeGreaterThan(rootAt);
    // The reply is inside the root's indented subtree, not a sibling of it.
    expect(html.slice(rootAt, replyAt)).toContain("border-l");
  });

  it("keeps a reply's own replies collapsed, so a thread never opens as a wall", () => {
    const html = render(THREAD);

    // The root opens its replies; the reply does not open its own. The
    // grandchild is still there, behind a toggle labelled by how many replies
    // wait under the reply.
    expect(html).toContain(">1 reply<");
    expect(html).not.toContain("They extended it in the block");
  });

  it("renders a reply-to-reply once its parent's thread is expanded", () => {
    // Rendered at depth 0, which is what expands a row's replies — so the
    // third level is the one that shows the recursion, and the second indent
    // tier, actually working.
    const html = render(THREAD.replies[0]);

    expect(html).toContain("They extended it in the block");
    expect(html).toContain("Hide replies");
  });

  it("opens a root's replies and labels the toggle by how many there are", () => {
    const html = render(THREAD);

    expect(html).toContain("Hide replies");
    expect(html).toContain('aria-expanded="true"');
  });

  it("keeps deeper replies collapsed so a busy thread does not open as a wall", () => {
    const html = render(THREAD.replies[0], "viewer", 1);

    expect(html).toContain("1 reply");
    expect(html).toContain('aria-expanded="false"');
  });

  it("marks a comment the viewer has already liked", () => {
    const html = render(THREAD.replies[0]);

    expect(html).toContain('aria-pressed="true"');
    // React escapes the apostrophe in the rendered attribute.
    expect(html).toContain("aria-label=\"Remove your like from Author r1a&#x27;s comment\"");
  });

  it("offers a delete only on the viewer's own comments", () => {
    expect(render(THREAD, "user-r1")).toContain('aria-label="Delete your comment"');
    expect(render(THREAD, "user-r2")).not.toContain('aria-label="Delete your comment"');
    expect(render(THREAD, null)).not.toContain('aria-label="Delete your comment"');
  });

  it("stops offering replies at the same ceiling the server enforces", () => {
    // A row at zero-based depth 6 is the deepest that can be replied to: the
    // reply would sit at level 8, the deepest `resolveReplyParent` allows. The
    // two bounds have to be the same number or a reply appears to work and
    // then vanishes.
    const deepestReplyable = render(comment({ id: "deep", parentId: "p" }), "viewer", 6);
    expect(deepestReplyable).toContain(">Reply<");

    const atCeiling = render(comment({ id: "deeper", parentId: "p" }), "viewer", 7);
    expect(atCeiling).not.toContain(">Reply<");
  });

  it("shows a deleted comment as a tombstone with no actions of its own", () => {
    const html = render(
      { ...comment({ id: "gone", parentId: null }), body: "", deletedAt: Date.UTC(2026, 0, 3, 12), likeCount: 4 },
      "user-gone",
    );

    expect(html).toContain("This comment was deleted.");
    // Not likeable, not replyable, not deletable — and its four likes are gone
    // with it.
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("aria-label=\"Like");
    expect(html).not.toContain(">Reply<");
    expect(html).not.toContain(">4<");
  });

  it("keeps a deleted comment's replies, so a sub-conversation survives it", () => {
    const deleted: Comment = {
      ...comment({ id: "gone", parentId: null, body: "should not be served" }),
      body: "",
      deletedAt: Date.UTC(2026, 0, 3, 12),
      replies: [comment({ id: "orphan", parentId: "gone", body: "still here" })],
    };

    const html = render(deleted, "user-gone");

    expect(html).toContain("This comment was deleted.");
    expect(html).not.toContain("should not be served");
    expect(html).toContain("still here");
  });

  it("does not nest one indent level per reply", () => {
    // A thread six replies deep would otherwise indent its way off the side of
    // a phone. The connector line stays; the indent stops growing.
    let node: Comment = comment({ id: "leaf", parentId: "p" });
    for (let level = 5; level >= 0; level--) {
      node = {
        ...comment({ id: `n${level}`, parentId: level === 5 ? null : `n${level + 1}` }),
        replies: [node],
      };
    }
    const html = render(node, "viewer");

    // Two indent classes, not six.
    const indents = html.match(/ml-[0-9.]+ border-l/g) ?? [];
    expect(new Set(indents).size).toBeLessThanOrEqual(2);
  });
});
