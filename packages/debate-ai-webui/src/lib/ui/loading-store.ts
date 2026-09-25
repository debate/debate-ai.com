"use client"

/**
 * @fileoverview Global loading-overlay state.
 *
 * One zustand store for the whole app: `AppShell` mounts a single
 * {@link LoadingOverlay} off of `isActive`, and any page or transition can
 * flip it on with `beginLoading` and off with `finishLoading`. There is no
 * per-route overlay, so two pages asking to load at once cannot double up —
 * the second call just re-arms the timer that the first started.
 *
 * The overlay is opt-in: nothing calls `beginLoading` until a page that wants
 * it does, so the login/callback routes keep their own loaders and never
 * stack a second one on top.
 */

import { create } from "zustand"

/** Default fade-out duration, in ms, kept in sync with LoadingOverlay. */
export const DEFAULT_LOADING_FADE_OUT_MS = 400

/** How long, in ms, a load must run before the overlay appears at all. */
export const DEFAULT_LOADING_SHOW_DELAY_MS = 1000

interface LoadingState {
  isActive: boolean
  label: string | null
  /**
   * When true the overlay lets clicks through to the page behind it. Used by
   * transitions where the next page is already mounted and interactive.
   */
  passthrough: boolean
  /** Number of outstanding `beginLoading` calls; the overlay clears only at 0. */
  depth: number
}

interface LoadingActions {
  beginLoading: (label?: string, opts?: { passthrough?: boolean }) => void
  finishLoading: () => void
  setLoading: (active: boolean, label?: string, opts?: { passthrough?: boolean }) => void
  resetLoading: () => void
}

type LoadingStore = LoadingState & LoadingActions

export const useLoadingStore = create<LoadingStore>((set) => ({
  isActive: false,
  label: null,
  passthrough: false,
  depth: 0,

  beginLoading: (label, opts) =>
    set((state) => ({
      isActive: true,
      label: label ?? null,
      passthrough: opts?.passthrough ?? false,
      depth: state.depth + 1,
    })),

  finishLoading: () =>
    set((state) => {
      const depth = Math.max(0, state.depth - 1)
      return {
        depth,
        isActive: depth > 0,
        label: depth > 0 ? state.label : null,
        passthrough: depth > 0 ? state.passthrough : false,
      }
    }),

  setLoading: (active, label, opts) =>
    set({
      isActive: active,
      label: active ? (label ?? null) : null,
      passthrough: active ? (opts?.passthrough ?? false) : false,
      depth: active ? 1 : 0,
    }),

  resetLoading: () =>
    set({
      isActive: false,
      label: null,
      passthrough: false,
      depth: 0,
    }),
}))

/** Convenience hook: just the boolean the overlay reads. */
export function useIsLoading() {
  return useLoadingStore((s) => s.isActive)
}

/**
 * Imperative handles for callers outside React — `use-route-loading` arms and
 * drops the orb from effects and timers, not from render. The actions live on
 * the store's state, and zustand never replaces them after `create`, so these
 * references stay valid for the life of the store.
 */
export const { beginLoading, finishLoading, setLoading, resetLoading } =
  useLoadingStore.getState()
