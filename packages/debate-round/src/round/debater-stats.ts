/**
 * @fileoverview Personal debater statistics — the first slice of the
 * "Analytics Dashboard for Debaters" idea in IDEAS.md. A pure reduction of
 * the team's logged rounds (`state/ownRoundHistory.ts`, which already syncs
 * to the account) into win rate, side split, per-division and per-argument
 * breakdowns, and a recent-form trend.
 *
 * It computes only what the logged records carry (including the optional
 * `speechWordCount`). Fallacy frequency and topic expertise from the idea need
 * data no store records yet and are deliberately absent. Rendered by `panels/DebaterStatsPanel.tsx`.
 *
 * @module round/debater-stats
 */

import type { OpponentRoundRecord } from "@debate-ai/rankings/src/sync/opponent-team-profile";

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

/** The run of identical results ending at the latest round. */
export interface Streak {
  kind: "win" | "loss" | null;
  length: number;
}

/** Average spoken words per round, and how that splits across wins and losses. `null` where no round carries a count. */
export interface SpeechLengthStats {
  /** Rounds that logged a word count. */
  rounds: number;
  averageWords: number | null;
  averageWordsInWins: number | null;
  averageWordsInLosses: number | null;
}

export interface DebaterStats {
  overall: WinLossRecord;
  aff: WinLossRecord;
  neg: WinLossRecord;
  /** Most rounds first; ties break alphabetically. */
  byDivision: LabeledWinLossRecord[];
  /** Per argument tag the team ran, most rounds first. */
  byArgumentTag: LabeledWinLossRecord[];
  /** Per case/plan name the team ran, most rounds first. */
  byCase: LabeledWinLossRecord[];
  /** Consecutive wins or losses ending at the most recent round. */
  streak: Streak;
  /** The latest {@link RECENT_FORM_WINDOW} rounds by date. */
  recent: WinLossRecord;
  trend: FormTrend;
  speechLength: SpeechLengthStats;
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

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Only a finite, positive count is a usable measurement; anything else is treated as not logged. */
function wordCounts(records: readonly OpponentRoundRecord[]): number[] {
  return records
    .map((record) => record.speechWordCount)
    .filter((count): count is number => typeof count === "number" && Number.isFinite(count) && count > 0);
}

function buildSpeechLength(records: readonly OpponentRoundRecord[]): SpeechLengthStats {
  const all = wordCounts(records);
  return {
    rounds: all.length,
    averageWords: average(all),
    averageWordsInWins: average(wordCounts(records.filter((record) => record.won))),
    averageWordsInLosses: average(wordCounts(records.filter((record) => !record.won))),
  };
}

/** Newest first; an unparseable date sorts as oldest rather than throwing. */
function byDateDescending(records: readonly OpponentRoundRecord[]): OpponentRoundRecord[] {
  const time = (record: OpponentRoundRecord) => {
    const parsed = Date.parse(record.date);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };
  return [...records].sort((a, b) => time(b) - time(a));
}

function currentStreak(newestFirst: readonly OpponentRoundRecord[]): Streak {
  if (newestFirst.length === 0) return { kind: null, length: 0 };
  const latest = newestFirst[0].won;
  let length = 0;
  while (length < newestFirst.length && newestFirst[length].won === latest) length++;
  return { kind: latest ? "win" : "loss", length };
}

/** Reduces logged rounds to the statistics a debater wants at a glance. */
export function buildDebaterStats(records: readonly OpponentRoundRecord[]): DebaterStats {
  const overall = tally(records);
  const newestFirst = byDateDescending(records);
  const recent = tally(newestFirst.slice(0, RECENT_FORM_WINDOW));

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
    streak: currentStreak(newestFirst),
    recent,
    trend,
    speechLength: buildSpeechLength(records),
  };
}

/** Splits a comma-separated tags field into trimmed, non-empty `argumentTags`. */
export function parseArgumentTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}
