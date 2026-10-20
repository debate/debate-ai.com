/**
 * @fileoverview Adapts the debater XP/level store (`debate-contributor-progress`'s
 * `debaterLevel` key) — one object, not an array — to the array-of-records
 * shape `TOOL_RECORD_COLLECTIONS` syncs, as a single record with a fixed id.
 *
 * The shape check is deliberately shallow: this package can't import the
 * tool's own parser (it is a leaf), and the panel already degrades a bad value
 * to a fresh state, so all that is needed here is a safe `totalXp` for
 * {@link preferHigherDebaterXp}, the field-wise {@link mergeDebaterLevel}, and
 * a refusal to write a non-object.
 *
 * Pure — no storage or network.
 *
 * @module state/debater-level-codec
 */

/** The one record's id; there is a single progression per account. */
export const DEBATER_LEVEL_RECORD_ID = "progress";

function hasValidXp(value: unknown): value is Record<string, unknown> & { totalXp: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const xp = (value as { totalXp?: unknown }).totalXp;
  return typeof xp === "number" && Number.isFinite(xp) && xp >= 0;
}

/** Wraps the stored state as one record; a missing or malformed value is no records. */
export function decodeDebaterLevel(raw: unknown): unknown[] {
  if (!hasValidXp(raw)) return [];
  return [{ ...raw, id: DEBATER_LEVEL_RECORD_ID }];
}

/** Rebuilds the stored state from records (inverse of {@link decodeDebaterLevel}). */
export function encodeDebaterLevel(records: readonly unknown[]): unknown {
  const record = records.find((r) => hasValidXp(r) && (r as { id?: unknown }).id === DEBATER_LEVEL_RECORD_ID);
  if (!record) return null;
  const { id: _id, ...state } = record as Record<string, unknown>;
  return state;
}

/**
 * Conflict rule: XP only ever grows, so when two devices both earned some
 * while apart the larger total is kept rather than the account's copy
 * blindly replacing this browser's (which would silently drop XP earned
 * offline).
 */
export function preferHigherDebaterXp(local: unknown, remote: unknown): "local" | "remote" {
  if (hasValidXp(local) && (!hasValidXp(remote) || local.totalXp > remote.totalXp)) return "local";
  return "remote";
}

/**
 * Mirrors `MAX_RECENT_XP_EVENTS` in `debate-contributor-progress`, which this
 * leaf package can't import.
 */
const MAX_RECENT_XP_EVENTS = 30;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const asCounts = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const [k, n] of Object.entries(v)) if (typeof n === "number" && Number.isFinite(n) && n >= 0) out[k] = n;
  return out;
};

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function maxCounts(a: unknown, b: unknown): Record<string, number> {
  const out = asCounts(a);
  for (const [k, n] of Object.entries(asCounts(b))) out[k] = Math.max(out[k] ?? 0, n);
  return out;
}

function unionStrings(a: unknown, b: unknown): string[] {
  return [...new Set([...asStrings(a), ...asStrings(b)])];
}

function mergeDaily(local: unknown, remote: unknown): Record<string, unknown> {
  const l = isRecord(local) ? local : {};
  const r = isRecord(remote) ? remote : {};
  const ld = typeof l.dayKey === "string" ? l.dayKey : "";
  const rd = typeof r.dayKey === "string" ? r.dayKey : "";
  // Day keys are ISO "YYYY-MM-DD", so string order is date order. Only the
  // same day's tallies can be combined; an older day's are already spent.
  if (ld !== rd) return ld > rd ? { ...l, dayKey: ld } : { ...r, dayKey: rd };
  return {
    dayKey: ld,
    counts: maxCounts(l.counts, r.counts),
    completedChallengeIds: unionStrings(l.completedChallengeIds, r.completedChallengeIds),
  };
}

function mergeRecentXp(a: unknown, b: unknown): unknown[] {
  const seen = new Set<string>();
  const events: { atMs: number }[] = [];
  for (const e of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!isRecord(e) || typeof e.atMs !== "number" || !Number.isFinite(e.atMs)) continue;
    const key = `${e.atMs}|${String(e.source)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(e as { atMs: number });
  }
  return events.sort((x, y) => y.atMs - x.atMs).slice(0, MAX_RECENT_XP_EVENTS);
}

/**
 * Field-wise merge of two copies of the progression, so work done on each
 * device survives instead of one whole record replacing the other. Every
 * field only grows (a lifetime count, a paid-out milestone), so taking the
 * per-activity maximum and the union of ids is commutative and idempotent.
 *
 * Without a shared ancestor the two devices' counts can't be told apart from
 * the same activity seen twice, so counts take the maximum rather than a sum:
 * activity both devices earned *separately* is under-counted, never
 * double-counted. `totalXp` likewise keeps the larger value.
 *
 * Falls back to {@link preferHigherDebaterXp} when either side is malformed.
 */
export function mergeDebaterLevel(local: unknown, remote: unknown): unknown {
  if (!hasValidXp(local) || !hasValidXp(remote)) {
    return preferHigherDebaterXp(local, remote) === "local" ? local : remote;
  }
  return {
    ...remote,
    ...local,
    totalXp: Math.max(local.totalXp, remote.totalXp),
    lifetimeCounts: maxCounts(local.lifetimeCounts, remote.lifetimeCounts),
    daily: mergeDaily(local.daily, remote.daily),
    completedMilestoneIds: unionStrings(local.completedMilestoneIds, remote.completedMilestoneIds),
    recentXp: mergeRecentXp(local.recentXp, remote.recentXp),
  };
}
