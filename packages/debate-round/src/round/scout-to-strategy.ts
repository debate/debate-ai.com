/**
 * @fileoverview Scout-to-strategy workflow — pure data-composition helpers
 * for the "Scout-to-Strategy Workflow" item under TODO.md's Research
 * Crowdsourcing Organizer Features list. Turns the already-built
 * opponent-scouting (`debate-data-sync`'s `OpponentTeamProfile`) and
 * judge-tendency (`debate-speech-writer`'s `JudgeProfile`) signals into a
 * deterministic first-slice strategy recommendation: which caller-supplied
 * case option looks safest to run against this opponent, concrete
 * judge-adaptation notes, and an overall matchup risk level with the
 * specific factors behind it. The risk heuristic can optionally be scoped to
 * an `ourSide`, so opponent-side-preference/judge-side-bias risk factors are
 * judged against the side the opponent will actually run against us this
 * round rather than generically. This is still not an actual AI-panel
 * evaluation of case choice (the case ranking is a tag-overlap heuristic,
 * not a strategic evaluation) — see follow-up (c) in TODO.md.
 *
 * `buildStrategyRecommendationPrepNote` closes this bullet's "a one-click
 * export into the Pre-Round Briefing" follow-up: a compact one-line summary
 * of a `StrategyRecommendation`, suitable as a single "Team prep notes"
 * bullet in `pre-round-briefing.ts`'s `appendNoteToPreRoundBriefing` (unlike
 * `buildStrategyRecommendationText`'s full multi-section rendering, which
 * doesn't fit that section's one-bullet-per-note shape). `StrategyPanel`'s
 * "Send to Pre-Round Briefing" action wires the two together.
 *
 * `buildCaseComparisonTable` closes this bullet's "a side-by-side
 * case-option comparison table" follow-up: today's "Case rankings" list only
 * shows each case's *total* overlap score, not which specific opponent-run
 * tags drove it. Each `RankedCaseOption` now also carries `tagOverlaps` — a
 * per-tag breakdown of that same score — and `buildCaseComparisonTable`
 * pivots every ranked case's breakdown into one row per tag (most
 * opponent-frequent first) with a column per case, so a team can see at a
 * glance which cases share which opponent-prepped tags instead of only the
 * total. `StrategyPanel`'s "Case comparison" table renders it.
 */

import type { DebateSide, OpponentTeamProfile } from "debate-data-sync/src/rankings/opponent-team-profile";
import { getOpponentTeamProfile } from "debate-data-sync/src/state/opponentTeamProfiles";
import type { JudgeProfile } from "debate-speech-writer/src/judge/judge-profile";
import { getJudgeProfile } from "debate-speech-writer/src/state/judgeProfiles";

/** The side the opponent will run this round, given the side we're running — debate is two-sided, so it's always the other one. */
export function getLikelyOpponentSide(ourSide: DebateSide): DebateSide {
  return ourSide === "aff" ? "neg" : "aff";
}

/** A case the team could choose to run this round. */
export interface CaseOption {
  name: string;
  /** Argument/case-type tags this case runs, e.g. ["kritik", "topicality"]. */
  argumentTags: string[];
}

/** One of a case option's argument tags, paired with the opponent's recorded frequency for it. */
export interface TagOverlap {
  tag: string;
  /** The opponent's recorded frequency for this tag; 0 when there's no opponent profile or the profile has no data for it. */
  opponentFrequency: number;
}

/** A case option scored against the opponent's most commonly run argument tags. */
export interface RankedCaseOption extends CaseOption {
  /**
   * Sum of the opponent's recorded frequency for each of this case's tags —
   * a heuristic proxy for "the opponent has likely prepped answers against
   * this." Higher is riskier. Zero when no opponent profile/tag data exists.
   */
  overlapScore: number;
  /**
   * Per-tag breakdown of `overlapScore` — one entry per tag in
   * `argumentTags`, in that order. Optional so older persisted
   * `RankedCaseOption`s (built before this field existed) and
   * hand-constructed test fixtures keep typechecking; `rankCaseOptions`
   * always populates it for anything built fresh.
   */
  tagOverlaps?: TagOverlap[];
}

