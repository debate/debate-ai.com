/**
 * @fileoverview Flow-derived practice drills — pure data-derivation helpers
 * for the "AI Drill Generator" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features. Given an already-flowed `Flow` and a chosen side,
 * generates quick practice drills — an overview-weighing prompt, a
 * frontline-practice prompt per opponent argument still live, a cross-ex
 * question per unanswered argument, and a collapse-scenario recommendation
 * — by reusing the existing `flow-transcript-summary.ts` and
 * `response-outcome.ts` slices. This is the first slice only — it's a
 * deterministic template layer over those existing signals, not an actual
 * AI-generated drill script; it isn't wired into any drill-panel UI, and
 * generated drills aren't persisted anywhere.
 */

import type { Flow } from "debate-core/src/types/flow";
import { getUnansweredFlowRows, suggestCrossExamQuestions } from "./flow-transcript-summary";
import { getArgumentVulnerabilityReport, summarizeOutcomeBySide } from "./response-outcome";
import { getSpeechSideKey } from "./argument-tree";

const MAX_LABEL_LENGTH = 80;

function truncateForDisplay(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_LABEL_LENGTH
    ? `${trimmed.slice(0, MAX_LABEL_LENGTH).trim()}…`
    : trimmed;
}

export type DrillKind = "overview" | "frontline" | "cross_ex" | "collapse";

export type Drill = {
  kind: DrillKind;
  /** The flow row this drill is about, or `null` for a whole-round drill (e.g. overview). */
  rowIndex: number | null;
  prompt: string;
};

/**
 * A single whole-round overview drill weighing every side currently
 * represented in the flow. Returns `null` when nothing has been flowed yet
 * — there's nothing to weigh.
 */
export function buildOverviewDrill(flow: Pick<Flow, "children" | "columns">): Drill | null {
  const sides = summarizeOutcomeBySide(flow);
  if (sides.length === 0) return null;

  const sideLines = sides
    .map(
      (side) =>
        `${side.sideKey} (${side.unansweredCount}/${side.argumentCount} unanswered, avg vulnerability ${side.averageVulnerability})`,
    )
    .join(" vs. ");

  return {
    kind: "overview",
    rowIndex: null,
    prompt: `Write a 2-minute overview weighing the round so far: ${sideLines}.`,
  };
}

/**
 * One frontline-practice drill per unanswered argument on a side other than
 * `sideKey` — the opposing arguments `sideKey` still needs to answer before
 * they're extended again.
 */
export function buildFrontlineDrills(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
): Drill[] {
  return getUnansweredFlowRows(flow)
    .filter((row) => getSpeechSideKey(row.originSpeech) !== sideKey)
    .map((row) => ({
      kind: "frontline",
      rowIndex: row.rowIndex,
      prompt:
        `Write a frontline response to "${truncateForDisplay(row.argument)}" (${row.originSpeech})` +
        ` before it's extended again.`,
    }));
}

/** One cross-examination-practice drill per unanswered argument in the flow, regardless of side. */
export function buildCrossExamDrills(flow: Pick<Flow, "children" | "columns">): Drill[] {
  const rows = getUnansweredFlowRows(flow);
  return suggestCrossExamQuestions(rows).map((prompt, index) => ({
    kind: "cross_ex",
    rowIndex: rows[index].rowIndex,
    prompt,
  }));
}

/**
 * The `limit` (default 3) most vulnerable arguments belonging to a side
 * other than `sideKey` — the opposing side's most exposed arguments, i.e.
 * `sideKey`'s best candidates to collapse the round onto.
 */
export function buildCollapseDrills(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
  options: { limit?: number } = {},
): Drill[] {
  const limit = options.limit ?? 3;

  return getArgumentVulnerabilityReport(flow)
    .filter((row) => row.sideKey && row.sideKey !== sideKey)
    .slice(0, limit)
    .map((row) => {
      const status = row.isUnanswered
        ? "currently unanswered"
        : `only ${row.sameSideExtensions} same-side extension(s) since`;
      return {
        kind: "collapse",
        rowIndex: row.rowIndex,
        prompt:
          `Consider collapsing to "${truncateForDisplay(row.argument)}" (${row.originSpeech})` +
          ` — vulnerability ${row.vulnerabilityScore}/100, ${status} ${row.lastSpeech}.`,
      };
    });
}

/**
 * The full quick-drill set for a chosen side: an overview drill (if
 * anything's been flowed), a frontline drill per live opposing argument, a
 * cross-ex drill per unanswered argument, and a collapse-scenario drill per
 * top vulnerable opposing argument — in that order.
 */
export function buildDrillSet(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
  options: { collapseLimit?: number } = {},
): Drill[] {
  const overview = buildOverviewDrill(flow);
  return [
    ...(overview ? [overview] : []),
    ...buildFrontlineDrills(flow, sideKey),
    ...buildCrossExamDrills(flow),
    ...buildCollapseDrills(flow, sideKey, { limit: options.collapseLimit }),
  ];
}

const DRILL_KIND_LABELS: Record<DrillKind, string> = {
  overview: "Overview",
  frontline: "Frontline",
  cross_ex: "Cross-Ex",
  collapse: "Collapse",
};

/** Renders a drill set as one labeled line per drill, for a drill-panel view. */
export function buildDrillSummaryText(drills: Drill[]): string {
  if (drills.length === 0) return "No drills available yet — nothing has been flowed.";
  return drills.map((drill) => `[${DRILL_KIND_LABELS[drill.kind]}] ${drill.prompt}`).join("\n");
}
