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
 * @module account-sync/debater-level-codec
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

interface XpEvent {
  id?: string;
  atMs: number;
  source: string;
  xp?: number;
  count?: number;
}

function asXpEvents(value: unknown): XpEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (e): e is XpEvent =>
      typeof e === "object" && e !== null &&
      typeof (e as { atMs?: unknown }).atMs === "number" &&
      typeof (e as { source?: unknown }).source === "string",
  );
}

function utcDay(atMs: number): string {
  return new Date(atMs).toISOString().slice(0, 10);
}

interface Side {
  totalXp: number;
  lifetimeCounts: Counts;
  daily: ReturnType<typeof asDaily>;
  events: XpEvent[];
  milestones: string[];
}

function asSide(state: Record<string, unknown> & { totalXp: number }): Side {
  return {
    totalXp: state.totalXp,
    lifetimeCounts: asCounts(state.lifetimeCounts),
    daily: asDaily(state.daily),
    events: asXpEvents(state.recentXp),
    milestones: asStrings(state.completedMilestoneIds),
  };
}

/**
 * `base` plus the ledger events only `other` has seen. An event counts as
 * unseen by `base` when its id is missing from `base`'s log and it is not older
 * than `base`'s oldest retained event (a full log has dropped older ones, so
 * those may well be included in `base`'s totals already). Events without an
 * id predate the ledger and are never added. A challenge bonus already paid
 * in `base` is not paid twice.
 */
function withUnseenEvents(base: Side, other: Side): Pick<Side, "totalXp" | "lifetimeCounts"> & { dailyCounts: Counts } {
  const known = new Set(base.events.map((e) => e.id).filter((id): id is string => !!id));
  const full = base.events.length >= MAX_RECENT_XP_EVENTS;
  const floorMs = base.events.reduce((min, e) => Math.min(min, e.atMs), Infinity);
  let totalXp = base.totalXp;
  const lifetimeCounts = { ...base.lifetimeCounts };
  const dailyCounts = { ...base.daily.counts };
  for (const e of other.events) {
    if (!e.id || known.has(e.id) || (full && e.atMs < floorMs)) continue;
    const xp = typeof e.xp === "number" && Number.isFinite(e.xp) && e.xp > 0 ? e.xp : 0;
    const isActivity = typeof e.count === "number" && Number.isFinite(e.count) && e.count > 0;
    if (isActivity) {
      lifetimeCounts[e.source] = (lifetimeCounts[e.source] ?? 0) + (e.count as number);
      if (utcDay(e.atMs) === base.daily.dayKey) dailyCounts[e.source] = (dailyCounts[e.source] ?? 0) + (e.count as number);
    } else if (base.milestones.includes(e.source) || base.daily.completedChallengeIds.includes(e.source)) {
      continue;
    }
    totalXp += xp;
  }
  return { totalXp, lifetimeCounts, dailyCounts };
}

interface Tally {
  xp: number;
  counts: Counts;
  daily?: { dayKey: string; counts: Counts };
}
interface Ledger {
  base: Tally;
  devices: Record<string, Tally>;
}

function asTally(value: unknown): Tally | null {
  if (typeof value !== "object" || value === null) return null;
  const { xp, counts } = value as { xp?: unknown; counts?: unknown };
  if (typeof xp !== "number" || !Number.isFinite(xp) || xp < 0) return null;
  const daily = (value as { daily?: unknown }).daily as { dayKey?: unknown; counts?: unknown } | undefined;
  if (daily && typeof daily.dayKey === "string") {
    return { xp, counts: asCounts(counts), daily: { dayKey: daily.dayKey, counts: asCounts(daily.counts) } };
  }
  return { xp, counts: asCounts(counts) };
}

function asLedger(value: unknown): Ledger | null {
  if (typeof value !== "object" || value === null) return null;
  const { base, devices } = value as { base?: unknown; devices?: unknown };
  const parsedBase = asTally(base);
  if (!parsedBase || typeof devices !== "object" || devices === null || Array.isArray(devices)) return null;
  const out: Record<string, Tally> = {};
  for (const [id, tally] of Object.entries(devices)) {
    const parsed = asTally(tally);
    if (parsed) out[id] = parsed;
  }
  return { base: parsedBase, devices: out };
}

/** The same entry seen twice: per-day tallies merge by max within a day, and the later day wins otherwise. */
function maxDaily(a: Tally["daily"], b: Tally["daily"]): Tally["daily"] {
  if (!a || !b) return a ?? b;
  if (a.dayKey === b.dayKey) return { dayKey: a.dayKey, counts: maxCounts(a.counts, b.counts) };
  return a.dayKey > b.dayKey ? a : b;
}

function maxTally(a: Tally, b: Tally): Tally {
  const daily = maxDaily(a.daily, b.daily);
  return { xp: Math.max(a.xp, b.xp), counts: maxCounts(a.counts, b.counts), ...(daily ? { daily } : {}) };
}

