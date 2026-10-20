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
type Ledger = { base: LedgerEntry; devices: Record<string, LedgerEntry> };

function asLedgerEntry(value: unknown): LedgerEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const { xp, counts } = value as { xp?: unknown; counts?: unknown };
  if (typeof xp !== "number" || !Number.isFinite(xp) || xp < 0) return null;
  return { xp, counts: asCounts(counts) };
}

function asLedger(value: unknown): Ledger | null {
  if (typeof value !== "object" || value === null) return null;
  const { base: rawBase, devices: rawDevices } = value as { base?: unknown; devices?: unknown };
  const base = asLedgerEntry(rawBase);
  if (!base || typeof rawDevices !== "object" || rawDevices === null || Array.isArray(rawDevices)) return null;
  const devices: Record<string, LedgerEntry> = {};
  for (const [id, entry] of Object.entries(rawDevices)) {
    const parsed = asLedgerEntry(entry);
    if (parsed) devices[id] = parsed;
  }
  return { base, devices };
}

/** Each device's entry only grows, so per-device max (plus the shared base's max) loses nothing. */
function mergeLedgers(a: Ledger, b: Ledger): Ledger {
  const maxEntry = (x: LedgerEntry, y: LedgerEntry): LedgerEntry => ({
    xp: Math.max(x.xp, y.xp),
    counts: maxCounts(x.counts, y.counts),
  });
  const devices: Record<string, LedgerEntry> = { ...a.devices };
  for (const [id, entry] of Object.entries(b.devices)) {
    devices[id] = devices[id] ? maxEntry(devices[id], entry) : entry;
  }
  return { base: maxEntry(a.base, b.base), devices };
}

function ledgerTotals(ledger: Ledger): LedgerEntry {
  let xp = ledger.base.xp;
  let counts = ledger.base.counts;
  for (const entry of Object.values(ledger.devices)) {
    xp += entry.xp;
    const summed: Counts = { ...counts };
    for (const [kind, n] of Object.entries(entry.counts)) summed[kind] = (summed[kind] ?? 0) + n;
    counts = summed;
  }
  return { xp, counts };
}

/**
 * Conflict rule that supersedes {@link preferHigherDebaterXp}: combine the two
 * copies field by field instead of keeping one whole record, so activity
 * earned on each device survives. Counts, totals and milestones only ever
 * grow, so the per-kind maximum / union is safe; today's tally is merged only
 * when both copies are from the same UTC day, otherwise the later day wins;
 * the XP log is the newest-first union, de-duplicated by time and source.
 *
 * When both copies carry a per-device ledger, the ledgers merge per device
 * and the totals are rebuilt as base + the sum over devices, so activity done
 * on two devices adds. Without a ledger on either side the same activity can't
 * be told from two separate ones, so counts take the larger side (never a sum)
 * and the result can under-count but never double-count. (The ledger sums
 * challenge bonuses too, so a one-time milestone reached on two devices
 * apart can pay twice.)
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
  const localLedger = asLedger(local.ledger);
  const remoteLedger = asLedger(remote.ledger);
  const ledger = localLedger && remoteLedger ? mergeLedgers(localLedger, remoteLedger) : (localLedger ?? remoteLedger);
  const totals = localLedger && remoteLedger && ledger ? ledgerTotals(ledger) : null;
  const maxTotal = Math.max(local.totalXp, remote.totalXp);
  const maxLifetime = maxCounts(asCounts(local.lifetimeCounts), asCounts(remote.lifetimeCounts));
  return {
    ...remote,
    ...local,
    ...(ledger ? { ledger } : {}),
    // Never below the larger copy: a ledger that lags its totals must not lose XP.
    totalXp: totals ? Math.max(totals.xp, maxTotal) : maxTotal,
    lifetimeCounts: totals ? maxCounts(totals.counts, maxLifetime) : maxLifetime,
    daily,
    completedMilestoneIds: union(asStrings(local.completedMilestoneIds), asStrings(remote.completedMilestoneIds)),
    recentXp,
  };
}
