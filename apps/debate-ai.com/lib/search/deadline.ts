/**
 * @fileoverview A time limit for a search query.
 *
 * D1 has no per-statement timeout a Worker can set, and a query cannot be
 * cancelled once sent, so this only stops *waiting*: the route answers with
 * what it has instead of holding the search box on a spinner while a slow
 * statement finishes.
 *
 * @module lib/search/deadline
 */

/** Returned in place of a value when the deadline passes first. */
export const TIMED_OUT: unique symbol = Symbol("timed out");

/**
 * Resolves with `work`'s value, or with {@link TIMED_OUT} after `ms`.
 * A rejection inside the deadline still rejects; one after it is swallowed,
 * since nobody is waiting for it any more.
 */
export function withinDeadline<T>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  work.catch(() => {});
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
