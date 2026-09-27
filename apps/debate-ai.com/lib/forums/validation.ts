/**
 * @fileoverview Request validation for the forum API.
 *
 * A thread is two pieces of free text and a cursor, and all three reach a
 * query — so the limits live here, apart from the route handlers, for the same
 * reason the comment API's do: a limit enforced in two places is two limits
 * that will drift, and the one that drifts is the one nobody reads.
 *
 * Nothing here talks to the database. A cursor that names no thread is
 * rejected by shape, not by a lookup — the one question that needs a query
 * (does this thread exist) is the route's to answer.
 *
 * @module lib/forums/validation
 */

import type { Parsed } from "@/lib/comments/validation";

export type { Parsed };

/**
 * The longest a thread title may be, in characters.
 *
 * A title is the one line every reader of the feed sees, so it is capped well
 * below the body: long enough for a full claim plus a tag, short enough that
 * the feed stays a list of subjects rather than a wall of paragraphs.
 */
export const MAX_THREAD_TITLE_LENGTH = 140;

/**
 * The longest an opening post may be, in characters.
 *
 * Longer than {@link MAX_COMMENT_BODY_LENGTH} (5,000) on purpose: an opening
 * post is the thing being discussed, where a comment is a turn in a discussion
 * that already has one, and the field it is typed into is a multi-line box
 * rather than a single line.
 */
export const MAX_THREAD_BODY_LENGTH = 20_000;

/** How many threads one feed read returns when the caller names no limit. */
export const DEFAULT_FEED_LIMIT = 25;

/** The most a caller may ask for in one read, whatever it asks for. */
export const MAX_FEED_LIMIT = 50;

/** The UUIDs the API mints, checked before a cursor or id costs a query. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a value shaped like one of the ids {@link parseThreadId} accepts. */
export function isThreadId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Reads a thread title: trimmed, and between one character and
 * {@link MAX_THREAD_TITLE_LENGTH}.
 *
 * Trimming before the length check is deliberate, for the reason it is in
 * `lib/comments/validation.ts`: a title of 140 characters and 140 spaces is
 * not a title, it is a way around the limit, and it would otherwise be stored,
 * shipped to every reader of the feed, and rendered as a blank row.
 */
export function parseThreadTitle(raw: unknown): Parsed<string> {
  if (typeof raw !== "string") {
    return { ok: false, error: "A thread needs a title." };
  }

  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, error: "A thread needs a title." };
  }
  if (value.length > MAX_THREAD_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Titles are limited to ${MAX_THREAD_TITLE_LENGTH} characters.`,
    };
  }

  return { ok: true, value };
}

/** Reads an opening post: trimmed, and between one character and {@link MAX_THREAD_BODY_LENGTH}. */
export function parseThreadBody(raw: unknown): Parsed<string> {
  if (typeof raw !== "string") {
    return { ok: false, error: "A thread needs an opening post." };
  }

  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, error: "A thread needs an opening post." };
  }
  if (value.length > MAX_THREAD_BODY_LENGTH) {
    return {
      ok: false,
      error: `Posts are limited to ${MAX_THREAD_BODY_LENGTH.toLocaleString()} characters.`,
    };
  }

  return { ok: true, value };
}

/** Reads a thread id off a route param. */
export function parseThreadId(raw: unknown): Parsed<string> {
  if (!isThreadId(raw)) {
    return { ok: false, error: "That is not a thread." };
  }
  return { ok: true, value: raw };
}

/**
 * Reads the feed's page size.
 *
 * A non-numeric or out-of-range limit falls back to the default rather than
 * failing the read: the limit is a hint about how much to send, not a claim
 * about what is being asked for, and a feed that 400s on `?limit=abc` teaches
 * a client that the feed is fragile.
 */
export function parseFeedLimit(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return DEFAULT_FEED_LIMIT;

  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_FEED_LIMIT;

  const rounded = Math.floor(value);
  if (rounded < 1) return 1;
  return Math.min(rounded, MAX_FEED_LIMIT);
}
