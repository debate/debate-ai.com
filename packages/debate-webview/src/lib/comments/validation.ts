/**
 * @fileoverview Request validation for the comment API.
 *
 * The comment endpoints take four untrusted inputs — a resource type, a
 * resource id, a parent id and a body — and every one of them reaches a query.
 * The checks live here, apart from the route handlers, for the reason the rest
 * of this app checks things in one place: a length limit enforced in three
 * routes is three limits that will drift, and the one that drifts is the one
 * nobody reads.
 *
 * Nothing here talks to the database. Whether a `parentId` names a real
 * comment *on the same resource* is a question only a query can answer, and
 * that check lives in `queries.ts#resolveReplyParent`.
 *
 * @module lib/comments/validation
 */

import {
  MAX_COMMENT_BODY_LENGTH,
  isCommentResourceType,
  type CommentResourceType,
} from "@debate/comments";

export { MAX_COMMENT_BODY_LENGTH, isCommentResourceType };
export type { CommentResourceType };

/**
 * The longest a resource id may be.
 *
 * A comment can hang off a YouTube video id (11 characters) or a path-derived
 * slug. 200 is well past any of those and well short of a payload someone is
 * stuffing bytes into.
 */
export const MAX_RESOURCE_ID_LENGTH = 200;

/** Either a usable value, or the message to answer the requester with. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Reads a resource type off a query param or a JSON body. */
export function parseResourceType(raw: unknown): Parsed<CommentResourceType> {
  if (!isCommentResourceType(raw)) {
    return { ok: false, error: "Unknown kind of thing to comment on." };
  }
  return { ok: true, value: raw };
}

/** Reads a resource id: a non-empty string, trimmed, and length-capped. */
export function parseResourceId(raw: unknown): Parsed<string> {
  if (typeof raw !== "string") {
    return { ok: false, error: "Missing the thing to comment on." };
  }

  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, error: "Missing the thing to comment on." };
  }
  if (value.length > MAX_RESOURCE_ID_LENGTH) {
    return { ok: false, error: "That identifier is too long." };
  }

  return { ok: true, value };
}

/**
 * Reads a comment body: trimmed, and between one character and
 * {@link MAX_COMMENT_BODY_LENGTH}.
 *
 * Trimming before the length check is deliberate — a body of 5,000 characters
 * and 5,000 spaces is not a comment, it is a way around the limit, and it
 * would otherwise be stored, shipped to every reader of the thread, and
 * rendered as a blank row.
 */
export function parseCommentBody(raw: unknown): Parsed<string> {
  if (typeof raw !== "string") {
    return { ok: false, error: "A comment needs some text." };
  }

  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, error: "A comment needs some text." };
  }
  if (value.length > MAX_COMMENT_BODY_LENGTH) {
    return {
      ok: false,
      error: `Comments are limited to ${MAX_COMMENT_BODY_LENGTH.toLocaleString()} characters.`,
    };
  }

  return { ok: true, value };
}

/**
 * Reads a parent comment id.
 *
 * Absent, `null` and `""` all mean "a top-level comment" — a client that
 * posts a reply with an empty parent is posting a root, not asking for
 * something impossible. Anything else must be a UUID, so a nonsense parent
 * fails here instead of costing a query.
 */
export function parseParentId(raw: unknown): Parsed<string | null> {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) {
    return { ok: false, error: "That is not a comment this reply could answer." };
  }
  return { ok: true, value: raw };
}

/** The UUIDs the API mints, checked here so `parentId` costs no query to reject. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a value shaped like one of the ids {@link parseParentId} accepts. */
export function isCommentId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
