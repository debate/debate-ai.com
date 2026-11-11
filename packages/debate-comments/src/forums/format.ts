/**
 * @fileoverview Presentation helpers for the forum — the relative timestamps
 * and avatar initials a feed row and a thread page show.
 *
 * The forum API sends Unix *seconds* (`lib/forums/types.ts`), while
 * `debate-comments` formats milliseconds, so the conversion lives here — one
 * module, one unit boundary — rather than at each call site. Reusing the
 * comment package's formatters rather than restating them is deliberate: a
 * thread row and the first reply under it sit on the same page, and two
 * independent implementations of "6d ago" would eventually disagree in front of
 * a reader.
 *
 * @module debate-comments/forums/format
 */

import {
  formatAbsoluteTime as formatAbsoluteMs,
  formatRelativeTime as formatRelativeMs,
  getInitials,
} from "../format";

export { getInitials };

/**
 * "just now", "4m ago", "3h ago", "6d ago", then an absolute date.
 *
 * `createdAt` is Unix seconds, as the API sends it. `now` is a millisecond
 * instant (`Date.now()` by default) so it matches the convention the comment
 * rows already use, and so a server-rendered row and the hydration pass after
 * it can be handed the same instant rather than each recomputing "now".
 */
export function formatRelativeTime(createdAt: number, now: number = Date.now()): string {
  return formatRelativeMs(createdAt * 1000, now);
}

/** The absolute timestamp, for the `title` attribute and `datetime`. */
export function formatAbsoluteTime(createdAt: number): string {
  return formatAbsoluteMs(createdAt * 1000);
}

/** "No replies yet" / "1 reply" / "3 replies", the count on a feed row. */
export function replyCountLabel(replyCount: number): string {
  if (replyCount === 0) return "No replies yet";
  return replyCount === 1 ? "1 reply" : `${replyCount} replies`;
}

/**
 * The URL of one board's listing (or the whole forum for `null`), in an
 * optional order. The forum feed lives on the Forums tab of `/news`, and reads
 * `category` and `sort` off the query string on arrival, so these links are
 * shareable and survive a reload.
 */
export function forumFeedHref(category: string | null, sort?: string | null): string {
  const query = new URLSearchParams({ section: "forums" });
  if (category) query.set("category", category);
  if (sort && sort !== "active") query.set("sort", sort);
  return `/news?${query.toString()}`;
}

/** "No likes yet" / "1 like" / "3 likes". */
export function likeCountLabel(likeCount: number): string {
  if (likeCount === 0) return "No likes yet";
  return likeCount === 1 ? "1 like" : `${likeCount} likes`;
}
