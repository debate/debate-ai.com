/**
 * @fileoverview Pure operations on a nested comment tree.
 *
 * The UI holds its thread as a nested `Comment[]` — the same shape the API
 * returns — and every change a user makes to it (posting a reply, undoing an
 * optimistic like, dropping a deleted comment out of the tree) is a rebuild
 * of a path through that structure. Doing that with immutable updates in the
 * component leaves a dozen near-identical `comments.map(...)` walks behind,
 * each of which has to remember to recurse and to preserve identity for the
 * branches it did not touch.
 *
 * So they live here instead: no React, no fetching, and a test can drive every
 * one of them with a literal tree.
 *
 * @module tree
 */

import type { Comment } from "./types";

/**
 * Rebuilds a nested tree from the flat, un-nested rows a query returns.
 *
 * Ordering is the caller's: rows are expected to arrive oldest-first, and that
 * order is preserved within each parent, so a root stays above its replies and
 * a reply stays above the reply-to-it.
 *
 * A row whose `parentId` names a comment that is not in the input — a reply
 * whose parent was deleted outright, or a page that loaded only part of a
 * thread — is promoted to a root rather than dropped. Losing it silently
 * would hide someone's post; showing it as a root keeps the text, and the
 * client re-nests it correctly the next time it fetches the whole thread.
 */
export function buildCommentTree(rows: readonly Comment[]): Comment[] {
  // Every row becomes a node with an empty `replies` first, so a reply that
  // arrived before its parent in the row order can still find its parent below.
  const nodes = new Map<string, Comment>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, replies: [] });
  }

  const roots: Comment[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;

    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Replaces one comment somewhere in the tree, returning a new tree.
 *
 * Branches that do not contain the id are returned by identity, not copied, so
 * a like on one comment does not invalidate every other comment's memoized
 * row. A tree with no such id is returned unchanged.
 */
export function updateCommentNode(
  comments: readonly Comment[],
  commentId: string,
  update: (comment: Comment) => Comment,
): Comment[] {
  let changed = false;

  const next = comments.map((comment) => {
    if (comment.id === commentId) {
      changed = true;
      return { ...update(comment), replies: comment.replies };
    }

    if (comment.replies.length === 0) return comment;

    const replies = updateCommentNode(comment.replies, commentId, update);
    if (replies === comment.replies) return comment;

    changed = true;
    return { ...comment, replies };
  });

  return changed ? next : (comments as Comment[]);
}

/**
 * Appends a reply to the comment it answers, and returns a new tree.
 *
 * A reply whose parent is not in the tree is dropped: the parent is gone (a
 * hard-deleted ancestor between two fetches), and putting its reply at the top
 * level would re-parent the post in a way no user asked for.
 */
export function insertReplyNode(
  comments: readonly Comment[],
  parentId: string,
  reply: Comment,
): Comment[] {
  let changed = false;

  const next = comments.map((comment) => {
    if (comment.id === parentId) {
      changed = true;
      return { ...comment, replies: [...comment.replies, reply] };
    }

    if (comment.replies.length === 0) return comment;

    const replies = insertReplyNode(comment.replies, parentId, reply);
    if (replies === comment.replies) return comment;

    changed = true;
    return { ...comment, replies };
  });

  return changed ? next : (comments as Comment[]);
}

/** Every comment in the tree, roots first then depth-first, deleted included. */
export function flattenCommentTree(comments: readonly Comment[]): Comment[] {
  const flat: Comment[] = [];
  for (const comment of comments) {
    flat.push(comment);
    flat.push(...flattenCommentTree(comment.replies));
  }
  return flat;
}

/** The comment with this id, or `null` if this tree does not hold it. */
export function findComment(comments: readonly Comment[], commentId: string): Comment | null {
  for (const comment of comments) {
    if (comment.id === commentId) return comment;
    const found = findComment(comment.replies, commentId);
    if (found) return found;
  }
  return null;
}

/**
 * How many comments the thread holds, replies and deleted ones included.
 *
 * This is the number in the section heading, so it matches the number the
 * server reports rather than the number of rows currently rendered — a
 * collapsed thread still counts what is inside it.
 */
export function countComments(comments: readonly Comment[]): number {
  let total = 0;
  for (const comment of comments) {
    total += 1 + countComments(comment.replies);
  }
  return total;
}

/**
 * How many replies a comment has directly beneath it, deleted ones included.
 *
 * Deleting a comment leaves its replies in the tree — that is the whole reason
 * a thread does not lose a sub-conversation when one post goes away — so the
 * toggle has to count them to keep the "3 replies" label honest.
 */
export function countReplies(comment: Comment): number {
  return comment.replies.length;
}
