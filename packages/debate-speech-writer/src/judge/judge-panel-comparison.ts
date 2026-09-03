/**
 * @fileoverview Multi-judge panel comparison — the "a multi-judge comparison
 * view for panel rounds" follow-up named under the "⚖️ Judge Profiles"
 * bullet in TODO.md's Research Crowdsourcing Organizer Features list.
 *
 * A panel round (two or more judges deciding together) needs prep that a
 * single `JudgeProfile` doesn't answer on its own: what pace is safe for
 * the *whole* panel, whether running theory is safe in front of every
 * judge on it, and whether the panel's tagged paradigms pull in different
 * directions. This module turns a caller-supplied list of `JudgeProfile`s
 * (already built/persisted via `judge-profile.ts`/`state/judgeProfiles.ts`)
 * into that panel-level read — it doesn't fetch or aggregate ballot data
 * itself.
 *
 * @module judge/judge-panel-comparison
 */

import type { BuiltinJudgeParadigmId } from "./judge-paradigms";
import type { DebateSide, JudgeProfile } from "./judge-profile";

/** A judge on the panel with a notable lean toward one side. */
export interface PanelSideLean {
  judgeId: string;
  leansSide: DebateSide;
}

/** A judge's most-tagged paradigm, as represented on the panel (null if untagged). */
export interface PanelParadigmEntry {
  judgeId: string;
  paradigmId: BuiltinJudgeParadigmId | null;
}

/**
 * Whether running a theory argument reads as safe across the whole panel:
 * `"unknown"` when no judge on the panel has tracked theory receptiveness,
 * `"safe"` when every judge who has is `medium`/`high` (no `low`),
 * `"risky"` when every judge who has is `low` (running theory upsets the
 * whole panel, not just a swing vote), and `"mixed"` when the panel is
 * split — some judges favor it, at least one is averse.
 */
export type PanelTheoryRisk = "unknown" | "safe" | "risky" | "mixed";

export interface JudgePanelComparison {
  judgeIds: string[];
  judges: JudgeProfile[];
  /** Judges on the panel with a notable side bias (`judge-profile.ts`'s `hasNotableSideBias`), and which side. */
  sideLeans: PanelSideLean[];
  /**
   * The pace to prep at for the whole panel: the slowest tracked average
   * pace among the judges on it, so the round doesn't lose whichever judge
   * is least speed-tolerant. Null when no judge on the panel tracked pace.
   */
  recommendedPaceWpm: number | null;
  /** The judge `recommendedPaceWpm` is drawn from, or null when no judge tracked pace. */
  slowestPacedJudgeId: string | null;
  theoryRisk: PanelTheoryRisk;
  /** Judges on the panel with `theoryReceptiveness === "low"`. */
  judgesAverseToTheory: string[];
  /** Each judge's most-tagged paradigm, in panel (input) order. */
  paradigms: PanelParadigmEntry[];
  /** True when two or more judges on the panel have a different (non-null) most-tagged paradigm. */
  hasConflictingParadigms: boolean;
}

/**
 * Builds a panel-level comparison from two or more judge profiles.
 *
 * @throws if fewer than two profiles are supplied — a panel comparison
 * isn't meaningful for a single judge (see `judge-profile.ts`'s own
 * per-judge summary for that case).
 */
