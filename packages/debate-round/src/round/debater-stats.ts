/**
 * @fileoverview Personal debater statistics — the first slice of the
 * "Analytics Dashboard for Debaters" idea in IDEAS.md. A pure reduction of
 * the team's logged rounds (`state/ownRoundHistory.ts`, which already syncs
 * to the account) into win rate, side split, per-division and per-argument
 * breakdowns, and a recent-form trend.
 *
 * It computes only what the logged records carry. Fallacy frequency, argument
 * length and topic expertise from the idea need data no store records yet and
 * are deliberately absent. Rendered by `panels/DebaterStatsPanel.tsx`.
 *
 * @module round/debater-stats
 */

import type { OpponentRoundRecord } from "@debate/data-sync/src/rankings/opponent-team-profile";

/** Rounds in the "recent form" window. */
export const RECENT_FORM_WINDOW = 5;

/** A win/loss tally with its rate. `winRate` is 0–1 rounded to 2 places, `null` with no rounds. */
export interface WinLossRecord {
  rounds: number;
  wins: number;
  losses: number;
  winRate: number | null;
}

/** A {@link WinLossRecord} for one argument tag or division. */
export interface LabeledWinLossRecord extends WinLossRecord {
  label: string;
}

/** Whether recent form is above, below or level with the all-time rate. */
export type FormTrend = "improving" | "declining" | "steady" | "insufficient-data";

export interface DebaterStats {
  overall: WinLossRecord;
  aff: WinLossRecord;
  neg: WinLossRecord;
  /** Most rounds first; ties break alphabetically. */
  byDivision: LabeledWinLossRecord[];
  /** Per argument tag the team ran, most rounds first. */
  byArgumentTag: LabeledWinLossRecord[];
  /** Per case or plan name the team ran (`caseName`), most rounds first. */
  byCase: LabeledWinLossRecord[];
  /** The latest {@link RECENT_FORM_WINDOW} rounds by date. */
  recent: WinLossRecord;
  trend: FormTrend;
}

/** A trend needs this many rounds before the recent window means anything. */
const MIN_ROUNDS_FOR_TREND = RECENT_FORM_WINDOW * 2;
/** Recent-vs-overall win-rate gap that counts as a real change. */
const TREND_THRESHOLD = 0.1;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function tally(records: readonly OpponentRoundRecord[]): WinLossRecord {
  const wins = records.filter((record) => record.won).length;
  return {
    rounds: records.length,
    wins,
    losses: records.length - wins,
    winRate: records.length === 0 ? null : round2(wins / records.length),
  };
}

function groupBy(
  records: readonly OpponentRoundRecord[],
  labelsOf: (record: OpponentRoundRecord) => readonly string[],
): LabeledWinLossRecord[] {
  const groups = new Map<string, OpponentRoundRecord[]>();
  for (const record of records) {
    // A tag listed twice on one round still counts that round once.
    for (const label of new Set(labelsOf(record).map((value) => value.trim()).filter(Boolean))) {
      groups.set(label, [...(groups.get(label) ?? []), record]);
    }
  }
  return [...groups.entries()]
    .map(([label, group]) => ({ label, ...tally(group) }))
    .sort((a, b) => b.rounds - a.rounds || a.label.localeCompare(b.label));
}

/** Newest first; an unparseable date sorts as oldest rather than throwing. */
function byDateDescending(records: readonly OpponentRoundRecord[]): OpponentRoundRecord[] {
  const time = (record: OpponentRoundRecord) => {
    const parsed = Date.parse(record.date);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };
  return [...records].sort((a, b) => time(b) - time(a));
}

/** Reduces logged rounds to the statistics a debater wants at a glance. */
export function buildDebaterStats(records: readonly OpponentRoundRecord[]): DebaterStats {
  const overall = tally(records);
  const recent = tally(byDateDescending(records).slice(0, RECENT_FORM_WINDOW));

  let trend: FormTrend = "insufficient-data";
  if (records.length >= MIN_ROUNDS_FOR_TREND && overall.winRate !== null && recent.winRate !== null) {
    const gap = recent.winRate - overall.winRate;
    trend = gap >= TREND_THRESHOLD ? "improving" : gap <= -TREND_THRESHOLD ? "declining" : "steady";
  }

  return {
    overall,
    aff: tally(records.filter((record) => record.side === "aff")),
    neg: tally(records.filter((record) => record.side === "neg")),
    byDivision: groupBy(records, (record) => [record.division]),
    byArgumentTag: groupBy(records, (record) => record.argumentTags ?? []),
    byCase: groupBy(records, (record) => (record.caseName ? [record.caseName] : [])),
    recent,
    trend,
  };
}
