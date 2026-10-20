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

type LedgerEntry = { xp: number; counts: Counts };

function asLedgerEntry(value: unknown): LedgerEntry {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const xp = typeof v.xp === "number" && Number.isFinite(v.xp) && v.xp >= 0 ? v.xp : 0;
  return { xp, counts: asCounts(v.counts) };
}

function maxEntries(a: LedgerEntry, b: LedgerEntry): LedgerEntry {
  return { xp: Math.max(a.xp, b.xp), counts: maxCounts(a.counts, b.counts) };
}

/** A copy's ledger; a copy with none is all base (its totals), with no device earnings. */
function ledgerOf(state: Record<string, unknown> & { totalXp: number }): {
  base: LedgerEntry;
  devices: Record<string, LedgerEntry>;
  hasLedger: boolean;
} {
  const raw = state.ledger as { base?: unknown; devices?: unknown } | undefined;
  if (typeof raw !== "object" || raw === null) {
    return { base: { xp: state.totalXp, counts: asCounts(state.lifetimeCounts) }, devices: {}, hasLedger: false };
  }
  const devices: Record<string, LedgerEntry> = {};
  if (typeof raw.devices === "object" && raw.devices !== null && !Array.isArray(raw.devices)) {
    for (const [id, entry] of Object.entries(raw.devices)) devices[id] = asLedgerEntry(entry);
  }
  return { base: asLedgerEntry(raw.base), devices, hasLedger: true };
}

/**
 * Merges the per-device earnings of two copies: the base and each device's
 * entry take the per-field maximum (a device only ever grows its own entry),
 * and the totals are the base plus the sum over devices. `null` when neither
 * copy has a ledger.
 */
function mergeLedgers(
  local: Record<string, unknown> & { totalXp: number },
  remote: Record<string, unknown> & { totalXp: number },
): {
  ledger: { base: LedgerEntry; devices: Record<string, LedgerEntry> };
  totalXp: number;
  lifetimeCounts: Counts;
} | null {
  const l = ledgerOf(local);
  const r = ledgerOf(remote);
  if (!l.hasLedger && !r.hasLedger) return null;
  const base = maxEntries(l.base, r.base);
  const devices: Record<string, LedgerEntry> = {};
  for (const id of new Set([...Object.keys(l.devices), ...Object.keys(r.devices)])) {
    devices[id] = maxEntries(l.devices[id] ?? { xp: 0, counts: {} }, r.devices[id] ?? { xp: 0, counts: {} });
  }
  let totalXp = base.xp;
  const lifetimeCounts: Counts = { ...base.counts };
  for (const entry of Object.values(devices)) {
    totalXp += entry.xp;
    for (const [kind, n] of Object.entries(entry.counts)) lifetimeCounts[kind] = (lifetimeCounts[kind] ?? 0) + n;
  }
  return { ledger: { base, devices }, totalXp, lifetimeCounts };
}

/**
 * Conflict rule that supersedes {@link preferHigherDebaterXp}: combine the two
 * copies field by field instead of keeping one whole record, so activity
 * earned on each device survives. Counts, totals and milestones only ever
 * grow, so the per-kind maximum / union is safe; today's tally is merged only
 * when both copies are from the same UTC day, otherwise the later day wins;
 * the XP log is the newest-first union, de-duplicated by time and source.
 *
 * Without a per-device `ledger` the same activity done on both devices can't
 * be told from two separate ones, so counts take the larger side (never a sum)
 * and the result can under-count but never double-count. When either copy has
 * a ledger, `totalXp` and `lifetimeCounts` are rebuilt as the pre-ledger base
 * plus every device's own earnings (see {@link mergeLedgers}), so activity
 * done on two devices adds. Today's tally and challenge bonuses still use the
 * rules above.
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
  const totals = {
    totalXp: Math.max(local.totalXp, remote.totalXp),
    lifetimeCounts: maxCounts(asCounts(local.lifetimeCounts), asCounts(remote.lifetimeCounts)),
  };
  const ledger = mergeLedgers(local, remote);
  return {
    ...remote,
    ...local,
    ...totals,
    ...(ledger ? { ledger: ledger.ledger, totalXp: ledger.totalXp, lifetimeCounts: ledger.lifetimeCounts } : {}),
    daily,
    completedMilestoneIds: union(asStrings(local.completedMilestoneIds), asStrings(remote.completedMilestoneIds)),
    recentXp,
  };
}
