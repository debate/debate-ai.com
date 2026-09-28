/**
 * @fileoverview Presentation helpers shared by the comment rows — relative
 * timestamps, avatar initials, and the plural labels on the reply toggles.
 *
 * These are pure and clock-injectable, because a relative date is exactly the
 * kind of string that quietly rots into "NaN ago" when it is computed inline
 * against `Date.now()` and nothing can test it.
 *
 * @module format
 */

/** The units a relative timestamp rounds to, coarsest last. */
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * "just now", "4m ago", "3h ago", "6d ago", then an absolute date.
 *
 * `now` is a parameter rather than a `Date.now()` call so the output is
 * testable and so a server-rendered row and the hydration pass that follows it
 * can be handed the same instant — a comment boundary (exactly 60s) is where a
 * render that recomputes "now" will disagree with itself and trip a hydration
 * mismatch.
 */
export function formatRelativeTime(createdAt: number, now: number = Date.now()): string {
  const seconds = Math.floor((now - createdAt) / 1000);

  if (seconds < 0) return "just now";
  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`;
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)}d ago`;

  const date = new Date(createdAt);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  });
}

/** The absolute timestamp, for the `title` attribute and `datetime`. */
export function formatAbsoluteTime(createdAt: number): string {
  return new Date(createdAt).toLocaleString();
}

/**
 * Up to two initials for an avatar fallback.
 *
 * Falls back to "?" for a name that is empty or entirely punctuation, so the
 * fallback is never a blank circle — which is what a Google account with no
 * name would otherwise produce.
 */
export function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "?";
}

/** "1 reply" / "3 replies" / "Hide replies", the label on a thread toggle. */
export function replyToggleLabel(replyCount: number, expanded: boolean): string {
  if (expanded) return "Hide replies";
  return replyCount === 1 ? "1 reply" : `${replyCount} replies`;
}