export function buildJudgePanelComparison(profiles: JudgeProfile[]): JudgePanelComparison {
  if (profiles.length < 2) {
    throw new Error("buildJudgePanelComparison needs at least two judge profiles to compare.");
  }

  const sideLeans: PanelSideLean[] = profiles
    .filter((profile) => profile.sideBias.hasNotableSideBias)
    .map((profile) => ({
      judgeId: profile.judgeId,
      leansSide: profile.sideBias.affWinRate > profile.sideBias.negWinRate ? "aff" : "neg",
    }));

  const pacedProfiles = profiles.filter(
    (profile): profile is JudgeProfile & { avgPaceWpm: number } => profile.avgPaceWpm != null,
  );
  let recommendedPaceWpm: number | null = null;
  let slowestPacedJudgeId: string | null = null;
  for (const profile of pacedProfiles) {
    if (recommendedPaceWpm === null || profile.avgPaceWpm < recommendedPaceWpm) {
      recommendedPaceWpm = profile.avgPaceWpm;
      slowestPacedJudgeId = profile.judgeId;
    }
  }

  const trackedReceptiveness = profiles
    .map((profile) => profile.theoryReceptiveness)
    .filter((value): value is NonNullable<typeof value> => value !== null);
  const hasLowReceptiveness = trackedReceptiveness.includes("low");
  const hasNonLowReceptiveness = trackedReceptiveness.some((value) => value !== "low");
  let theoryRisk: PanelTheoryRisk;
  if (trackedReceptiveness.length === 0) {
    theoryRisk = "unknown";
  } else if (hasLowReceptiveness && hasNonLowReceptiveness) {
    theoryRisk = "mixed";
  } else if (hasLowReceptiveness) {
    theoryRisk = "risky";
  } else {
    theoryRisk = "safe";
  }
  const judgesAverseToTheory = profiles
    .filter((profile) => profile.theoryReceptiveness === "low")
    .map((profile) => profile.judgeId);

  const paradigms: PanelParadigmEntry[] = profiles.map((profile) => ({
    judgeId: profile.judgeId,
    paradigmId: profile.mostCommonParadigm,
  }));
  const distinctParadigms = new Set(
    paradigms.map((entry) => entry.paradigmId).filter((id): id is BuiltinJudgeParadigmId => id !== null),
  );
  const hasConflictingParadigms = distinctParadigms.size > 1;

  return {
    judgeIds: profiles.map((profile) => profile.judgeId),
    judges: profiles,
    sideLeans,
    recommendedPaceWpm,
    slowestPacedJudgeId,
    theoryRisk,
    judgesAverseToTheory,
    paradigms,
    hasConflictingParadigms,
  };
}

/** Renders a `JudgePanelComparison` as short, human-readable bullet lines for a panel-prep view. */
export function buildJudgePanelComparisonSummary(comparison: JudgePanelComparison): string {
  const lines = [`Panel of ${comparison.judgeIds.length}: ${comparison.judgeIds.join(", ")}.`];

  lines.push(
    comparison.sideLeans.length > 0
      ? `Side leans: ${comparison.sideLeans
          .map((lean) => `${lean.judgeId} → ${lean.leansSide}`)
          .join(", ")}`
      : "Side leans: no judge on this panel has a notable side bias on record.",
  );

  lines.push(
    comparison.recommendedPaceWpm != null
      ? `Recommended pace: ${comparison.recommendedPaceWpm} wpm (set by ${comparison.slowestPacedJudgeId}, the panel's least speed-tolerant tracked judge)`
      : "Recommended pace: unknown (no judge on this panel tracked pace)",
  );

  switch (comparison.theoryRisk) {
    case "unknown":
      lines.push("Theory: unknown (no judge on this panel tracked theory receptiveness)");
      break;
    case "safe":
      lines.push("Theory: safe to run — no judge on this panel is theory-averse");
      break;
    case "risky":
      lines.push(
        `Theory: risky — every tracked judge on this panel is theory-averse (${comparison.judgesAverseToTheory.join(", ")})`,
      );
      break;
    case "mixed":
      lines.push(
        `Theory: mixed — ${comparison.judgesAverseToTheory.join(", ")} averse, others receptive`,
      );
      break;
  }

  lines.push(
    comparison.hasConflictingParadigms
      ? `Paradigms: conflicting across the panel (${comparison.paradigms
          .map((entry) => `${entry.judgeId}: ${entry.paradigmId ?? "untagged"}`)
          .join(", ")})`
      : "Paradigms: no conflict among tagged judges on this panel",
  );

  return lines.join("\n");
}
