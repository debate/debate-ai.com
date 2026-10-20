/**
 * @fileoverview Persistent storage for a debater's XP and level
 * (`lib/debater-levels.ts`), in localStorage — SSR/no-storage-safe, and a
 * corrupt or missing value degrades to a fresh zero-XP state rather than
 * throwing, mirroring `streakFreezes.ts`.
 *
 * Tools report practice work through one window event,
 * `DEBATER_ACTIVITY_EVENT`, carrying `{ kind, count? }`. Packages that
 * don't depend on `debate-community` (the quick-card editor, the practice
 * vs AI room) just dispatch that event by name; `installDebaterActivityListener`
 * — mounted once by the app shell — turns each one into a
 * `recordDebaterActivity` call. Packages that do depend on this one can call
 * `recordDebaterActivity` directly.
 *
 * @module state/debaterLevel
 */

import {
  applyDebaterActivity,
  attributeActivityToDevice,
  createDebaterLevelState,
  isDebaterActivityKind,
  parseDebaterLevelState,
  type DebaterActivityKind,
  type DebaterActivityResult,
  type DebaterLevelState,
} from "../lib/debater-levels";

/** localStorage key holding the serialized `DebaterLevelState`. */
export const DEBATER_LEVEL_STORAGE_KEY = "debaterLevel";

/** Window event any tool dispatches to award XP: `detail: { kind: DebaterActivityKind; count?: number }`. */
export const DEBATER_ACTIVITY_EVENT = "debate-ai:debater-activity";

/** Window event this store dispatches after every recorded activity: `detail: DebaterActivityResult`. */
export const DEBATER_XP_AWARDED_EVENT = "debate-ai:debater-xp-awarded";

/** localStorage key holding this browser's random device id (ledger attribution). */
export const DEBATER_DEVICE_ID_KEY = "debaterDeviceId";

/** This browser's stable device id, created on first use; a throwaway id when storage is unavailable. */
export function getDebaterDeviceId(): string {
  const fresh = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  if (typeof localStorage === "undefined") return fresh();
  try {
    const existing = localStorage.getItem(DEBATER_DEVICE_ID_KEY);
    if (existing) return existing;
    const id = fresh();
    localStorage.setItem(DEBATER_DEVICE_ID_KEY, id);
    return id;
  } catch {
    return fresh();
  }
}

/** Read the persisted state, or a fresh one. */
export function loadDebaterLevelState(): DebaterLevelState {
  if (typeof localStorage === "undefined") return createDebaterLevelState();
  try {
    const raw = localStorage.getItem(DEBATER_LEVEL_STORAGE_KEY);
    if (!raw) return createDebaterLevelState();
    return parseDebaterLevelState(JSON.parse(raw)) ?? createDebaterLevelState();
  } catch {
    return createDebaterLevelState();
  }
}

function saveDebaterLevelState(state: DebaterLevelState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DEBATER_LEVEL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked — the award is simply not persisted.
  }
}

/** Record practice work, persist the new state, and announce the award. */
export function recordDebaterActivity(
  kind: DebaterActivityKind,
  count = 1,
  nowMs: number = Date.now(),
): DebaterActivityResult {
  const previous = loadDebaterLevelState();
  const applied = applyDebaterActivity(previous, kind, nowMs, count);
  const result = { ...applied, state: attributeActivityToDevice(previous, applied, kind, count, getDebaterDeviceId()) };
  saveDebaterLevelState(result.state);
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(DEBATER_XP_AWARDED_EVENT, { detail: result }));
  }
  return result;
}

/** Dispatch an activity event (for callers that would rather not record directly). */
export function dispatchDebaterActivity(kind: DebaterActivityKind, count = 1): void {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEBATER_ACTIVITY_EVENT, { detail: { kind, count } }));
}

/** Clear all progress (the panel's "Reset progress" action). */
export function resetDebaterLevelState(): DebaterLevelState {
  const fresh = createDebaterLevelState();
  saveDebaterLevelState(fresh);
  return fresh;
}

/**
 * Listen for `DEBATER_ACTIVITY_EVENT` on `window` and record each valid one.
 * Returns the cleanup function. Malformed events are ignored.
 */
export function installDebaterActivityListener(): () => void {
  if (typeof window === "undefined") return () => {};
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail as { kind?: unknown; count?: unknown } | null;
    if (!detail || !isDebaterActivityKind(detail.kind)) return;
    const count = typeof detail.count === "number" && Number.isFinite(detail.count) ? detail.count : 1;
    recordDebaterActivity(detail.kind, count);
  };
  window.addEventListener(DEBATER_ACTIVITY_EVENT, handle);
  return () => window.removeEventListener(DEBATER_ACTIVITY_EVENT, handle);
}