function mergeLedgers(local: unknown, remote: unknown): Ledger | null {
  const a = asLedger(local);
  const b = asLedger(remote);
  if (!a || !b) return a ?? b;
  const devices: Record<string, Tally> = { ...a.devices };
  for (const [id, tally] of Object.entries(b.devices)) {
    devices[id] = devices[id] ? maxTally(devices[id], tally) : tally;
  }
  return { base: maxTally(a.base, b.base), devices };
}

function ledgerTotal(ledger: Ledger): number {
  return Object.values(ledger.devices).reduce((sum, d) => sum + d.xp, ledger.base.xp);
}

function ledgerCounts(ledger: Ledger): Counts {
  const out: Counts = { ...ledger.base.counts };
  for (const d of Object.values(ledger.devices)) {
    for (const [kind, n] of Object.entries(d.counts)) out[kind] = (out[kind] ?? 0) + n;
  }
  return out;
}

/** Base plus every device's tally for `dayKey`; entries from another day (or without a per-day tally) add nothing. */
function ledgerDailyCounts(ledger: Ledger, dayKey: string): Counts {
  const out: Counts = {};
  for (const tally of [ledger.base, ...Object.values(ledger.devices)]) {
    if (tally.daily?.dayKey !== dayKey) continue;
    for (const [kind, n] of Object.entries(tally.daily.counts)) out[kind] = (out[kind] ?? 0) + n;
  }
  return out;
}

/**
 * Conflict rule that supersedes {@link preferHigherDebaterXp}: combine the two
 * copies field by field instead of keeping one whole record, so activity
 * earned on each device survives. Milestones are a union, today's tally is
 * merged only when both copies are from the same UTC day (otherwise the later
 * day wins), and the XP log is the newest-first union, de-duplicated by id
 * (time and source for events logged before ids existed).
 *
 * When a copy carries a per-device `ledger` (each device only grows its own
 * entry), the ledgers merge entry by entry and `totalXp` / `lifetimeCounts`
 * are rebuilt as base + every device, so work done on two devices adds up;
 * today's per-activity counts are rebuilt the same way from the per-day
 * tallies on the entries.
 * Each copy also gains the per-event log entries (by id) only the other has
 * seen, and the larger result wins per field, which adds activity from two
 * devices even without a ledger. Copies with neither (older clients) fall
 * back to the larger side, which can under-count but never double-count.
 */
export function mergeDebaterLevel(local: unknown, remote: unknown): unknown {
  if (!hasValidXp(local)) return remote;
  if (!hasValidXp(remote)) return local;
  const l = asSide(local);
  const r = asSide(remote);
  const vl = withUnseenEvents(l, r);
  const vr = withUnseenEvents(r, l);
  const dl = { ...l.daily, counts: maxCounts(l.daily.counts, vl.dailyCounts) };
  const dr = { ...r.daily, counts: maxCounts(r.daily.counts, vr.dailyCounts) };
  const daily: ReturnType<typeof asDaily> =
    dl.dayKey === dr.dayKey
      ? {
          dayKey: dl.dayKey,
          counts: maxCounts(dl.counts, dr.counts),
          completedChallengeIds: union(dl.completedChallengeIds, dr.completedChallengeIds),
        }
      : dl.dayKey > dr.dayKey
        ? dl
        : dr;
  const ledger = mergeLedgers(local.ledger, remote.ledger);
  if (ledger) daily.counts = maxCounts(daily.counts, ledgerDailyCounts(ledger, daily.dayKey));
  const seen = new Set<string>();
  const recentXp = [...l.events, ...r.events]
    .filter((e) => {
      const key = e.id ?? `${e.atMs}|${e.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, MAX_RECENT_XP_EVENTS);
  let totalXp = Math.max(local.totalXp, remote.totalXp, vl.totalXp, vr.totalXp);
  let lifetimeCounts = maxCounts(
    maxCounts(l.lifetimeCounts, r.lifetimeCounts),
    maxCounts(vl.lifetimeCounts, vr.lifetimeCounts),
  );
  if (ledger) {
    totalXp = Math.max(totalXp, ledgerTotal(ledger));
    lifetimeCounts = maxCounts(lifetimeCounts, ledgerCounts(ledger));
  }
  if (ledger) daily.counts = maxCounts(daily.counts, ledgerDailyCounts(ledger, daily.dayKey));
  const { ledger: _l, ...localRest } = local;
  const { ledger: _r, ...remoteRest } = remote;
  return {
    ...remoteRest,
    ...localRest,
    ...(ledger ? { ledger } : {}),
    totalXp,
    lifetimeCounts,
    daily,
    completedMilestoneIds: union(l.milestones, r.milestones),
    recentXp,
  };
}
