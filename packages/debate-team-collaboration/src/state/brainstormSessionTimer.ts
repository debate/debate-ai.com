/**
 * @fileoverview Persistent storage for `lib/brainstorm-session-timer.ts`'s
 * `BrainstormSessionTimerState` — the "(c) persisting the session timer"
 * slice of the "an optional brainstorm-session timer" follow-up named under
 * the "🧠 Team Brainstorm Assist" bullet in TODO.md. Stores a single
 * squad-wide timer in localStorage — one countdown per browser under one
 * fixed storage key, unlike `brainstormIdeas.ts`'s list-of-records-by-id
 * store, since a session timer has exactly one live instance at a time — so
 * a countdown started by a moderator survives a page refresh and, via
 * `state/live-update.ts`'s existing `storage`-event listener on this same
 * panel, is visible to any other open tab too.
 *
 * Each exported action reads the current state, applies the matching pure
 * `lib/brainstorm-session-timer.ts` transition (stamping `Date.now()` as
 * "now" unless a caller supplies one, e.g. for tests), persists the result,
 * and returns it — no timer-transition logic is duplicated here.
 *
 * `applySyncedSessionTimer` is the one exception: it writes a
 * server-provided state directly rather than applying a local transition,
 * for `hooks/useBrainstormSessionTimerSync.ts` to adopt a signed-in
 * visitor's synced timer (from another device) on mount. See
 * `lib/brainstorm-session-timer-sync.ts` for the account-sync validation
 * this pairs with.
 *
 * @module state/brainstormSessionTimer
 */

import {
  createBrainstormSessionTimer,
  pauseBrainstormSessionTimer,
  resetBrainstormSessionTimer,
  setBrainstormSessionTimerDuration,
  startBrainstormSessionTimer,
  type BrainstormSessionTimerState,
} from "../lib/brainstorm-session-timer";

const STORAGE_KEY = "brainstormSessionTimer";

function isValidState(value: unknown): value is BrainstormSessionTimerState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BrainstormSessionTimerState>;
  return (
    typeof candidate.durationSeconds === "number" &&
    (candidate.status === "idle" || candidate.status === "running" || candidate.status === "paused")
  );
}

function readState(): BrainstormSessionTimerState {
  if (typeof localStorage === "undefined") return createBrainstormSessionTimer();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createBrainstormSessionTimer();
    const parsed = JSON.parse(raw);
    return isValidState(parsed) ? parsed : createBrainstormSessionTimer();
  } catch {
    return createBrainstormSessionTimer();
  }
}

function writeState(state: BrainstormSessionTimerState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Loads the currently persisted session timer, defaulting to a fresh idle timer if none is stored. */
export function loadBrainstormSessionTimer(): BrainstormSessionTimerState {
  return readState();
}

/** Starts (or resumes) the persisted session timer; see `startBrainstormSessionTimer`. */
export function startSessionTimer(now: number = Date.now()): BrainstormSessionTimerState {
  const next = startBrainstormSessionTimer(readState(), now);
  writeState(next);
  return next;
}

/** Pauses the persisted session timer; see `pauseBrainstormSessionTimer`. */
export function pauseSessionTimer(now: number = Date.now()): BrainstormSessionTimerState {
  const next = pauseBrainstormSessionTimer(readState(), now);
  writeState(next);
  return next;
}

/** Resets the persisted session timer back to idle; see `resetBrainstormSessionTimer`. */
export function resetSessionTimer(): BrainstormSessionTimerState {
  const next = resetBrainstormSessionTimer(readState());
  writeState(next);
  return next;
}

/** Changes the persisted session timer's configured duration; see `setBrainstormSessionTimerDuration`. */
export function setSessionTimerDuration(durationSeconds: number): BrainstormSessionTimerState {
  const next = setBrainstormSessionTimerDuration(readState(), durationSeconds);
  writeState(next);
  return next;
}

/**
 * Adopts a server-provided timer state as-is (no local transition applied),
 * for syncing a signed-in visitor's timer down from their account onto this
 * browser. A malformed state is ignored and the current local state is
 * returned unchanged, so a bad sync response can't corrupt what's stored.
 */
export function applySyncedSessionTimer(state: BrainstormSessionTimerState): BrainstormSessionTimerState {
  if (!isValidState(state)) return readState();
  writeState(state);
  return state;
}
