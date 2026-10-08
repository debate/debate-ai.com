/**
 * @fileoverview One request shared by every mounted copy of a polling hook.
 *
 * `useAccountNotifications` and `useContacts` are each mounted more than once
 * at a time (the dock's app-wide copy, the sidebar account menu's badge, the
 * contacts page), and every copy ran its own 30-second interval, so one page
 * sent the same GET several times per tick. Each copy still keeps its own
 * interval and state; they just reuse whatever request another copy started
 * within the last `freshMs`, so the endpoint sees about one call per tick.
 *
 * @module lib/shared-fetch
 */

/**
 * Wraps `fetcher` so calls inside `freshMs` of the last one get that call's
 * promise instead of a new request. `force` always starts a new request — for
 * a refresh after the user changed something.
 */
export function createSharedFetch<T>(fetcher: () => Promise<T>, freshMs: number) {
  let last: { at: number; promise: Promise<T> } | null = null;
  const fetchShared = (force = false): Promise<T> => {
    const now = Date.now();
    if (!force && last && now - last.at < freshMs) return last.promise;
    const promise = fetcher();
    last = { at: now, promise };
    return promise;
  };
  /** Forget the last request (tests, sign-out). */
  fetchShared.reset = () => {
    last = null;
  };
  return fetchShared;
}
