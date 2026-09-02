/**
 * @fileoverview Judge tendency profiles.
 *
 * Turns a judge's caller-supplied ballot history into an aggregate profile —
 * side-vote bias, average speaker points awarded, a rough delivery-speed
 * tolerance estimate, and theory receptiveness — the computation layer
 * behind a future judge-profile view (idea: "Judge Profiles" in TODO.md's
 * Research Crowdsourcing Organizer Features list). This does not read or
 * persist real ballot data (no `Round`/ballot schema in this repo captures
 * speaker points, pace, or theory outcomes today); callers supply their own
 * `JudgeRoundRecord`s, e.g. reconstructed from tab-service ballots.
 */

import { type BuiltinJudgeParadigmId } from "./judge-paradigms";

export type DebateSide = "aff" | "neg";

/** A single round a judge decided, as reconstructed by the caller. */
export interface JudgeRoundRecord {
  judgeId: string;
  tournamentName: string;
  date: string;
  division: string;
  winningSide: DebateSide;
  affSpeakerPoints: number;
  negSpeakerPoints: number;
  /** Average delivery pace (words per minute) the judge followed along with, if tracked. */
  paceWpm?: number;
  theoryArgumentRaised: boolean;
  theoryArgumentWon: boolean;
  /** Paradigm the judge was tagged with for this round, if known. */
  paradigmId?: BuiltinJudgeParadigmId;
}

export type SpeedTolerance = "low" | "medium" | "high";
export type TheoryReceptiveness = "low" | "medium" | "high";

/**
 * Illustrative pace thresholds (words per minute) used to bucket a judge's
 * average tracked pace into a `SpeedTolerance`. Not derived from any
 * authoritative circuit norms — an approximate default only.
 */
export const DEFAULT_SPEED_THRESHOLDS_WPM = {
  /** At or below this average pace, tolerance is bucketed "low". */
  low: 200,
  /** At or below this average pace (and above `low`), tolerance is "medium". Above it, "high". */
  medium: 300,
};

/** Minimum rounds judged before `hasNotableSideBias` can be flagged. */
const MIN_ROUNDS_FOR_SIDE_BIAS = 5;
/** Minimum |winRate - 0.5| to flag a notable side bias. */
const SIDE_BIAS_THRESHOLD = 0.15;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Classifies an average tracked pace into a rough speed-tolerance bucket. */
export function classifySpeedTolerance(
  avgPaceWpm: number,
  thresholds = DEFAULT_SPEED_THRESHOLDS_WPM,
): SpeedTolerance {
  if (avgPaceWpm <= thresholds.low) return "low";
  if (avgPaceWpm <= thresholds.medium) return "medium";
  return "high";
}

/** Classifies a theory-argument win rate (0-1) into a rough receptiveness bucket. */
export function classifyTheoryReceptiveness(theoryWinRate: number): TheoryReceptiveness {
  if (theoryWinRate < 1 / 3) return "low";
  if (theoryWinRate > 2 / 3) return "high";
  return "medium";
}

export interface JudgeProfile {
  judgeId: string;
  roundsJudged: number;
  tournamentsJudged: number;
  sideBias: {
    affWins: number;
    negWins: number;
    affWinRate: number;
    negWinRate: number;
    /** True when one side wins notably more often across enough rounds to be meaningful. */
    hasNotableSideBias: boolean;
  };
  avgSpeakerPoints: {
    aff: number;
    neg: number;
    overall: number;
  };
  /** Null when no round in the history tracked `paceWpm`. */
  speedTolerance: SpeedTolerance | null;
  avgPaceWpm: number | null;
  /** Null when no round in the history raised a theory argument. */
  theoryReceptiveness: TheoryReceptiveness | null;
  theoryWinRate: number | null;
  roundsWithTheoryRaised: number;
  /** Most frequently tagged paradigm across the history, tie-broken alphabetically. Null if none tagged. */
  mostCommonParadigm: BuiltinJudgeParadigmId | null;
  /**
   * Share (0-1) of paradigm-tagged rounds that carried `mostCommonParadigm`,
   * e.g. 0.67 if it was tagged in 2 of 3 tagged rounds. Null when
   * `mostCommonParadigm` is null (no round tagged a paradigm at all).
   */
  mostCommonParadigmConfidence: number | null;
}

/**
 * Aggregates a judge's ballot history into a `JudgeProfile`: side-vote bias,
 * average speaker points awarded to each side, a rough delivery-speed
 * tolerance estimate (from whichever rounds tracked pace), theory-argument
 * receptiveness (from whichever rounds raised one), and the paradigm they
 * were most often tagged with.
 */
