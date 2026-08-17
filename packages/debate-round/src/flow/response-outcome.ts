/**
 * @fileoverview Flow-derived clash/vulnerability signals — pure
 * data-derivation helpers for idea #4 in TODO.md ("AI Response-Outcome
 * Charts"). Given an already-flowed `Flow`, scores each argument thread by
 * how exposed it currently is — whether it's gone unanswered, how much
 * direct opposing pressure it's drawn, and how much same-side
 * defense/extension has shored it up — then rolls that up into
 * chart-ready per-argument and per-side datasets. This is the first slice
 * only — it doesn't run an actual AI panel to evaluate response paths or
 * estimate win probabilities; it's a deterministic heuristic over the
 * flow's existing clash signals (who has responded to what, and whether
 * it's currently unanswered), meant as the data layer a future AI-backed
 * outcome estimate or chart UI could build on. See the follow-ups noted
 * in TODO.md.
 */

import type { Flow } from "debate-core/src/types/flow";
import { getFlowRowSummaries, type FlowRowSummary } from "./flow-transcript-summary";
import { getFlowSideKeys, getSpeechSideKey } from "./argument-tree";

const MAX_LABEL_LENGTH = 80;

function truncateForDisplay(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_LABEL_LENGTH
    ? `${trimmed.slice(0, MAX_LABEL_LENGTH).trim()}…`
    : trimmed;
}

export type ArgumentVulnerability = {
  rowIndex: number;
  argument: string;
  originSpeech: string;
  /** Side key of `originSpeech` (see `getSpeechSideKey`), i.e. the side this argument is a liability for. */
  sideKey: string | null;
  lastSpeech: string;
  isUnanswered: boolean;
  /** Entries after the origin whose speech is on the opposing side — direct clash. */
  opposingResponses: number;
  /** Entries after the origin whose speech is on the same side as the origin — extension/defense. */
  sameSideExtensions: number;
  /** 0-100: higher means more exposed to being weaponized against the side that introduced it. */
  vulnerabilityScore: number;
};

const BASE_SCORE = 40;
const UNANSWERED_BONUS = 40;
const OPPOSING_RESPONSE_WEIGHT = 10;
const MAX_OPPOSING_RESPONSE_ENTRIES = 3;
const SAME_SIDE_EXTENSION_WEIGHT = 15;
const MAX_SAME_SIDE_EXTENSION_ENTRIES = 3;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/** Splits a row's post-origin entries into direct opposing responses vs same-side extensions/defense. */
function classifyResponses(row: FlowRowSummary): {
  opposingResponses: number;
  sameSideExtensions: number;
} {
  const originSide = getSpeechSideKey(row.originSpeech);
  let opposingResponses = 0;
  let sameSideExtensions = 0;

  for (const entry of row.entries.slice(1)) {
    if (originSide && getSpeechSideKey(entry.speech) === originSide) sameSideExtensions++;
    else opposingResponses++;
  }

  return { opposingResponses, sameSideExtensions };
}

function toVulnerability(row: FlowRowSummary): ArgumentVulnerability {
  const { opposingResponses, sameSideExtensions } = classifyResponses(row);

  let score = BASE_SCORE;
  if (row.isUnanswered) score += UNANSWERED_BONUS;
  score += Math.min(opposingResponses, MAX_OPPOSING_RESPONSE_ENTRIES) * OPPOSING_RESPONSE_WEIGHT;
  score -= Math.min(sameSideExtensions, MAX_SAME_SIDE_EXTENSION_ENTRIES) * SAME_SIDE_EXTENSION_WEIGHT;

  return {
    rowIndex: row.rowIndex,
    argument: row.argument,
    originSpeech: row.originSpeech,
    sideKey: getSpeechSideKey(row.originSpeech),
    lastSpeech: row.lastSpeech,
    isUnanswered: row.isUnanswered,
    opposingResponses,
    sameSideExtensions,
    vulnerabilityScore: clampScore(score),
  };
}

/**
 * Scores how exposed a single already-flowed argument thread is (0-100).
 * Unanswered arguments score highest (they're one extension away from
 * being conceded as dropped); repeated direct responses from the opposing
 * side raise it further (sustained pressure); extensions/defense from the
 * same side lower it (it's been shored up).
 */
