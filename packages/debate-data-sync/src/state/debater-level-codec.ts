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
 * Superseded by {@link mergeDebaterLevel}, kept as the whole-record rule: XP only ever grows, so when two devices both earned some
 * while apart the larger total is kept rather than the account's copy
 * blindly replacing this browser's (which would silently drop XP earned
 * offline).
 */
export function preferHigherDebaterXp(local: unknown, remote: unknown): "local" | "remote" {
  if (hasValidXp(local) && (!hasValidXp(remote) || local.totalXp > remote.totalXp)) return "local";
  return "remote";
}

/** Mirrors `MAX_RECENT_XP_EVENTS` in `debate-contributor-progress` (this package is a leaf). */
const MAX_RECENT_XP_EVENTS = 30;

type Counts = Record<string, number>;

function asCounts(value: unknown): Counts {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Counts = {};
  for (const [kind, n] of Object.entries(value)) {
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) out[kind] = n;
  }
  return out;
}

function maxCounts(a: Counts, b: Counts): Counts {
  const out: Counts = { ...a };
  for (const [kind, n] of Object.entries(b)) out[kind] = Math.max(out[kind] ?? 0, n);
  return out;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

function asDaily(value: unknown): { dayKey: string; counts: Counts; completedChallengeIds: string[] } {
  const d = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    dayKey: typeof d.dayKey === "string" ? d.dayKey : "",
    counts: asCounts(d.counts),
    completedChallengeIds: asStrings(d.completedChallengeIds),
  };
}

function asXpEvents(value: unknown): { atMs: number; source: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (e): e is { atMs: number; source: string } =>
      typeof e === "object" && e !== null &&
      typeof (e as { atMs?: unknown }).atMs === "number" &&
      typeof (e as { source?: unknown }).source === "string",
  );
}

/** Mirrors `MAX_LEDGER_ENTRIES` in `debate-contributor-progress`. */
const MAX_LEDGER_ENTRIES = 200;

interface LedgerBonus {
  id: string;
  xp: number;
  repeat: "daily" | "once";
}

interface LedgerEntry {
  id: string;
  atMs: number;
  kind: string;
  count: number;
  xp: number;
  bonuses: LedgerBonus[];
}

/** The ledger as a list, or `null` when the state predates it (so the max rule applies). */
function asLedger(value: unknown): LedgerEntry[] | null {
  if (!Array.isArray(value)) return null;
  const out: LedgerEntry[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const e = item as Record<string, unknown>;
    if (
      typeof e.id !== "string" ||
      typeof e.atMs !== "number" ||
      typeof e.kind !== "string" ||
      typeof e.count !== "number" ||
      !(e.count >= 0) ||
      typeof e.xp !== "number" ||
      !(e.xp >= 0)
    ) {
      continue;
    }
    const bonuses = (Array.isArray(e.bonuses) ? e.bonuses : []).filter(
      (b): b is LedgerBonus =>
        typeof b === "object" && b !== null &&
        typeof (b as LedgerBonus).id === "string" &&
        typeof (b as LedgerBonus).xp === "number" && (b as LedgerBonus).xp >= 0 &&
        ((b as LedgerBonus).repeat === "daily" || (b as LedgerBonus).repeat === "once"),
    );
    out.push({ id: e.id, atMs: e.atMs, kind: e.kind, count: e.count, xp: e.xp, bonuses });
  }
  return out;
}

const dayOf = (atMs: number) => new Date(atMs).toISOString().slice(0, 10);
const bonusKey = (b: LedgerBonus, atMs: number) => (b.repeat === "daily" ? `${b.id}@${dayOf(atMs)}` : b.id);

/**
 * What `base` would total if it also had every event only `other` recorded.
 * An event is "missing" from `base` only if its id is absent AND `base`'s
 * bounded ledger can't have evicted it (it isn't full, or the event is newer
 * than its oldest entry) — otherwise it may already be counted and adding it
 * would double-count. A challenge bonus both sides paid is added once.
 */