export type RiskLevel = "low" | "medium" | "high";

export interface StrategyRecommendation {
  /** The lowest-overlap-scored case option, or null if no options were supplied. */
  recommendedCase: RankedCaseOption | null;
  /** Every supplied case option, safest (lowest overlap) first. */
  caseRankings: RankedCaseOption[];
  judgeAdaptationNotes: string[];
  riskLevel: RiskLevel;
  riskFactors: string[];
}

export interface BuildStrategyRecommendationInput {
  caseOptions: CaseOption[];
  opponentProfile?: OpponentTeamProfile;
  judgeProfile?: JudgeProfile;
  /** The side our team will run this round, when known — scopes the risk heuristic to the side the opponent will likely run against us. */
  ourSide?: DebateSide;
}

/**
 * Sums how often each of `option`'s argument tags appears in the opponent's
 * `topArgumentTags`. Zero when there's no opponent profile or the profile
 * has no tracked tags.
 */
export function computeCaseOverlapScore(
  option: CaseOption,
  opponentProfile?: OpponentTeamProfile,
): number {
  if (!opponentProfile || opponentProfile.topArgumentTags.length === 0) return 0;
  const frequencyByTag = new Map(
    opponentProfile.topArgumentTags.map((t) => [t.value, t.count]),
  );
  return option.argumentTags.reduce((sum, tag) => sum + (frequencyByTag.get(tag) ?? 0), 0);
}

/**
 * Breaks `computeCaseOverlapScore` down per tag — one `TagOverlap` per entry
 * of `option.argumentTags`, in that order, each paired with the opponent's
 * recorded frequency for it (0 when there's no opponent profile or the
 * profile has no data for that specific tag). Backs `rankCaseOptions`'
 * `tagOverlaps` field and `buildCaseComparisonTable`.
 */
export function computeCaseTagOverlaps(
  option: CaseOption,
  opponentProfile?: OpponentTeamProfile,
): TagOverlap[] {
  const frequencyByTag = new Map(
    (opponentProfile?.topArgumentTags ?? []).map((t) => [t.value, t.count]),
  );
  return option.argumentTags.map((tag) => ({ tag, opponentFrequency: frequencyByTag.get(tag) ?? 0 }));
}

/**
 * Ranks `caseOptions` by `computeCaseOverlapScore` against `opponentProfile`,
 * safest (lowest overlap) first, tie-broken alphabetically by case name for
 * a stable, deterministic order.
 */
export function rankCaseOptions(
  caseOptions: CaseOption[],
  opponentProfile?: OpponentTeamProfile,
): RankedCaseOption[] {
  return caseOptions
    .map((option) => {
      const tagOverlaps = computeCaseTagOverlaps(option, opponentProfile);
      const overlapScore = tagOverlaps.reduce((sum, overlap) => sum + overlap.opponentFrequency, 0);
      return { ...option, overlapScore, tagOverlaps };
    })
    .sort((a, b) => (a.overlapScore !== b.overlapScore ? a.overlapScore - b.overlapScore : a.name.localeCompare(b.name)));
}

/** One row of `CaseComparisonTable` — a single argument tag, and how much each case option contributes for it. */
export interface CaseComparisonRow {
  tag: string;
  /** The opponent's recorded frequency for this tag — the same value for every case that runs it. */
  opponentFrequency: number;
  /** Keyed by case name: `opponentFrequency` when that case runs this tag, 0 when it doesn't. */
  perCase: Record<string, number>;
}

/** A side-by-side pivot of every ranked case option's tag breakdown, for comparing case options at a glance. */
export interface CaseComparisonTable {
  /** Case names, in the same safest-first order as the `RankedCaseOption[]` the table was built from. */
  caseNames: string[];
  /** One row per tag run by at least one case option, most opponent-frequent first (alphabetical tie-break). */
  rows: CaseComparisonRow[];
}

