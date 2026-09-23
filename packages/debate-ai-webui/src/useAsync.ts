/**
 * @fileoverview The one data-loading hook every screen uses.
 *
 * Each screen is "run a request, show a spinner, then rows or the failure" —
 * written five times it would be five slightly different race conditions, so
 * it is written once here. The `cancelled` flag is the point: an Options page
 * where someone types into the card-search box fires a request per keystroke,
 * and without it the slowest response wins rather than the newest.
 *
 * @module useAsync
 */

import { useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  /** The failure's message, or undefined. Never an Error — screens only print it. */
  error: string | undefined;
  /** Re-runs `run` with the current deps, e.g. from a "Retry" button. */
  reload: () => void;
}

/**
 * Runs `run` whenever `deps` change, keeping the last successful `data` on
 * screen while the next request is in flight.
 *
 * @param run - The request. Rejections become {@link AsyncState.error}.
 * @param deps - Re-run trigger, compared the way `useEffect` compares its own.
 * @param options.skip - Leaves the hook idle (no request, no spinner) — how a
 *   screen defers its first load until someone has typed a query.
 */
export function useAsync<T>(
  run: () => Promise<T>,
  deps: readonly unknown[],
  options: { skip?: boolean } = {},
): AsyncState<T> {
  const { skip = false } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  // `run` is a fresh closure on every render; reading it through a ref keeps it
  // out of the effect's dependency list, so the request re-fires when the
  // screen's own deps change and not once per render.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (skip) {
      setLoading(false);
      setError(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    void runRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Spread rather than listed: the screen's own deps are what re-fire the
    // request, and `run` is read through the ref above precisely so it does
    // not belong here.
  }, [...deps, skip, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/**
 * `value`, delayed by `delayMs` of quiet.
 *
 * Search boxes here talk to a real deployment; debouncing is what keeps a
 * typed query from becoming one API call per character.
 */
export function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