function withMissingEvents(
  base: Record<string, unknown> & { totalXp: number },
  baseLedger: LedgerEntry[],
  otherLedger: LedgerEntry[],
  todayKey: string,
): { totalXp: number; lifetime: Counts; today: Counts } {
  const known = new Set(baseLedger.map((e) => e.id));
  const oldest = baseLedger.length >= MAX_LEDGER_ENTRIES ? Math.min(...baseLedger.map((e) => e.atMs)) : -Infinity;
  const paid = new Set(asStrings(base.completedMilestoneIds));
  for (const e of baseLedger) for (const b of e.bonuses) paid.add(bonusKey(b, e.atMs));
  const lifetime = asCounts(base.lifetimeCounts);
  const today: Counts = { ...asDaily(base.daily).counts };
  let totalXp = base.totalXp;
  const seenMissing = new Set<string>();
  for (const e of otherLedger) {
    if (known.has(e.id) || seenMissing.has(e.id) || e.atMs < oldest) continue;
    seenMissing.add(e.id);
    totalXp += e.xp;
    lifetime[e.kind] = (lifetime[e.kind] ?? 0) + e.count;
    if (dayOf(e.atMs) === todayKey) today[e.kind] = (today[e.kind] ?? 0) + e.count;
    for (const b of e.bonuses) {
      const key = bonusKey(b, e.atMs);
      if (paid.has(key)) continue;
      paid.add(key);
      totalXp += b.xp;
    }
  }
  return { totalXp, lifetime, today };
}

/**
 * Conflict rule that supersedes {@link preferHigherDebaterXp}: combine the two
 * copies field by field instead of keeping one whole record, so activity
 * earned on each device survives. Counts, totals and milestones only ever
 * grow, so the per-kind maximum / union is safe; today's tally is merged only
 * when both copies are from the same UTC day, otherwise the later day wins;
 * the XP log is the newest-first union, de-duplicated by time and source.
 *
 * When both copies carry an activity `ledger` (unique id per recorded event),
 * the activity each side is missing is added to the other: XP and counts sum
 * rather than take the larger side, and the ledgers are unioned. Without a
 * ledger on either side the same activity done on both devices can't be told
 * from two separate ones, so counts take the larger side (never a sum) and the
 * result can under-count but never double-count.
 */
export function mergeDebaterLevel(local: unknown, remote: unknown): unknown {
  if (!hasValidXp(local)) return remote;
  if (!hasValidXp(remote)) return local;
  const dl = asDaily(local.daily);
  const dr = asDaily(remote.daily);
  const daily =
    dl.dayKey === dr.dayKey
      ? {
          dayKey: dl.dayKey,
          counts: maxCounts(dl.counts, dr.counts),
          completedChallengeIds: union(dl.completedChallengeIds, dr.completedChallengeIds),
        }
      : dl.dayKey > dr.dayKey
        ? dl
        : dr;
  const seen = new Set<string>();
  const recentXp = [...asXpEvents(local.recentXp), ...asXpEvents(remote.recentXp)]
    .filter((e) => {
      const key = `${e.atMs}|${e.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, MAX_RECENT_XP_EVENTS);
  const merged: Record<string, unknown> & { totalXp: number } = {
    ...remote,
    ...local,
    totalXp: Math.max(local.totalXp, remote.totalXp),
    lifetimeCounts: maxCounts(asCounts(local.lifetimeCounts), asCounts(remote.lifetimeCounts)),
    daily,
    completedMilestoneIds: union(asStrings(local.completedMilestoneIds), asStrings(remote.completedMilestoneIds)),
    recentXp,
  };
  const ll = asLedger(local.ledger);
  const rl = asLedger(remote.ledger);
  if (!ll || !rl) return merged;

  // Each side plus what the other recorded; the max of the two is the same
  // total from either direction, and never below the plain max rule above.
  const mergedDay = merged.daily as { dayKey: string; counts: Counts };
  const a = withMissingEvents(local, ll, rl, mergedDay.dayKey);
  const b = withMissingEvents(remote, rl, ll, mergedDay.dayKey);
  merged.totalXp = Math.max(merged.totalXp, a.totalXp, b.totalXp);
  merged.lifetimeCounts = maxCounts(maxCounts(merged.lifetimeCounts as Counts, a.lifetime), b.lifetime);
  if (dl.dayKey === dr.dayKey) mergedDay.counts = maxCounts(maxCounts(mergedDay.counts, a.today), b.today);
  const byId = new Map<string, LedgerEntry>();
  for (const e of [...ll, ...rl]) if (!byId.has(e.id)) byId.set(e.id, e);
  merged.ledger = [...byId.values()].sort((x, y) => y.atMs - x.atMs || (x.id < y.id ? -1 : 1)).slice(0, MAX_LEDGER_ENTRIES);
  return merged;
}