/**
 * Pivots `caseRankings`' per-case `tagOverlaps` breakdowns into a tag x case
 * table — the "a side-by-side case-option comparison table" follow-up named
 * under the "Scout-to-Strategy Workflow" bullet in TODO.md's Research
 * Crowdsourcing Organizer Features list. Where the existing "Case rankings"
 * list only shows each case's *total* overlap score, this table breaks that
 * total down by the specific tags driving it, so a team can compare which
 * cases share which opponent-prepped tags rather than only the aggregate.
 *
 * Older persisted `RankedCaseOption`s built before this field existed have
 * no `tagOverlaps` — treated as an empty breakdown (contributing no rows),
 * so the table degrades gracefully instead of throwing.
 */
export function buildCaseComparisonTable(caseRankings: RankedCaseOption[]): CaseComparisonTable {
  const caseNames = caseRankings.map((option) => option.name);
  const rowsByTag = new Map<string, { opponentFrequency: number; caseNamesWithTag: Set<string> }>();

  for (const option of caseRankings) {
    for (const overlap of option.tagOverlaps ?? []) {
      const existing = rowsByTag.get(overlap.tag);
      if (existing) {
        existing.caseNamesWithTag.add(option.name);
      } else {
        rowsByTag.set(overlap.tag, {
          opponentFrequency: overlap.opponentFrequency,
          caseNamesWithTag: new Set([option.name]),
        });
      }
    }
  }

  const rows: CaseComparisonRow[] = [...rowsByTag.entries()]
    .map(([tag, { opponentFrequency, caseNamesWithTag }]) => ({
      tag,
      opponentFrequency,
      perCase: Object.fromEntries(
        caseNames.map((name) => [name, caseNamesWithTag.has(name) ? opponentFrequency : 0]),
      ),
    }))
    .sort((a, b) => (b.opponentFrequency !== a.opponentFrequency ? b.opponentFrequency - a.opponentFrequency : a.tag.localeCompare(b.tag)));

  return { caseNames, rows };
}

/**
 * Builds concrete judge-adaptation notes from a `JudgeProfile`'s tracked
 * tendencies (speed tolerance, theory receptiveness, side bias, most-tagged
 * paradigm). Returns explicit fallback text when there's no judge data on
 * file, or when the judge has no notable tendencies to adapt to.
 */
export function buildJudgeAdaptationNotes(judgeProfile?: JudgeProfile): string[] {
  if (!judgeProfile || judgeProfile.roundsJudged === 0) {
    return ["No judge tendency data on file — adapt to a generic flow judge by default."];
  }

  const notes: string[] = [];

  if (judgeProfile.speedTolerance === "low") {
    notes.push("Slow down delivery — this judge has a low tracked speed tolerance.");
  } else if (judgeProfile.speedTolerance === "high") {
    notes.push("Full speed is fine — this judge tracks high-pace delivery well.");
  }

  if (judgeProfile.theoryReceptiveness === "low") {
    notes.push("Avoid leaning on theory arguments — this judge rarely votes on them.");
  } else if (judgeProfile.theoryReceptiveness === "high") {
    notes.push("Theory arguments are viable — this judge often votes on them.");
  }

  if (judgeProfile.sideBias.hasNotableSideBias) {
    const favoredSide = judgeProfile.sideBias.affWinRate > judgeProfile.sideBias.negWinRate ? "aff" : "neg";
    notes.push(`This judge has historically favored the ${favoredSide} side.`);
  }

  if (judgeProfile.mostCommonParadigm) {
    const confidencePct = Math.round((judgeProfile.mostCommonParadigmConfidence ?? 0) * 100);
    notes.push(
      `Most-tagged paradigm: ${judgeProfile.mostCommonParadigm} (${confidencePct}% confidence) — frame weighing accordingly.`,
    );
  }

  if (notes.length === 0) {
    notes.push("No strong tendencies detected — adapt based on in-round reads.");
  }

  return notes;
}

