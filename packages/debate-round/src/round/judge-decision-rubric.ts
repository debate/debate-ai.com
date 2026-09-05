/**
 * @fileoverview Pure scoring-rubric helper for a rendered `JudgeDecisionAiResult`
 * — the "a scoring rubric shown alongside the AI judge decision" Next item
 * named under the "🧪 Practice Round Simulator" bullet in TODO.md's Research
 * Crowdsourcing Organizer Features list.
 *
 * The AI judge decision itself only reports a winner, a flat
 * `keyVotingIssues` list, and a prose `rationale` — it never says which of
 * the selected `JudgeParadigm`'s own `votingPriorities` each issue actually
 * addresses. This module makes that link explicit and reviewable: for every
 * criterion in the paradigm's ordered `votingPriorities`, it finds whichever
 * reported voting issue overlaps it most (by shared significant words), so a
 * debater can see the decision laid out against the judge's own stated
 * priorities instead of only a flat bullet list.
 *
 * Matching is a deterministic, local keyword overlap — no AI call — so it
 * stays directly Vitest-covered and never contradicts the paradigm/decision
 * it was given.
 *
 * @module round/judge-decision-rubric
 */

import type { JudgeParadigm } from "debate-speech-writer/src/judge/judge-paradigms";
import type { JudgeDecisionAiResult } from "./judge-decision-ai";

/** One row of a rendered scoring rubric: a paradigm voting priority matched against the decision's own reported issues. */
export type JudgeDecisionRubricRow = {
  /** The paradigm's own wording for this voting priority, in the paradigm's own priority order. */
  criterion: string;
  /** Whether any reported `keyVotingIssues` entry shares a significant word with this criterion. */
  addressed: boolean;
  /** The best-overlapping `keyVotingIssues` entry, when `addressed` is true. */
  matchedIssue?: string;
};

/** Common short words excluded from overlap matching so they can't drive a false match on their own. */
const STOP_WORDS = new Set([
  "the",
  "and",
  "that",
  "this",
  "with",
  "from",
  "into",
  "over",
  "than",
  "then",
  "their",
  "which",
  "only",
  "when",
  "does",
  "each",
  "both",
  "against",
]);

/** Lowercased words of at least 4 letters, minus `STOP_WORDS` — the shared vocabulary overlap is scored against. */
function significantWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .match(/[a-z]+/g) ?? [];
  return new Set(words.filter((word) => word.length >= 4 && !STOP_WORDS.has(word)));
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const word of a) {
    if (b.has(word)) count++;
  }
  return count;
}

/**
 * Builds a rubric row for every criterion in `paradigm.votingPriorities`, in
 * that paradigm's own order. Each criterion is matched against whichever of
 * `decision.keyVotingIssues` shares the most significant words with it (a
 * tie keeps the earlier-listed issue); a criterion with zero overlap against
 * every issue is `addressed: false` with no `matchedIssue`. An empty
 * `keyVotingIssues` (which `parseJudgeDecisionAiResponse` never actually
 * produces, since it requires at least one) leaves every criterion
 * unaddressed rather than throwing.
 */
export function buildJudgeDecisionRubric(
  paradigm: Pick<JudgeParadigm, "votingPriorities">,
  decision: Pick<JudgeDecisionAiResult, "keyVotingIssues">,
): JudgeDecisionRubricRow[] {
  const issueWordSets = decision.keyVotingIssues.map((issue) => significantWords(issue));

  return paradigm.votingPriorities.map((criterion) => {
    const criterionWords = significantWords(criterion);

    let bestIndex = -1;
    let bestOverlap = 0;
    issueWordSets.forEach((issueWords, index) => {
      const overlap = overlapCount(criterionWords, issueWords);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIndex = index;
      }
    });

    if (bestIndex === -1) {
      return { criterion, addressed: false };
    }
    return { criterion, addressed: true, matchedIssue: decision.keyVotingIssues[bestIndex] };
  });
}

/** How many of `rows` are `addressed` — the "N of M priorities addressed" summary count. */
export function countAddressedRubricRows(rows: JudgeDecisionRubricRow[]): number {
  return rows.filter((row) => row.addressed).length;
}
