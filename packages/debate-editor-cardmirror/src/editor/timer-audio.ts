/**
 * Audible timer alerts (accessibility opt-in; Settings → Appearance →
 * Timer display). Beeps when the running clock crosses each
 * `timerFlashSeconds` threshold — the same alert points the visual
 * flash uses, one concept with two outputs — plus a distinct double
 * beep at 0:00.
 *
 * Two structural rules, both consequences of the timer's multi-window
 * architecture (every window + the pop-out ticks the same shared
 * state):
 *
 * EXACTLY-ONCE OWNERSHIP. A beep must fire once, not once per open
 * window. One surface holds the `cardmirror-timer-audio` Web Lock
 * and is the sole audio owner; the others queue on the lock and take
 * over automatically when the holder goes away (window closed, doc
 * reloaded). While the timer is popped out, main windows stand down
 * from the lock entirely — the float is the preferred owner because
 * an always-on-top window is never occluded and therefore never
 * timer-throttled. Where Web Locks is unavailable (old browsers) the
 * surface plays solo, accepting rare duplicates on multi-window
 * setups — sound that fires beats sound that doesn't.
 *
 * THROTTLE-PROOF SCHEDULING. The owner pre-schedules every upcoming
 * beep on the AudioContext TIMELINE (`osc.start(at)`) instead of
 * waiting on timers: Chromium throttles setTimeout/rAF in occluded
 * windows (up to a minute under intensive throttling), but audio-
 * clock scheduling is sample-accurate regardless of window state —
 * at a tournament, the signal matters most precisely when CardMirror
 * is buried behind a speech doc. Every state or settings change
 * cancels and re-derives the schedule from `runningSince + base`, so
 * pause / reset / preset loads can never leave a stale beep armed;
 * only strictly-future crossings are scheduled, so opening a window
 * (or resuming) below a threshold never retro-fires it.
 */

import { settings } from './settings.js';
import {
  getTimerState,
  getVisibleRemainingMs,
  subscribeTimer,
} from './timer-state.js';

export interface ScheduledBeep {
  /** Ms from now at which the beep fires. */
  atMs: number;
  kind: 'threshold' | 'end';
}

/** Pure schedule derivation — exported for tests. Thresholds are
 *  seconds-remaining values; only strictly-future crossings are
 *  produced (the crossing guard), plus the end-of-timer beep. */
export function computeBeepSchedule(
  remainingMs: number,
  running: boolean,
  thresholdsSec: readonly number[],
): ScheduledBeep[] {
  if (!running || remainingMs <= 0) return [];
  const out: ScheduledBeep[] = [];
  const seen = new Set<number>();
  for (const sec of thresholdsSec) {
    const t = Math.floor(sec * 1000);
    if (!(t > 0) || seen.has(t)) continue;
    seen.add(t);
    if (remainingMs > t) out.push({ atMs: remainingMs - t, kind: 'threshold' });
  }
  out.push({ atMs: remainingMs, kind: 'end' });
  return out.sort((a, b) => a.atMs - b.atMs);
}

let initialized = false;
let isPopoutSurface = false;

// ─── Ownership (Web Locks) ────────────────────────────────────────

let holdingLock = false;
/** Resolving this releases the held lock. */
let releaseLock: (() => void) | null = null;
/** Non-null while a lock request is pending or held. */
let lockAbort: AbortController | null = null;

function locksAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'locks' in navigator;
}

/** Whether this surface should compete for audio ownership right
 *  now. The float always does; main windows only while the timer
 *  is NOT popped out (the float is the preferred owner). */
function wantsOwnership(): boolean {
  return isPopoutSurface || !getTimerState().poppedOut;
}

function updateOwnershipPursuit(): void {
  if (!locksAvailable()) {
    // Solo fallback — play from this surface. See module comment.
    holdingLock = true;
    return;
  }
  if (wantsOwnership()) {
    if (lockAbort) return; // already pending or holding
    const abort = new AbortController();
    lockAbort = abort;
    navigator.locks
      .request('cardmirror-timer-audio', { signal: abort.signal }, () => {
        holdingLock = true;
        reschedule();
        // Hold until explicitly released (stand-down or teardown).
        return new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
      })
      .catch(() => {
        // Aborted while queued — expected on stand-down.
      })
      .finally(() => {
        // Lock released or request aborted: allow a future pursuit.
        holdingLock = false;
        releaseLock = null;
        if (lockAbort === abort) lockAbort = null;
        cancelScheduled();
        // Conditions may have flipped while we were winding down.
        if (wantsOwnership()) updateOwnershipPursuit();
      });
  } else if (lockAbort) {
    // Stand down: abort a queued request, release a held lock.
    lockAbort.abort();
    releaseLock?.();
  }
}