/** Minimum rounds recorded on a specific side before its win rate is treated as a risk signal. */
const MIN_SIDE_ROUNDS_FOR_RISK = 2;

/**
 * Assesses an overall matchup risk level from the opponent's win rate/side
 * preference and the judge's side bias. This is an illustrative heuristic
 * only — one risk factor detected is `medium`, two or more is `high`, none
 * is `low` — not a validated probability model.
 *
 * When `ourSide` is supplied, the opponent-side-preference and judge-side-bias
 * checks are scoped to `getLikelyOpponentSide(ourSide)` — the side the
 * opponent will actually run against us this round — instead of judging any
 * side preference/bias as generically risky. A judge favoring *our* side is
 * not treated as a risk factor. Without `ourSide`, both checks fall back to
 * the prior side-agnostic behavior.
 */
export function assessMatchupRisk(
  opponentProfile?: OpponentTeamProfile,
  judgeProfile?: JudgeProfile,
  ourSide?: DebateSide,
): { riskLevel: RiskLevel; riskFactors: string[] } {
  const riskFactors: string[] = [];
  const likelyOpponentSide = ourSide ? getLikelyOpponentSide(ourSide) : undefined;

  if (opponentProfile && opponentProfile.roundsRecorded > 0) {
    if (opponentProfile.record.winRate >= 0.65) {
      riskFactors.push(
        `Opponent has a strong overall record (${Math.round(opponentProfile.record.winRate * 100)}% win rate across ${opponentProfile.roundsRecorded} round(s)).`,
      );
    }

    if (likelyOpponentSide) {
      const likelySideSplit = opponentProfile.sideRecord[likelyOpponentSide];
      if (likelySideSplit.rounds >= MIN_SIDE_ROUNDS_FOR_RISK && likelySideSplit.winRate >= 0.65) {
        riskFactors.push(
          `Opponent has a strong record on ${likelyOpponentSide} (${Math.round(likelySideSplit.winRate * 100)}% win rate across ${likelySideSplit.rounds} round(s)) — the side they'll likely run against us.`,
        );
      }
    } else if (opponentProfile.sideRecord.hasNotableSidePreference) {
      riskFactors.push(
        `Opponent performs notably better on the ${opponentProfile.sideRecord.strongerSide} side.`,
      );
    }
  }

  if (judgeProfile && judgeProfile.sideBias.hasNotableSideBias) {
    const favoredSide = judgeProfile.sideBias.affWinRate > judgeProfile.sideBias.negWinRate ? "aff" : "neg";
    if (!likelyOpponentSide) {
      riskFactors.push(`Judge has a notable historical side bias toward ${favoredSide}.`);
    } else if (favoredSide === likelyOpponentSide) {
      riskFactors.push(
        `Judge has a notable historical side bias toward ${favoredSide} — the side the opponent will likely run against us.`,
      );
    }
    // A bias toward our own side is favorable, not a risk factor.
  }

  const riskLevel: RiskLevel = riskFactors.length >= 2 ? "high" : riskFactors.length === 1 ? "medium" : "low";
  return { riskLevel, riskFactors };
}

/**
 * Composes a `StrategyRecommendation` from whichever scouting/judge/case
 * inputs the caller has on hand: a case ranking (safest first), judge
 * adaptation notes, and an overall risk level with its contributing factors.
 */
export function buildStrategyRecommendation(
  input: BuildStrategyRecommendationInput,
): StrategyRecommendation {
  const caseRankings = rankCaseOptions(input.caseOptions, input.opponentProfile);
  const { riskLevel, riskFactors } = assessMatchupRisk(input.opponentProfile, input.judgeProfile, input.ourSide);

  return {
    recommendedCase: caseRankings[0] ?? null,
    caseRankings,
    judgeAdaptationNotes: buildJudgeAdaptationNotes(input.judgeProfile),
    riskLevel,
    riskFactors,
  };
}

