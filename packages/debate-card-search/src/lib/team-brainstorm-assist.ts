/**
 * @fileoverview Pure squad-brainstorm prompt/board helpers for the "Team
 * Brainstorm Assist" bullet under Research Crowdsourcing Organizer Features
 * in TODO.md ("Use AI to help the whole squad generate arguments, impact
 * framing, frontlines, and responses during prep sessions"). Builds a
 * structured, non-AI-calling brainstorm prompt for an argument block and
 * category — optionally seeded straight from the existing Topic Coverage
 * Dashboard's under-covered arguments — and models a squad brainstorm board
 * where teammates submit ideas that get ranked by the existing
 * `community-rating.ts` popularity scoring and flagged for near-duplicate
 * text via the existing `llm-card-scoring.ts` uniqueness heuristic. This is
 * the first slice only — it doesn't call any AI model to actually generate
 * ideas, persist a board or its submitted ideas, or render a brainstorm
 * panel UI. See the follow-ups noted in TODO.md.
 *
 * @module lib/team-brainstorm-assist
 */

import { getUnderCoveredArguments, type TopicCoverageReport } from "./topic-coverage";
import { scorePopularitySignal } from "./community-rating";
import { scoreUniqueness } from "./llm-card-scoring";

/** The kind of prep-session brainstorming being requested. */
export type BrainstormCategory = "argument" | "impact_framing" | "frontline" | "response";

/** A structured, renderable brainstorm prompt for one argument block/category. */
export interface BrainstormPrompt {
  argBlock: string;
  category: BrainstormCategory;
  prompt: string;
}

const CATEGORY_LABELS: Record<BrainstormCategory, string> = {
  argument: "New Arguments",
  impact_framing: "Impact Framing",
  frontline: "Frontline Answers",
  response: "Responses & Turns",
};

const CATEGORY_PROMPT_TEMPLATES: Record<BrainstormCategory, (argBlock: string) => string> = {
  argument: (argBlock) => `Brainstorm new arguments for "${argBlock}" — what angles hasn't the team tried yet?`,
  impact_framing: (argBlock) =>
    `Brainstorm impact framing for "${argBlock}" — how should the team weigh it against the other side's offense?`,
  frontline: (argBlock) => `Brainstorm frontline answers the team could run if the opponent reads "${argBlock}".`,
  response: (argBlock) => `Brainstorm responses and turns to common attacks on "${argBlock}".`,
};

/** Builds a single squad brainstorm prompt for one argument block and category. */
export function buildBrainstormPrompt(argBlock: string, category: BrainstormCategory): BrainstormPrompt {
  return { argBlock, category, prompt: CATEGORY_PROMPT_TEMPLATES[category](argBlock) };
}

/**
 * Seeds brainstorm prompts straight from a topic's under-covered arguments
 * (the existing Topic Coverage Dashboard's `getUnderCoveredArguments`) —
 * one prompt per under-covered tracked argument, per requested category,
 * worst-covered argument first. Defaults to the two categories a coverage
 * gap most directly motivates: new arguments and impact framing.
 */
export function buildBrainstormPromptsForCoverageGaps(
  report: TopicCoverageReport,
  categories: BrainstormCategory[] = ["argument", "impact_framing"],
): BrainstormPrompt[] {
  const underCovered = getUnderCoveredArguments(report);
  return underCovered.flatMap((argument) =>
    categories.map((category) => buildBrainstormPrompt(argument.argBlock, category)),
  );
}

/** One squad member's brainstormed idea submitted to a specific board. */
export interface BrainstormIdea {
  id: string;
  argBlock: string;
  category: BrainstormCategory;
  contributorId: string;
  text: string;
  /** Raw upvote count from teammates — the same "vote" signal `community-rating.ts` scores. */
  upvotes: number;
}

/** A scored idea within a ranked board. */
export interface RankedBrainstormIdea extends BrainstormIdea {
  popularityScore: number;
  /** True when another idea on the same board is a near-duplicate of this one's text. */
  isLikelyDuplicate: boolean;
}

/** Uniqueness score below this (mirrors `llm-card-scoring.ts`'s threshold) counts an idea as a likely duplicate. */
const DUPLICATE_SIMILARITY_THRESHOLD = 25;

