/**
 * @fileoverview The shape of `/api/videos/decision`: a round's overall
 * decision and how each judge voted, as the watch page shows them once
 * "Reveal decision" is clicked.
 *
 * A round the library has no result for (and the results sites can't settle)
 * is `unknown` — the page shows "?" for it, not an error.
 * @module lib/round-decision
 */

/** Where a decision came from. */
export type RoundDecisionSource = "stored" | "college-debate-results" | "tabroom";

/** One judge and the side they voted for (null when the ballots don't say). */
export interface RoundDecisionJudge {
  name: string;
  side: "aff" | "neg" | null;
  /** Voted against the winner (the minority of the panel). */
  squirreled: boolean;
}

export interface RoundDecision {
  /** `known` when a winner or a decision text is on record; else `unknown`. */
  status: "known" | "unknown";
  source: RoundDecisionSource | null;
  /** True aff won, false neg won, null when not known. */
  affWin: boolean | null;
  /** Ballot count (`"2-1"`) or the stored decision text; null when none. */
  decision: string | null;
  judges: RoundDecisionJudge[];
  /** The tournament's results page, when the decision came from one. */
  url: string | null;
}

/** What a round with no findable result looks like. */
export const UNKNOWN_DECISION: RoundDecision = {
  status: "unknown",
  source: null,
  affWin: null,
  decision: null,
  judges: [],
  url: null,
};

/** Narrows an API payload to a {@link RoundDecision}, else the unknown one. */
export function parseRoundDecision(value: unknown): RoundDecision {
  if (!value || typeof value !== "object") return UNKNOWN_DECISION;
  const raw = value as Partial<RoundDecision>;
  const judges = Array.isArray(raw.judges)
    ? raw.judges
        .filter((judge): judge is RoundDecisionJudge => typeof judge?.name === "string" && judge.name.trim() !== "")
        .map((judge) => ({
          name: judge.name,
          side: judge.side === "aff" || judge.side === "neg" ? judge.side : null,
          squirreled: judge.squirreled === true,
        }))
    : [];
  const affWin = typeof raw.affWin === "boolean" ? raw.affWin : null;
  const decision = typeof raw.decision === "string" && raw.decision.trim() ? raw.decision.trim() : null;
  return {
    status: raw.status === "known" && (affWin !== null || decision !== null) ? "known" : "unknown",
    source: raw.source === "stored" || raw.source === "college-debate-results" || raw.source === "tabroom" ? raw.source : null,
    affWin,
    decision,
    judges,
    url: typeof raw.url === "string" && /^https?:\/\//.test(raw.url) ? raw.url : null,
  };
}

/** Human name for a decision's source, for the attribution link. */
export const DECISION_SOURCE_LABELS: Record<RoundDecisionSource, string> = {
  stored: "Debate AI",
  "college-debate-results": "College Debate Results",
  tabroom: "Tabroom",
};
