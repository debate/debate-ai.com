/**
 * @fileoverview Pure per-argument coverage aggregation for the "Topic
 * Coverage Dashboard" idea under Research Crowdsourcing Organizer Features
 * in TODO.md ("Show which arguments are well-covered, which are missing,
 * and where the team needs more work"). Given the team's tracked list of
 * argument blocks for a topic and the cards already submitted under each
 * one, classifies every tracked argument as missing, thin, or covered
 * against configurable card-count/word-count thresholds, and surfaces any
 * submitted cards filed under an argument block nobody is tracking. This is
 * the first slice only — it works entirely off a caller-supplied card list
 * and a caller-supplied tracked-argument list; it doesn't read real
 * submitted cards or a topic's argument checklist from anywhere (neither
 * exists in this repo today), and it isn't wired into any dashboard UI yet.
 * See the follow-ups noted in TODO.md.
 *
 * @module lib/topic-coverage
 */

/** Minimal shape of a submitted card needed to compute topic coverage. */
export interface CoverageCardSummary {
  id: string;
  /** Name of the argument block this card supports, e.g. "Warming DA" or "Case NEG". */
  argBlock: string;
  /** Card body word count, used as a rough depth-of-coverage signal. */
  wordCount: number;
}

/** One argument block the team wants tracked for this topic. */
export interface TrackedArgument {
  argBlock: string;
  /** Optional argument type/category, e.g. "DA", "CP", "K", "T", "Case". */
  category?: string;
}

/** Coverage classification for a single argument block. */
export type CoverageLevel = "missing" | "thin" | "covered";

/** Card-count/word-count thresholds used to classify coverage. */
export interface CoverageThresholds {
  /** Minimum submitted cards to count as "covered" rather than "thin". */
  minCards: number;
  /** Minimum total word count across those cards to count as "covered". */
  minTotalWords: number;
}

/** A middling default: three cards and 600 words is enough depth to call an argument "covered". */
export const DEFAULT_COVERAGE_THRESHOLDS: CoverageThresholds = {
  minCards: 3,
  minTotalWords: 600,
};

/** One argument block's coverage stats. */
export interface ArgumentCoverage {
  argBlock: string;
  category?: string;
  cardCount: number;
  totalWordCount: number;
  level: CoverageLevel;
}

function classifyCoverage(cardCount: number, totalWordCount: number, thresholds: CoverageThresholds): CoverageLevel {
  if (cardCount === 0) return "missing";
  if (cardCount < thresholds.minCards || totalWordCount < thresholds.minTotalWords) return "thin";
  return "covered";
}

/** Groups cards by their `argBlock`, preserving each group's relative submission order. */
export function groupCardsByArgument(cards: CoverageCardSummary[]): Map<string, CoverageCardSummary[]> {
  const byArgument = new Map<string, CoverageCardSummary[]>();
  for (const card of cards) {
    const group = byArgument.get(card.argBlock);
    if (group) {
      group.push(card);
    } else {
      byArgument.set(card.argBlock, [card]);
    }
  }
  return byArgument;
}

/** Computes one argument block's coverage from the cards submitted under it (possibly none). */
export function computeArgumentCoverage(
  tracked: TrackedArgument,
  cards: CoverageCardSummary[],
  thresholds: CoverageThresholds = DEFAULT_COVERAGE_THRESHOLDS,
): ArgumentCoverage {
  const totalWordCount = cards.reduce((sum, card) => sum + card.wordCount, 0);
  return {
    argBlock: tracked.argBlock,
    category: tracked.category,
    cardCount: cards.length,
    totalWordCount,
    level: classifyCoverage(cards.length, totalWordCount, thresholds),
  };
}

/** Full topic coverage report: every tracked argument, plus any untracked ones cards were filed under. */
export interface TopicCoverageReport {
  /** Coverage for every argument in the tracked list, sorted by `argBlock`. */
  tracked: ArgumentCoverage[];
  /**
   * Coverage for argument blocks cards were submitted under that aren't in
   * the tracked list — an unplanned-but-covered argument, or a card filed
   * under a typo'd/renamed block name — sorted by `argBlock`.
   */
  untracked: ArgumentCoverage[];
}

/**
 * Builds the full coverage report for a topic: every argument in
 * `trackedArguments` gets a coverage entry (even with zero submitted
 * cards), and any `argBlock` cards were filed under that isn't in
 * `trackedArguments` is reported separately under `untracked` rather than
 * silently dropped.
 */
export function buildTopicCoverageReport(
  trackedArguments: TrackedArgument[],
  cards: CoverageCardSummary[],
  thresholds: CoverageThresholds = DEFAULT_COVERAGE_THRESHOLDS,
): TopicCoverageReport {
  const byArgument = groupCardsByArgument(cards);
  const trackedBlocks = new Set(trackedArguments.map((argument) => argument.argBlock));

  const tracked = trackedArguments
    .map((argument) => computeArgumentCoverage(argument, byArgument.get(argument.argBlock) ?? [], thresholds))
    .sort((a, b) => a.argBlock.localeCompare(b.argBlock));

  const untracked = Array.from(byArgument.entries())
    .filter(([argBlock]) => !trackedBlocks.has(argBlock))
    .map(([argBlock, group]) => computeArgumentCoverage({ argBlock }, group, thresholds))
    .sort((a, b) => a.argBlock.localeCompare(b.argBlock));

  return { tracked, untracked };
}

const LEVEL_SEVERITY: Record<CoverageLevel, number> = { missing: 0, thin: 1, covered: 2 };

/**
 * Returns the tracked arguments needing more work — anything not yet
 * "covered" — worst-covered first: missing before thin, then fewest cards,
 * tie-broken by `argBlock` for a stable, deterministic order. Untracked
 * argument blocks are never "under-covered" from the team's plan's
 * perspective, so they're excluded here.
 */
export function getUnderCoveredArguments(report: TopicCoverageReport): ArgumentCoverage[] {
  return report.tracked
    .filter((argument) => argument.level !== "covered")
    .sort(
      (a, b) =>
        LEVEL_SEVERITY[a.level] - LEVEL_SEVERITY[b.level] ||
        a.cardCount - b.cardCount ||
        a.argBlock.localeCompare(b.argBlock),
    );
}

/** Tracked-argument counts by coverage level, plus the total tracked count — one point in a coverage-over-time trend. */
export interface CoverageCounts {
  missing: number;
  thin: number;
  covered: number;
  total: number;
}

/**
 * Tallies `report.tracked` by coverage level — the same counts
 * {@link buildTopicCoverageSummaryText} renders as a sentence, factored out
 * so a caller (the coverage-trend snapshot store) can persist them as
 * structured data instead of parsing that sentence back apart.
 */
export function computeCoverageCounts(report: TopicCoverageReport): CoverageCounts {
  const missing = report.tracked.filter((argument) => argument.level === "missing").length;
  const thin = report.tracked.filter((argument) => argument.level === "thin").length;
  const covered = report.tracked.filter((argument) => argument.level === "covered").length;
  return { missing, thin, covered, total: report.tracked.length };
}

/** Renders a short summary line for a topic-coverage dashboard header. */
export function buildTopicCoverageSummaryText(report: TopicCoverageReport): string {
  const { missing: missingCount, thin: thinCount, covered: coveredCount, total } = computeCoverageCounts(report);

  const summary = `${coveredCount}/${total} arguments covered, ${thinCount} thin, ${missingCount} missing`;
  if (report.untracked.length === 0) return summary;

  return `${summary} (plus ${report.untracked.length} untracked block${report.untracked.length === 1 ? "" : "s"} with submitted cards)`;
}
