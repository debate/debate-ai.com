/**
 * Learn — the binary, Orbit-flavored scheduler (pure; no I/O).
 *
 * One-tap "remembered / forgot" is a binary signal, so we use a simple,
 * transparent interval ladder with no ease factor (SPEC-learn-system §5).
 * Persisted fields are a superset of what v1 uses, so FSRS can swap in
 * later without a migration.
 *
 * Day granularity is local-day: dates are `YYYY-MM-DD` strings and the
 * caller supplies "today" (computed in local time). All arithmetic here
 * is on those date strings — no clock, no timezone, so it's deterministic
 * and testable.
 */

export type CardState = 'new' | 'learning' | 'review' | 'suspended';
export type Grade = 'remembered' | 'forgot';

export interface ScheduleEntry {
  cardId: string;
  state: CardState;
  /** Local day the card is next due, `YYYY-MM-DD`. */
  dueOn: string;
  intervalDays: number;
  reps: number;
  lapses: number;
  lastReviewed: string | null; // ISO timestamp
  // FSRS-ready (unused in v1): stability?: number; difficulty?: number;
}

// ── Constants (v1, tunable; SPEC §5) ────────────────────────────────
export const FIRST_INTERVAL = 1; // days, after a new card's first "remembered"
export const GROWTH = 2.3; // interval multiplier on "remembered"
export const MAX_INTERVAL = 365; // days
export const RELEARN_INTERVAL = 1; // days, after a lapse's first re-success
const FUZZ = 0.1; // ±10% spread to avoid due-date pile-ups

/** A fresh schedule entry for a newly created card: due today. */
export function newSchedule(cardId: string, today: string): ScheduleEntry {
  return {
    cardId,
    state: 'new',
    dueOn: today,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    lastReviewed: null,
  };
}

/** Result of grading: the next entry, plus whether the card should be
 *  shown again before the session ends (Orbit retry-after-failure). */
export interface GradeResult {
  entry: ScheduleEntry;
  retryInSession: boolean;
}

/**
 * Apply a grade. `rng` (0..1) drives the due-date fuzz; pass a fixed
 * value in tests for determinism (0.5 ⇒ no fuzz). `now` is the ISO
 * timestamp recorded as `lastReviewed`.
 */
export function gradeCard(
  entry: ScheduleEntry,
  grade: Grade,
  today: string,
  now: string,
  rng: () => number = Math.random,
): GradeResult {
  if (grade === 'remembered') {
    const relearning = entry.state === 'learning' && entry.lapses > 0;
    let intervalDays: number;
    if (entry.state === 'new' || entry.state === 'learning') {
      intervalDays = relearning ? RELEARN_INTERVAL : FIRST_INTERVAL;
    } else {
      // review
      intervalDays = Math.min(Math.round(entry.intervalDays * GROWTH), MAX_INTERVAL);
    }
    return {
      entry: {
        ...entry,
        state: 'review',
        intervalDays,
        reps: entry.reps + 1,
        dueOn: addDays(today, fuzzInterval(intervalDays, rng)),
        lastReviewed: now,
      },
      retryInSession: false,
    };
  }
  // forgot
  return {
    entry: {
      ...entry,
      state: 'learning',
      intervalDays: 0,
      reps: 0,
      lapses: entry.lapses + 1,
      // Wants a near-term repetition even after the in-session retry.
      dueOn: addDays(today, 1),
      lastReviewed: now,
    },
    retryInSession: true,
  };
}

/** Is the card due on or before `today` (and not suspended)? */
export function isDue(entry: ScheduleEntry, today: string): boolean {
  return entry.state !== 'suspended' && entry.dueOn <= today;
}

/**
 * Build a review queue from a scope's schedule entries: the due cards,
 * deduped by `cardId` (a card present in several file-copies is reviewed
 * once), new/learning cards before reviews, then by due date. The session
 * UI owns retry-after-failure re-enqueuing at runtime.
 */
export function buildQueue(entries: readonly ScheduleEntry[], today: string): ScheduleEntry[] {
  const byCard = new Map<string, ScheduleEntry>();
  for (const e of entries) {
    if (!isDue(e, today)) continue;
    const prev = byCard.get(e.cardId);
    // On duplicates keep the one due soonest (most-progressed copy).
    if (!prev || e.dueOn < prev.dueOn) byCard.set(e.cardId, e);
  }
  const rank = (s: CardState): number => (s === 'new' || s === 'learning' ? 0 : 1);
  return [...byCard.values()].sort(
    (a, b) => rank(a.state) - rank(b.state) || a.dueOn.localeCompare(b.dueOn),
  );
}

/** Count of distinct cards due in a scope (for home-screen badges). */
export function dueCount(entries: readonly ScheduleEntry[], today: string): number {
  const ids = new Set<string>();
  for (const e of entries) if (isDue(e, today)) ids.add(e.cardId);
  return ids.size;
}

// ── Date helpers (pure, `YYYY-MM-DD`) ───────────────────────────────

/** Add `n` days to a `YYYY-MM-DD` date string. UTC-based so it's free of
 *  DST/timezone effects — these are date-only values. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function fuzzInterval(intervalDays: number, rng: () => number): number {
  if (intervalDays <= 1) return intervalDays; // nothing meaningful to spread
  const factor = 1 + (rng() * 2 - 1) * FUZZ;
  return Math.max(1, Math.round(intervalDays * factor));
}