function boardKey(argBlock: string, category: BrainstormCategory): string {
  return `${argBlock}::${category}`;
}

/** Groups ideas onto their board (argBlock + category), preserving submission order within each group. */
export function groupIdeasByBoard(ideas: BrainstormIdea[]): Map<string, BrainstormIdea[]> {
  const byBoard = new Map<string, BrainstormIdea[]>();
  for (const idea of ideas) {
    const key = boardKey(idea.argBlock, idea.category);
    const group = byBoard.get(key);
    if (group) {
      group.push(idea);
    } else {
      byBoard.set(key, [idea]);
    }
  }
  return byBoard;
}

/**
 * Ranks a single board's ideas by popularity score, descending (tie-broken
 * by `id`), flagging any idea whose text is a near-duplicate — via the
 * existing `llm-card-scoring.ts` `scoreUniqueness` heuristic against every
 * other idea already on the same board — so a moderator can merge
 * near-identical submissions instead of splitting their votes.
 */
export function rankBrainstormIdeas(ideas: BrainstormIdea[]): RankedBrainstormIdea[] {
  return ideas
    .map((idea, index) => {
      const otherTexts = ideas.filter((_, otherIndex) => otherIndex !== index).map((other) => other.text);
      const uniqueness = scoreUniqueness(idea.text, otherTexts);
      return {
        ...idea,
        popularityScore: scorePopularitySignal(idea.upvotes, 0),
        isLikelyDuplicate: uniqueness < DUPLICATE_SIMILARITY_THRESHOLD,
      };
    })
    .sort((a, b) => b.popularityScore - a.popularityScore || a.id.localeCompare(b.id));
}

/** A single argument block/category brainstorm board: its seeding prompt plus ranked, submitted ideas. */
export interface BrainstormBoard {
  argBlock: string;
  category: BrainstormCategory;
  prompt: string;
  ideas: RankedBrainstormIdea[];
}

/** Builds one board for `argBlock`/`category`, filtering `ideas` down to that board and ranking them. */
export function buildBrainstormBoard(
  argBlock: string,
  category: BrainstormCategory,
  ideas: BrainstormIdea[],
): BrainstormBoard {
  const boardIdeas = ideas.filter((idea) => idea.argBlock === argBlock && idea.category === category);
  return {
    argBlock,
    category,
    prompt: buildBrainstormPrompt(argBlock, category).prompt,
    ideas: rankBrainstormIdeas(boardIdeas),
  };
}

/**
 * Builds a full set of coverage-gap-seeded boards: one per under-covered
 * tracked argument/category pair, each populated with whatever ideas the
 * squad has already submitted for it. Reuses
 * `buildBrainstormPromptsForCoverageGaps` directly rather than re-deriving
 * the coverage-gap list.
 */
export function buildBrainstormBoardsForCoverageGaps(
  report: TopicCoverageReport,
  ideas: BrainstormIdea[],
  categories: BrainstormCategory[] = ["argument", "impact_framing"],
): BrainstormBoard[] {
  return buildBrainstormPromptsForCoverageGaps(report, categories).map((seed) =>
    buildBrainstormBoard(seed.argBlock, seed.category, ideas),
  );
}

/** Renders a short summary line for a brainstorm board, for a prep-session panel. */
export function buildBrainstormSummaryText(board: BrainstormBoard): string {
  const label = CATEGORY_LABELS[board.category];
  if (board.ideas.length === 0) {
    return `${label} — "${board.argBlock}": no ideas submitted yet. ${board.prompt}`;
  }

  // Duplicate flagging is pairwise (via `scoreUniqueness`), so a flagged idea's closest match is
  // always flagged too — `duplicateCount` is therefore always 0 or >= 2, never exactly 1.
  const duplicateCount = board.ideas.filter((idea) => idea.isLikelyDuplicate).length;
  const duplicateNote = duplicateCount > 0 ? `, ${duplicateCount} possible duplicates` : "";
  const top = board.ideas[0];

  return (
    `${label} — "${board.argBlock}": ${board.ideas.length} idea${board.ideas.length === 1 ? "" : "s"}${duplicateNote}, ` +
    `top pick by ${top.contributorId} (${top.popularityScore}/100 popularity): "${top.text}"`
  );
}