// ─── Beep synthesis on the audio clock ────────────────────────────

let ctx: AudioContext | null = null;
let scheduled: Array<{ osc: OscillatorNode; startAt: number }> = [];
let gestureHookInstalled = false;

function cancelScheduled(): void {
  // Cancel FUTURE beeps only. One already sounding plays out — every
  // oscillator gets its stop() scheduled at creation, so it's bounded
  // — because state writes land exactly when beeps fire: the expiry
  // latch broadcasts at 0:00 as the end beep starts, and a pause can
  // land mid-threshold-beep. Stopping those here clips them audibly.
  const now = ctx?.currentTime ?? 0;
  for (const s of scheduled) {
    if (s.startAt <= now) continue;
    try {
      s.osc.stop();
      s.osc.disconnect();
    } catch {
      // Already ended — fine.
    }
  }
  scheduled = [];
}

/** One-time user-gesture hook for the web edition: if the context is
 *  suspended by autoplay policy (desktop waives the policy at the
 *  Chromium level), the first interaction resumes it and re-arms the
 *  schedule. */
function installGestureResume(): void {
  if (gestureHookInstalled) return;
  gestureHookInstalled = true;
  const resume = (): void => {
    window.removeEventListener('pointerdown', resume, true);
    window.removeEventListener('keydown', resume, true);
    gestureHookInstalled = false;
    void ctx?.resume().then(() => reschedule()).catch(() => {});
  };
  window.addEventListener('pointerdown', resume, true);
  window.addEventListener('keydown', resume, true);
}

function beepAt(c: AudioContext, when: number, kind: 'threshold' | 'end', volume: number): void {
  // Perceptual-ish volume curve; 0.35 gain ceiling keeps 100% loud
  // but not clipping-adjacent.
  const peak = Math.pow(volume / 100, 2) * 0.35;
  if (peak <= 0) return;
  const pulses = kind === 'end' ? 2 : 1;
  for (let i = 0; i < pulses; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    // A5 for thresholds; the end alert steps up to B5 and pulses
    // twice — distinguishable without looking, even mid-speech.
    osc.frequency.value = kind === 'end' ? 988 : 880;
    const t0 = when + i * 0.22;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.setValueAtTime(peak, t0 + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
    scheduled.push({ osc, startAt: t0 });
  }
}

function reschedule(): void {
  cancelScheduled();
  if (!holdingLock) return;
  if (!settings.get('timerSoundEnabled')) return;
  const s = getTimerState();
  const plan = computeBeepSchedule(
    getVisibleRemainingMs(s),
    s.running,
    settings.get('timerFlashSeconds'),
  );
  if (plan.length === 0) return;
  if (typeof AudioContext === 'undefined') return;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
    if (ctx.state === 'suspended') {
      // Autoplay-blocked (web, pre-gesture): don't arm nodes against
      // a stopped clock — they'd all fire garbled on resume. The
      // gesture hook re-runs this once audio is allowed.
      installGestureResume();
      return;
    }
  }
  const volume = settings.get('timerSoundVolume');
  const base = ctx.currentTime + 0.02;
  for (const b of plan) beepAt(ctx, base + b.atMs / 1000, b.kind, volume);
}

/** Wire the audio owner into this surface. Call once at boot from
 *  the main renderer (and the pop-out with `popout: true`). */
export function initTimerAudio(opts?: { popout?: boolean }): void {
  if (initialized) return;
  initialized = true;
  isPopoutSurface = opts?.popout === true;
  subscribeTimer(() => {
    updateOwnershipPursuit();
    reschedule();
  });
  settings.subscribe(() => reschedule());
  updateOwnershipPursuit();
  reschedule();
}
