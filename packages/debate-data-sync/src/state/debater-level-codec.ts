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

/**
 * Conflict rule that supersedes {@link preferHigherDebaterXp}: combine the two
 * copies field by field instead of keeping one whole record, so activity
 * earned on each device survives. Counts, totals and milestones only ever
 * grow, so the per-kind maximum / union is safe; today's tally is merged only
 * when both copies are from the same UTC day, otherwise the later day wins;
 * the XP log is the newest-first union, de-duplicated by time and source.
 *
 * States carrying a per-device `ledger` merge through {@link mergeLedgers}
 * instead, so activity done on two devices in the same window adds. A copy
 * without one (pre-ledger) can't be told apart from the other device's work,
 * so it is folded in as the shared `base` bucket and counts take the larger
 * side — it can under-count but never double-count.
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
  const merged = {
    ...remote,
    ...local,
    totalXp: Math.max(local.totalXp, remote.totalXp),
    lifetimeCounts: maxCounts(asCounts(local.lifetimeCounts), asCounts(remote.lifetimeCounts)),
    daily,
    completedMilestoneIds: union(asStrings(local.completedMilestoneIds), asStrings(remote.completedMilestoneIds)),
    recentXp,
  };
  if (!local.ledger && !remote.ledger) return merged;
  const ledger = mergeLedgers(ledgerOf(local), ledgerOf(remote));
  const sums = sumLedger(ledger);
  return {
    ...merged,
    ledger,
    totalXp: Math.max(sums.xp, merged.totalXp),
    lifetimeCounts: sums.counts,
    daily: { ...daily, dayKey: sums.day || daily.dayKey, counts: sums.dayCounts },
  };
}

interface LedgerEntry {
  xp: number;
  counts: Counts;
  day: string;
  dayCounts: Counts;
}

/** Mirrors `LEDGER_BASE_DEVICE` in `debate-contributor-progress`. */
const LEDGER_BASE_DEVICE = "base";

function asLedgerEntry(value: unknown): LedgerEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const e = value as Record<string, unknown>;
  if (typeof e.xp !== "number" || !Number.isFinite(e.xp) || e.xp < 0 || typeof e.day !== "string") return null;
  return { xp: e.xp, counts: asCounts(e.counts), day: e.day, dayCounts: asCounts(e.dayCounts) };
}

/** The state's ledger, or — for a pre-ledger copy — its progress as the shared base bucket. */
function ledgerOf(state: Record<string, unknown> & { totalXp: number }): Record<string, LedgerEntry> {
  const out: Record<string, LedgerEntry> = {};
  if (typeof state.ledger === "object" && state.ledger !== null && !Array.isArray(state.ledger)) {
    for (const [id, raw] of Object.entries(state.ledger)) {
      const entry = asLedgerEntry(raw);
      if (entry) out[id] = entry;
    }
    if (Object.keys(out).length > 0) return out;
  }
  const daily = asDaily(state.daily);
  return {
    [LEDGER_BASE_DEVICE]: { xp: state.totalXp, counts: asCounts(state.lifetimeCounts), day: daily.dayKey, dayCounts: daily.counts },
  };
}

/**
 * Each device's entry only grows, so the two copies of one device's entry
 * merge by maximum; entries from different devices are kept side by side.
 */
function mergeLedgers(a: Record<string, LedgerEntry>, b: Record<string, LedgerEntry>): Record<string, LedgerEntry> {
  const out: Record<string, LedgerEntry> = { ...a };
  for (const [id, entry] of Object.entries(b)) {
    const mine = out[id];
    if (!mine) {
      out[id] = entry;
      continue;
    }
    const day = mine.day >= entry.day ? mine.day : entry.day;
    const sameDay = mine.day === entry.day;
    out[id] = {
      xp: Math.max(mine.xp, entry.xp),
      counts: maxCounts(mine.counts, entry.counts),
      day,
      dayCounts: sameDay ? maxCounts(mine.dayCounts, entry.dayCounts) : mine.day > entry.day ? mine.dayCounts : entry.dayCounts,
    };
  }
  return out;
}

/** Account-wide totals: XP and lifetime counts across devices, and the latest day's counts. */
function sumLedger(ledger: Record<string, LedgerEntry>): { xp: number; counts: Counts; day: string; dayCounts: Counts } {
  let xp = 0;
  let day = "";
  const counts: Counts = {};
  for (const entry of Object.values(ledger)) {
    xp += entry.xp;
    for (const [kind, n] of Object.entries(entry.counts)) counts[kind] = (counts[kind] ?? 0) + n;
    if (entry.day > day) day = entry.day;
  }
  const dayCounts: Counts = {};
  for (const entry of Object.values(ledger)) {
    if (entry.day !== day) continue;
    for (const [kind, n] of Object.entries(entry.dayCounts)) dayCounts[kind] = (dayCounts[kind] ?? 0) + n;
  }
  return { xp, counts, day, dayCounts };
}
