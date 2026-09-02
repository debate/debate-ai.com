/**
 * @fileoverview Pure countdown-timer helpers for `BrainstormBoardPanel`'s
 * "an optional brainstorm-session timer" follow-up named under the "🧠 Team
 * Brainstorm Assist" bullet in TODO.md ("polish the idea-ranking UI ...; an
 * optional brainstorm-session timer"). Models a single squad-wide countdown
 * (start/pause/resume/reset, a configurable duration) a moderator can run
 * to time-box a brainstorm sprint before boards get reviewed. Deliberately
 * pure and clock-injected (every function that needs "now" takes it as a
 * parameter) so it's directly testable without faking global timers; the
 * persistence/wall-clock-reading wrapper lives in
 * `state/brainstormSessionTimer.ts`.
 *
 * @module lib/brainstorm-session-timer
 */

/** A squad brainstorm-session countdown's current state. */
export interface BrainstormSessionTimerState {
  /** The countdown length, in seconds, applied the next time the timer is started. */
  durationSeconds: number;
  status: "idle" | "running" | "paused";
  /** Epoch ms the countdown reaches zero at; set only while `status === "running"`. */
  endsAt: number | null;
  /** Seconds left when paused; set only while `status === "paused"`. */
  remainingSecondsWhenPaused: number | null;
}

/** Duration presets offered by the panel's timer widget, in seconds (3/5/10/15 minutes). */
export const BRAINSTORM_SESSION_TIMER_PRESETS_SECONDS = [180, 300, 600, 900] as const;

/** Default countdown length for a freshly created timer (5 minutes). */
export const DEFAULT_BRAINSTORM_SESSION_TIMER_SECONDS = 300;

/** Builds a fresh, idle timer at the given duration (defaults to 5 minutes). */
export function createBrainstormSessionTimer(
  durationSeconds: number = DEFAULT_BRAINSTORM_SESSION_TIMER_SECONDS,
): BrainstormSessionTimerState {
  return { durationSeconds, status: "idle", endsAt: null, remainingSecondsWhenPaused: null };
}

/**
 * Starts (or resumes, from `"paused"`) the countdown. Resuming continues
 * from the paused remaining time rather than restarting at the full
 * duration; starting fresh from `"idle"` (or restarting an already-`"running"`
 * timer) uses the full configured duration.
 */
export function startBrainstormSessionTimer(
  state: BrainstormSessionTimerState,
  now: number,
): BrainstormSessionTimerState {
  const remainingSeconds =
    state.status === "paused" && state.remainingSecondsWhenPaused !== null
      ? state.remainingSecondsWhenPaused
      : state.durationSeconds;
  return { ...state, status: "running", endsAt: now + remainingSeconds * 1000, remainingSecondsWhenPaused: null };
}

/** Pauses a running countdown, freezing its remaining time. A no-op when not currently running. */
export function pauseBrainstormSessionTimer(
  state: BrainstormSessionTimerState,
  now: number,
): BrainstormSessionTimerState {
  if (state.status !== "running") return state;
  return {
    ...state,
    status: "paused",
    endsAt: null,
    remainingSecondsWhenPaused: getBrainstormSessionTimerRemainingSeconds(state, now),
  };
}

/** Resets the timer back to idle at its currently configured duration. */
export function resetBrainstormSessionTimer(state: BrainstormSessionTimerState): BrainstormSessionTimerState {
  return { ...state, status: "idle", endsAt: null, remainingSecondsWhenPaused: null };
}

/**
 * Changes the countdown's configured duration. Only takes effect while
 * `"idle"` — a no-op mid-session (running or paused) so changing the preset
 * can't silently rewrite a countdown already in progress.
 */
export function setBrainstormSessionTimerDuration(
  state: BrainstormSessionTimerState,
  durationSeconds: number,
): BrainstormSessionTimerState {
  if (state.status !== "idle") return state;
  return { ...state, durationSeconds };
}

/** Seconds remaining right now — the full duration while idle, the frozen value while paused. */
export function getBrainstormSessionTimerRemainingSeconds(state: BrainstormSessionTimerState, now: number): number {
  if (state.status === "idle") return state.durationSeconds;
  if (state.status === "paused") return state.remainingSecondsWhenPaused ?? state.durationSeconds;
  return Math.max(0, Math.ceil(((state.endsAt ?? now) - now) / 1000));
}

/** True once a running countdown has reached zero (it isn't auto-paused/reset — the caller decides what to do). */
export function isBrainstormSessionTimerExpired(state: BrainstormSessionTimerState, now: number): boolean {
  return state.status === "running" && getBrainstormSessionTimerRemainingSeconds(state, now) <= 0;
}

/** Formats a seconds count as `"M:SS"` (e.g. `125` → `"2:05"`); negative input clamps to `"0:00"`. */
export function formatBrainstormSessionTimerRemaining(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