export function scoreArgumentVulnerability(row: FlowRowSummary): number {
  return toVulnerability(row).vulnerabilityScore;
}

/**
 * Every argument row in a flow (headings excluded), scored and sorted by
 * `vulnerabilityScore` descending, with ties broken by row order.
 */
export function getArgumentVulnerabilityReport(
  flow: Pick<Flow, "children" | "columns">,
): ArgumentVulnerability[] {
  return getFlowRowSummaries(flow)
    .filter((row) => !row.isHeading)
    .map(toVulnerability)
    .sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore || a.rowIndex - b.rowIndex);
}

export type SideOutcomeSummary = {
  sideKey: string;
  argumentCount: number;
  unansweredCount: number;
  /** Mean `vulnerabilityScore` across this side's arguments, rounded to one decimal place. */
  averageVulnerability: number;
};

/**
 * Rolls an already-derived vulnerability report up per side (in the given
 * `sideKeys` order), for a "which side is more exposed right now" summary.
 * Sides with no flowed arguments yet are omitted. Split out from
 * `summarizeOutcomeBySide` so a panel can render a persisted
 * `ArgumentVulnerability[]` (from `state/vulnerabilityReports.ts`) without
 * needing the original raw `Flow`.
 */
export function summarizeOutcomeBySideFromReport(
  report: ArgumentVulnerability[],
  sideKeys: string[],
): SideOutcomeSummary[] {
  return sideKeys.flatMap((sideKey) => {
    const rows = report.filter((row) => row.sideKey === sideKey);
    if (rows.length === 0) return [];

    const averageVulnerability =
      Math.round((rows.reduce((sum, row) => sum + row.vulnerabilityScore, 0) / rows.length) * 10) / 10;

    return [
      {
        sideKey,
        argumentCount: rows.length,
        unansweredCount: rows.filter((row) => row.isUnanswered).length,
        averageVulnerability,
      },
    ];
  });
}

/**
 * Rolls the vulnerability report up per side (using the flow's column
 * order via `getFlowSideKeys`), for a "which side is more exposed right
 * now" summary. Sides with no flowed arguments yet are omitted.
 */
export function summarizeOutcomeBySide(
  flow: Pick<Flow, "children" | "columns">,
): SideOutcomeSummary[] {
  return summarizeOutcomeBySideFromReport(getArgumentVulnerabilityReport(flow), getFlowSideKeys(flow));
}

export type VulnerabilityChartPoint = {
  rowIndex: number;
  /** Chart label: origin speech plus a truncated version of the argument text. */
  label: string;
  sideKey: string | null;
  value: number;
};

/**
 * The top `limit` most vulnerable arguments (default 10) from an
 * already-derived report as chart-ready `{ label, value }` points. Split
 * out from `buildVulnerabilityChartData` so a panel can render a persisted
 * `ArgumentVulnerability[]` (from `state/vulnerabilityReports.ts`) without
 * needing the original raw `Flow` — the report is already sorted by
 * `vulnerabilityScore` descending (see `getArgumentVulnerabilityReport`).
 */
export function buildVulnerabilityChartDataFromReport(
  report: ArgumentVulnerability[],
  options: { limit?: number } = {},
): VulnerabilityChartPoint[] {
  const limit = options.limit ?? 10;

  return report.slice(0, limit).map((row) => ({
    rowIndex: row.rowIndex,
    label: `${row.originSpeech}: ${truncateForDisplay(row.argument)}`,
    sideKey: row.sideKey,
    value: row.vulnerabilityScore,
  }));
}

/**
 * The top `limit` most vulnerable arguments (default 10) as chart-ready
 * `{ label, value }` points, for a "most exposed arguments right now" bar
 * chart — the first building block toward idea #4's fuller
 * response-outcome visualization.
 */
export function buildVulnerabilityChartData(
  flow: Pick<Flow, "children" | "columns">,
  options: { limit?: number } = {},
): VulnerabilityChartPoint[] {
  return buildVulnerabilityChartDataFromReport(getArgumentVulnerabilityReport(flow), options);
}
