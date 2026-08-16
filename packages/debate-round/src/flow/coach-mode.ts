/**
 * @fileoverview Flow-derived coaching prompts — pure data-derivation
 * helpers for the "AI Coach Mode" bullet in TODO.md's Research
 * Crowdsourcing Organizer Features. Given an already-flowed `Flow` and a
 * chosen side, generates live-or-post-round coaching prompts: which of the
 * side's own arguments to extend as dropped, which opposing arguments still
 * need an answer, where to recommend collapsing the round, and a weighing
 * angle based on which side currently looks more exposed — by reusing the
 * existing `flow-transcript-summary.ts`, `response-outcome.ts`, and
 * `drill-generator.ts` slices. This is the first slice only — it's a
 * deterministic template layer over those existing signals, not an actual
 * AI-generated coaching call; it isn't wired into any coaching-panel UI,
 * and generated sessions aren't persisted anywhere.
 */

import type { Flow } from "debate-core/src/types/flow";
import { getUnansweredFlowRows } from "./flow-transcript-summary";
import { summarizeOutcomeBySide } from "./response-outcome";
import { buildCollapseDrills } from "./drill-generator";
import { getSpeechSideKey } from "./argument-tree";

const MAX_LABEL_LENGTH = 80;

function truncateForDisplay(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_LABEL_LENGTH
    ? `${trimmed.slice(0, MAX_LABEL_LENGTH).trim()}…`
    : trimmed;
}

export type CoachingPromptKind = "extension" | "refutation" | "collapse" | "weighing";

export type CoachingPrompt = {
  kind: CoachingPromptKind;
  /** The flow row this prompt is about, or `null` for a whole-round prompt (e.g. weighing). */
  rowIndex: number | null;
  prompt: string;
};

/**
 * One extension prompt per unanswered argument whose most recent flowed
 * entry (`lastSpeech`) is on `sideKey`'s own side — the side's own last word
 * currently stands, so the coach should have them extend it as
 * dropped/conceded before it's answered.
 */
export function buildExtensionPrompts(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
): CoachingPrompt[] {
  return getUnansweredFlowRows(flow)
    .filter((row) => getSpeechSideKey(row.lastSpeech) === sideKey)
    .map((row) => ({
      kind: "extension",
      rowIndex: row.rowIndex,
      prompt:
        `Extend "${truncateForDisplay(row.argument)}" (last touched in ${row.lastSpeech})` +
        ` as dropped/conceded — the other side hasn't answered it.`,
    }));
}

/**
 * One refutation prompt per unanswered argument whose most recent flowed
 * entry (`lastSpeech`) is on the opposing side — the opponent's last word
 * currently stands, so the coach should have `sideKey` answer it before it's
 * extended against them.
 */
export function buildRefutationPrompts(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
): CoachingPrompt[] {
  return getUnansweredFlowRows(flow)
    .filter((row) => getSpeechSideKey(row.lastSpeech) !== sideKey)
    .map((row) => ({
      kind: "refutation",
      rowIndex: row.rowIndex,
      prompt:
        `Answer "${truncateForDisplay(row.argument)}" (last touched in ${row.lastSpeech})` +
        ` before it's extended against you.`,
    }));
}

/**
 * The `limit` (default 3) most vulnerable opposing arguments to recommend
 * collapsing the round onto, reusing `drill-generator.ts`'s
 * `buildCollapseDrills` directly rather than reimplementing the same
 * vulnerability-ranking logic.
 */
export function buildCollapsePrompts(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
  options: { limit?: number } = {},
): CoachingPrompt[] {
  return buildCollapseDrills(flow, sideKey, options).map((drill) => ({
    kind: "collapse",
    rowIndex: drill.rowIndex,
    prompt: drill.prompt,
  }));
}

/**
 * A single whole-round weighing prompt comparing `sideKey` against every
 * other side currently represented in the flow, recommending a weighing
 * angle based on `response-outcome.ts`'s per-side vulnerability rollup:
 * fewer unanswered arguments and lower average vulnerability than an
 * opponent is framed as "weigh on your uncontested offense"; the reverse is
 * framed as a warning that the side needs to shore up its case before
 * weighing favors them. Returns `null` when `sideKey` has no flowed
 * arguments yet, or when it's the only side represented — there's nothing
 * to weigh against.
 */
export function buildWeighingGuidance(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
): CoachingPrompt | null {
  const sides = summarizeOutcomeBySide(flow);
  const ownSide = sides.find((side) => side.sideKey === sideKey);
  const opponents = sides.filter((side) => side.sideKey !== sideKey);
  if (!ownSide || opponents.length === 0) return null;

  const linesByOpponent = opponents.map((opponent) => {
    const aheadOnUnanswered = ownSide.unansweredCount < opponent.unansweredCount;
    const aheadOnVulnerability = ownSide.averageVulnerability < opponent.averageVulnerability;
    const isAhead = aheadOnUnanswered && aheadOnVulnerability;

    return isAhead
      ? `you're ahead of ${opponent.sideKey} (${ownSide.unansweredCount} vs. ` +
          `${opponent.unansweredCount} unanswered, ${ownSide.averageVulnerability} vs. ` +
          `${opponent.averageVulnerability} avg. vulnerability) — weigh on your uncontested offense`
      : `${opponent.sideKey} currently looks stronger (${opponent.unansweredCount} vs. ` +
          `${ownSide.unansweredCount} unanswered, ${opponent.averageVulnerability} vs. ` +
          `${ownSide.averageVulnerability} avg. vulnerability) — shore up your case before weighing`;
  });

  return {
    kind: "weighing",
    rowIndex: null,
    prompt: `Weighing guidance: ${linesByOpponent.join("; ")}.`,
  };
}

/**
 * The full coaching session for a chosen side: refutation prompts for
 * opposing arguments still due an answer, extension prompts for the side's
 * own arguments currently standing, collapse recommendations, and weighing
 * guidance — in that priority order (answer live threats first).
 */
export function buildCoachingSession(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
  options: { collapseLimit?: number } = {},
): CoachingPrompt[] {
  const weighing = buildWeighingGuidance(flow, sideKey);
  return [
    ...buildRefutationPrompts(flow, sideKey),
    ...buildExtensionPrompts(flow, sideKey),
    ...buildCollapsePrompts(flow, sideKey, { limit: options.collapseLimit }),
    ...(weighing ? [weighing] : []),
  ];
}

const COACHING_PROMPT_KIND_LABELS: Record<CoachingPromptKind, string> = {
  extension: "Extension",
  refutation: "Refutation",
  collapse: "Collapse",
  weighing: "Weighing",
};

/** Renders a coaching session as one labeled line per prompt, for a coaching-panel view. */
export function buildCoachingSummaryText(prompts: CoachingPrompt[]): string {
  if (prompts.length === 0) return "No coaching prompts available yet — nothing has been flowed.";
  return prompts
    .map((prompt) => `[${COACHING_PROMPT_KIND_LABELS[prompt.kind]}] ${prompt.prompt}`)
    .join("\n");
}
