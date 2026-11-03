/**
 * @fileoverview Hook for reading a localStorage-backed store into a panel.
 *
 * The persistence stores in the debate packages are plain synchronous
 * functions over `localStorage` that are safe to call during SSR (they return
 * an empty list when there is no `window`). Panels still must not read them
 * during render, or the server-rendered markup and the first client render
 * disagree once a browser has data. This hook does the read in an effect
 * after mount and hands back a `refresh` callback for panels that write.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Return shape of {@link useStoreSnapshot}. */
export interface StoreSnapshot<T> {
  /** The latest value read from the store (the initial value until mounted). */
  data: T;
  /** Re-runs the reader — call after any write so the panel reflects it. */
  refresh: () => void;
  /** `false` until the first post-mount read has happened. */
  hydrated: boolean;
}

/**
 * Reads a synchronous store after mount and re-reads on demand.
 *
 * @typeParam T - The value the reader returns.
 * @param read - Reader called after mount and on every `refresh()`.
 * @param initial - Value used for the server render and the first client render.
 * @returns The snapshot, a `refresh` callback and a `hydrated` flag.
 *
 * @example
 * ```tsx
 * const { data: notes, refresh } = useStoreSnapshot(listSprintNotes, []);
 * const add = () => { saveSprintNote(note); refresh(); };
 * ```
 */
export function useStoreSnapshot<T>(read: () => T, initial: T): StoreSnapshot<T> {
  const [data, setData] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const readRef = useRef(read);
  readRef.current = read;

  const refresh = useCallback(() => {
    setData(readRef.current());
    setHydrated(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, refresh, hydrated };
}