export function buildJudgeProfile(
  judgeId: string,
  records: JudgeRoundRecord[],
): JudgeProfile {
  const roundsJudged = records.length;
  const tournamentsJudged = new Set(records.map((r) => r.tournamentName)).size;

  const affWins = records.filter((r) => r.winningSide === "aff").length;
  const negWins = roundsJudged - affWins;
  const affWinRate = roundsJudged > 0 ? affWins / roundsJudged : 0;
  const negWinRate = roundsJudged > 0 ? negWins / roundsJudged : 0;
  const hasNotableSideBias =
    roundsJudged >= MIN_ROUNDS_FOR_SIDE_BIAS &&
    Math.abs(affWinRate - 0.5) >= SIDE_BIAS_THRESHOLD;

  const avgAff =
    roundsJudged > 0
      ? round2(records.reduce((sum, r) => sum + r.affSpeakerPoints, 0) / roundsJudged)
      : 0;
  const avgNeg =
    roundsJudged > 0
      ? round2(records.reduce((sum, r) => sum + r.negSpeakerPoints, 0) / roundsJudged)
      : 0;
  const avgOverall =
    roundsJudged > 0
      ? round2(
          records.reduce((sum, r) => sum + r.affSpeakerPoints + r.negSpeakerPoints, 0) /
            (roundsJudged * 2),
        )
      : 0;

  const paceRecords = records.filter((r) => r.paceWpm != null);
  const avgPaceWpm =
    paceRecords.length > 0
      ? round2(paceRecords.reduce((sum, r) => sum + (r.paceWpm ?? 0), 0) / paceRecords.length)
      : null;
  const speedTolerance = avgPaceWpm != null ? classifySpeedTolerance(avgPaceWpm) : null;

  const theoryRaisedRecords = records.filter((r) => r.theoryArgumentRaised);
  const roundsWithTheoryRaised = theoryRaisedRecords.length;
  const theoryWinRate =
    roundsWithTheoryRaised > 0
      ? round2(
          theoryRaisedRecords.filter((r) => r.theoryArgumentWon).length / roundsWithTheoryRaised,
        )
      : null;
  const theoryReceptiveness = theoryWinRate != null ? classifyTheoryReceptiveness(theoryWinRate) : null;

  const paradigmCounts = new Map<BuiltinJudgeParadigmId, number>();
  for (const record of records) {
    if (!record.paradigmId) continue;
    paradigmCounts.set(record.paradigmId, (paradigmCounts.get(record.paradigmId) ?? 0) + 1);
  }
  let mostCommonParadigm: BuiltinJudgeParadigmId | null = null;
  let bestCount = 0;
  for (const [paradigmId, count] of [...paradigmCounts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (count > bestCount) {
      bestCount = count;
      mostCommonParadigm = paradigmId;
    }
  }
  const totalParadigmTaggedRounds = [...paradigmCounts.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  const mostCommonParadigmConfidence =
    mostCommonParadigm !== null ? round2(bestCount / totalParadigmTaggedRounds) : null;

  return {
    judgeId,
    roundsJudged,
    tournamentsJudged,
    sideBias: { affWins, negWins, affWinRate, negWinRate, hasNotableSideBias },
    avgSpeakerPoints: { aff: avgAff, neg: avgNeg, overall: avgOverall },
    speedTolerance,
    avgPaceWpm,
    theoryReceptiveness,
    theoryWinRate,
    roundsWithTheoryRaised,
    mostCommonParadigm,
    mostCommonParadigmConfidence,
  };
}

/** Groups a flat list of round records by `judgeId`, for building many profiles at once. */
export function groupRecordsByJudge(
  records: JudgeRoundRecord[],
): Record<string, JudgeRoundRecord[]> {
  const grouped: Record<string, JudgeRoundRecord[]> = {};
  for (const record of records) {
    (grouped[record.judgeId] ??= []).push(record);
  }
  return grouped;
}

/** Builds a `JudgeProfile` for every judge keyed in `recordsByJudge`. */
export function buildJudgeProfiles(
  recordsByJudge: Record<string, JudgeRoundRecord[]>,
): JudgeProfile[] {
  return Object.entries(recordsByJudge).map(([judgeId, records]) =>
    buildJudgeProfile(judgeId, records),
  );
}

/**
 * Renders a `JudgeProfile` as short, human-readable bullet lines suitable
 * for a pre-round briefing or judge-profile card.
 */
export function buildJudgeTendencySummary(profile: JudgeProfile): string {
  if (profile.roundsJudged === 0) {
    return `${profile.judgeId}: no judged rounds on record.`;
  }

  const lines = [
    `${profile.judgeId}: ${profile.roundsJudged} round(s) judged across ${profile.tournamentsJudged} tournament(s).`,
    `Side record: Aff ${profile.sideBias.affWins}-${profile.sideBias.negWins} Neg` +
      (profile.sideBias.hasNotableSideBias ? " (notable side bias)" : ""),
    `Avg speaker points: Aff ${profile.avgSpeakerPoints.aff}, Neg ${profile.avgSpeakerPoints.neg} (overall ${profile.avgSpeakerPoints.overall})`,
  ];

  lines.push(
    profile.speedTolerance != null
      ? `Speed tolerance: ${profile.speedTolerance} (avg ${profile.avgPaceWpm} wpm tracked)`
      : "Speed tolerance: unknown (no pace tracked)",
  );

  lines.push(
    profile.theoryReceptiveness != null
      ? `Theory receptiveness: ${profile.theoryReceptiveness} (won ${Math.round(
          (profile.theoryWinRate ?? 0) * 100,
        )}% of ${profile.roundsWithTheoryRaised} theory round(s))`
      : "Theory receptiveness: unknown (no theory raised on record)",
  );

  if (profile.mostCommonParadigm) {
    const confidencePct = Math.round((profile.mostCommonParadigmConfidence ?? 0) * 100);
    lines.push(`Most-tagged paradigm: ${profile.mostCommonParadigm} (${confidencePct}% confidence)`);
  }

  return lines.join("\n");
}
