/**
 * Idle-callback scheduler with a setTimeout fallback for browsers
 * that don't support `requestIdleCallback`.
 *
 * Used by the editor and multi-pane shell to push per-pause "heavy"
 * work (nav rebuild, word count, comments GC, comments column
 * render) to a frame where the browser actually has idle time. That
 * way the burst of O(doc) work doesn't cause a single-frame spike
 * mid-typing the moment the user pauses for 200ms — the browser
 * waits until a frame has spare budget before invoking the callback.
 *
 * The `timeout` argument caps how long the work can be deferred past
 * the scheduled moment. requestIdleCallback honors it natively; the
 * setTimeout fallback uses it as the run delay.
 */

export type IdleHandle =
  | { kind: 'idle'; id: number }
  | { kind: 'timeout'; id: ReturnType<typeof setTimeout> };

export function scheduleIdle(
  callback: () => void,
  timeout = 200,
): IdleHandle {
  if (typeof requestIdleCallback === 'function') {
    // `timeout: Infinity` means NO cap: run only on a genuinely idle
    // frame, however long that takes. Callers whose work is a
    // monolithic main-thread block (the palette's file parses) use it
    // so the work can never be forced into an active typing burst.
    return {
      kind: 'idle',
      // The IdleDeadline arg is unused — our heavy callbacks run to
      // completion regardless of how much budget the browser advertised.
      id: Number.isFinite(timeout)
        ? requestIdleCallback(() => callback(), { timeout })
        : requestIdleCallback(() => callback()),
    };
  }
  // The fallback can't observe idleness; a capped run-anyway delay is
  // the only option (1s approximates "probably between bursts" for the
  // no-cap case).
  return {
    kind: 'timeout',
    id: setTimeout(callback, Number.isFinite(timeout) ? timeout : 1000),
  };
}

export function cancelIdle(handle: IdleHandle): void {
  if (handle.kind === 'idle') {
    if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle.id);
  } else {
    clearTimeout(handle.id);
  }
}
