/**
 * @fileoverview The pure half of the comment feature: turning flat rows into a
 * thread, editing one comment inside it, and counting it.
 *
 * The tree functions are where a threaded discussion is won or lost — an
 * orphaned reply, a like that lands on the wrong branch, a header count that
 * disagrees with the page — and none of it needs a browser or a database to
 * happen.
 */

import { describe, it, expect } from "vitest";

import {
  buildCommentTree,
  countComments,
  countReplies,
  findComment,
  flattenCommentTree,
  insertReplyNode,
  updateCommentNode,
} from "../src/tree";
import type { Comment } from "../src/types";

/** A comment with only the fields a test cares about filled in. */
function comment(overrides: Partial<Comment> & Pick<Comment, "id" | "parentId">): Comment {
  return {
    resourceType: "video",
    resourceId: "abc123",
    body: `body of ${overrides.id}`,
    author: { id: `user-${overrides.id}`, name: `Author ${overrides.id}`, imageUrl: null },
    likeCount: 0,
    viewerHasLiked: false,
    createdAt: 1_700_000_000,
    deletedAt: null,
    replies: [],
    ...overrides,
  };
}

/** Root → reply → reply-to-reply, plus a second root. */
const FLAT: Comment[] = [
  comment({ id: "r1", parentId: null }),
  comment({ id: "r1a", parentId: "r1" }),
  comment({ id: "r1a1", parentId: "r1a" }),
  comment({ id: "r1b", parentId: "r1" }),
  comment({ id: "r2", parentId: null }),
];

describe("buildCommentTree", () => {
  it("nests replies under the comment they answer", () => {
    const tree = buildCommentTree(FLAT);

    expect(tree.map((node) => node.id)).toEqual(["r1", "r2"]);

    const first = tree[0];
    expect(first.replies.map((node) => node.id)).toEqual(["r1a", "r1b"]);
    expect(first.replies[0].replies.map((node) => node.id)).toEqual(["r1a1"]);
  });

  it("nests a reply that arrived before its parent in the row order", () => {
    // `r1a` before its own parent `r1`: the parent's place in the thread is
    // its id, not the order the query happened to return rows in.
    const outOfOrder = [FLAT[1], FLAT[0], FLAT[2], FLAT[3], FLAT[4]];
    const tree = buildCommentTree(outOfOrder);

    expect(tree.map((node) => node.id)).toEqual(["r1", "r2"]);
    expect(tree[0].replies[0].id).toBe("r1a");
    expect(tree[0].replies[0].replies[0].id).toBe("r1a1");
  });

  it("preserves row order among siblings", () => {
    const replies = [comment({ id: "b", parentId: "r1" }), comment({ id: "a", parentId: "r1" })];
    const tree = buildCommentTree([comment({ id: "r1", parentId: null }), ...replies]);

    expect(tree[0].replies.map((node) => node.id)).toEqual(["b", "a"]);
  });

  it("promotes a reply whose parent is missing rather than dropping it", () => {
    // A parent hard-deleted between two fetches, or a page that loaded only
    // part of a thread: the text is still somebody's post, so it stays.
    const tree = buildCommentTree([comment({ id: "orphan", parentId: "gone" })]);

    expect(tree.map((node) => node.id)).toEqual(["orphan"]);
    expect(tree[0].replies).toEqual([]);
  });

  it("does not share a replies array between the input rows and the tree", () => {
    const rows = [comment({ id: "r1", parentId: null, replies: undefined as never })];
    const tree = buildCommentTree(rows);

    expect(rows[0].replies).toBeUndefined();
    expect(tree[0].replies).toEqual([]);
  });
});

describe("updateCommentNode", () => {
  it("updates a comment at the bottom of a reply tree", () => {
    const tree = buildCommentTree(FLAT);
    const next = updateCommentNode(tree, "r1a1", (node) => ({ ...node, likeCount: 7 }));

    expect(findComment(next, "r1a1")?.likeCount).toBe(7);
  });

  it("leaves the original tree untouched", () => {
    const tree = buildCommentTree(FLAT);
    updateCommentNode(tree, "r1", (node) => ({ ...node, likeCount: 99 }));

    expect(findComment(tree, "r1")?.likeCount).toBe(0);
  });

  it("returns branches it did not touch by identity", () => {
    const tree = buildCommentTree(FLAT);
    const next = updateCommentNode(tree, "r1", (node) => ({ ...node, likeCount: 3 }));

    // `r2` did not change, so it is the same object — which is what keeps a
    // like on one comment from invalidating every other row's render.
    expect(next[1]).toBe(tree[1]);
  });

  it("keeps a node's replies when the update replaces the node", () => {
    const tree = buildCommentTree(FLAT);
    const next = updateCommentNode(tree, "r1", (node) => ({ ...node, body: "edited" }));

    expect(next[0].replies.map((node) => node.id)).toEqual(["r1a", "r1b"]);
  });

  it("returns the same tree when the id is not in it", () => {
    const tree = buildCommentTree(FLAT);
    expect(updateCommentNode(tree, "nope", (node) => node)).toBe(tree);
  });
});

describe("insertReplyNode", () => {
  it("appends a reply to the comment it answers", () => {
    const tree = buildCommentTree(FLAT);
    const next = insertReplyNode(tree, "r1a", comment({ id: "new", parentId: "r1a" }));

    const branch = findComment(next, "r1a");
    expect(branch?.replies.map((node) => node.id)).toEqual(["r1a1", "new"]);
  });

  it("adds the first reply to a comment that had none", () => {
    const tree = buildCommentTree([comment({ id: "r2", parentId: null })]);
    const next = insertReplyNode(tree, "r2", comment({ id: "new", parentId: "r2" }));

    expect(next[0].replies).toHaveLength(1);
    expect(next[0].replies[0].id).toBe("new");
  });

  it("does not mutate the tree it was given", () => {
    const tree = buildCommentTree(FLAT);
    insertReplyNode(tree, "r2", comment({ id: "new", parentId: "r2" }));

    expect(tree[1].replies).toEqual([]);
  });

  it("changes nothing when the parent is not in the tree", () => {
    const tree = buildCommentTree(FLAT);
    expect(insertReplyNode(tree, "gone", comment({ id: "new", parentId: "gone" }))).toBe(tree);
  });
});

describe("counting", () => {
  it("counts roots and replies, at every depth", () => {
    expect(countComments(buildCommentTree(FLAT))).toBe(5);
  });

  it("counts the replies of one comment, tombstones included", () => {
    const tree = buildCommentTree([
      comment({ id: "r1", parentId: null }),
      comment({ id: "gone", parentId: "r1", deletedAt: 1_700_000_100 }),
    ]);

    // A deleted comment keeps its row in the tree so its replies stay, and so
    // the "1 reply" label does not quietly change under the reader.
    expect(countReplies(tree[0])).toBe(1);
  });

  it("counts nothing for an empty thread", () => {
    expect(countComments([])).toBe(0);
  });
});

describe("findComment and flattenCommentTree", () => {
  it("finds a comment at depth", () => {
    expect(findComment(buildCommentTree(FLAT), "r1a1")?.parentId).toBe("r1a");
  });

  it("returns null for an id that is not in the tree", () => {
    expect(findComment(buildCommentTree(FLAT), "nope")).toBeNull();
  });

  it("flattens depth-first, parents before their replies", () => {
    expect(flattenCommentTree(buildCommentTree(FLAT)).map((node) => node.id)).toEqual([
      "r1",
      "r1a",
      "r1a1",
      "r1b",
      "r2",
    ]);
  });
});