export interface BuildStrategyRecommendationFromStoresInput {
  caseOptions: CaseOption[];
  /** Looked up via `debate-data-sync`'s `opponentTeamProfiles.ts` store when `opponentProfile` isn't supplied directly. */
  opponentTeamId?: string;
  /** Looked up via `debate-speech-writer`'s `judgeProfiles.ts` store when `judgeProfile` isn't supplied directly. */
  judgeId?: string;
  opponentProfile?: OpponentTeamProfile;
  judgeProfile?: JudgeProfile;
  /** The side our team will run this round, when known — see `BuildStrategyRecommendationInput.ourSide`. */
  ourSide?: DebateSide;
}

/**
 * Thin store-wiring slice over `buildStrategyRecommendation` — the "(a) a
 * case-choice/strategy panel UI" follow-up named under the
 * "Scout-to-Strategy Workflow" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features list needs a recommendation composed from persisted
 * scouting data, not caller-supplied profile objects. Resolves
 * `opponentProfile`/`judgeProfile` from the existing
 * `opponentTeamProfiles.ts`/`judgeProfiles.ts` persistence stores by id when
 * the caller doesn't already have the profile object on hand, mirroring
 * `pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores` convention.
 */
export function buildStrategyRecommendationFromStores(
  input: BuildStrategyRecommendationFromStoresInput,
): StrategyRecommendation {
  const opponentProfile =
    input.opponentProfile ??
    (input.opponentTeamId ? getOpponentTeamProfile(input.opponentTeamId) : undefined);
  const judgeProfile = input.judgeProfile ?? (input.judgeId ? getJudgeProfile(input.judgeId) : undefined);

  return buildStrategyRecommendation({
    caseOptions: input.caseOptions,
    opponentProfile,
    judgeProfile,
    ourSide: input.ourSide,
  });
}

/**
 * Renders a `StrategyRecommendation` as a single markdown-ish text document,
 * suitable for a strategy panel or a printable/shareable pre-round note.
 */
export function buildStrategyRecommendationText(recommendation: StrategyRecommendation): string {
  const lines = [
    "### Recommended case",
    recommendation.recommendedCase
      ? `${recommendation.recommendedCase.name} (overlap score: ${recommendation.recommendedCase.overlapScore})`
      : "No case options supplied.",
    "",
    "### Case rankings",
    recommendation.caseRankings.length > 0
      ? recommendation.caseRankings.map((c) => `- ${c.name} (overlap score: ${c.overlapScore})`).join("\n")
      : "No case options supplied.",
    "",
    "### Judge adaptation",
    recommendation.judgeAdaptationNotes.map((note) => `- ${note}`).join("\n"),
    "",
    `### Risk level: ${recommendation.riskLevel}`,
    recommendation.riskFactors.length > 0
      ? recommendation.riskFactors.map((factor) => `- ${factor}`).join("\n")
      : "- No notable risk factors detected.",
  ];

  return lines.join("\n");
}

/**
 * Formats a `StrategyRecommendation` as a single-line prep-note summary —
 * the recommended case (or that none were ranked) plus the overall risk
 * level — for `pre-round-briefing.ts#appendNoteToPreRoundBriefing`'s "Team
 * prep notes" bullet list. `matchupId` is prefixed so the note is
 * self-identifying once it's living inside a briefing keyed by a different
 * id (`roundId`, not `matchupId`).
 */
export function buildStrategyRecommendationPrepNote(
  recommendation: StrategyRecommendation,
  matchupId: string,
): string {
  const casePart = recommendation.recommendedCase
    ? `recommend "${recommendation.recommendedCase.name}"`
    : "no case options were ranked";
  return `Scout-to-Strategy (matchup ${matchupId}): ${casePart} — ${recommendation.riskLevel} risk.`;
}
