/**
 * @fileoverview Settles one round video's decision for the watch page's
 * "Reveal decision" button: the overall result and how each judge voted.
 *
 * Order of trust:
 * 1. what the library already stores (`aff_win`, `judge_decision`, and the
 *    judges the results lookups saved), which needs no request;
 * 2. otherwise the round is looked up live with the lookups behind the
 *    video edit dialog's "Look up results" — College Debate Results for
 *    college (style 4), Tabroom for Policy / PF / LD (1–3, via `hs-results`)
 *    and Parliamentary (8, via `tabroom-results`);
 * 3. otherwise it is `unknown`, which the page shows as "?" — never an error.
 *
 * A stored winner is never overridden: if the live result disagrees with it,
 * the stored winner stands and the judges' sides are left unnamed rather than
 * guessed. Nothing is written back; callers cache the answer.
 * @module lib/videos/round-decision
 */

import {
  createBudgetedFetcher,
  lookupCollegeResult,
  parseJudgePanel,
  type CollegeResultsLookup,
} from "@debate-ai/videos-admin/src/lib/college-results";
import { lookupHsResult } from "@debate-ai/videos-admin/src/lib/hs-results";
import { lookupTabroomResult } from "@debate-ai/videos-admin/src/lib/tabroom-results";
import { judgeVotes } from "@debate-ai/videos/src/components/videos/watch/JudgeVotes";
import { hasDecision } from "@debate-ai/videos/src/lib/decision-summary";
import {
  UNKNOWN_DECISION,
  type RoundDecision,
  type RoundDecisionJudge,
  type RoundDecisionSource,
} from "@debate-ai/videos/src/lib/round-decision";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The stored fields of one round video a decision is settled from. */
export interface RoundDecisionRow {
  style: number | null;
  tournament: string | null;
  roundLevel: string | null;
  affTeam: string | null;
  negTeam: string | null;
  seasonYear: number | null;
  publishedAt: string | null;
  affWin: boolean | number | null;
  judgeDecision: string | null;
  resultsJudges: string | null;
  resultsSquirrels: string | null;
}

/** Requests one decision lookup may make: under a Worker's subrequest limit. */
export const DECISION_MAX_REQUESTS = 45;

/** Which results site covers a style: College Debate Results, or Tabroom. */
export function resultsSourceFor(style: number | null): RoundDecisionSource | null {
  if (style === 4) return "college-debate-results";
  if (style === 1 || style === 2 || style === 3 || style === 8) return "tabroom";
  return null;
}

/** Looks a round up on its style's results site; may throw on network or auth failure. */
export type DecisionLookup = (row: RoundDecisionRow & { tournament: string; affTeam: string; negTeam: string }) => Promise<CollegeResultsLookup | null>;

/** The live lookups, with `tabroom` the fetch signed in as the site's Tabroom account. */
export function liveDecisionLookup(deps: { fetch?: FetchLike; tabroomFetch: () => FetchLike }): DecisionLookup {
  return async (row) => {
    const source = resultsSourceFor(row.style);
    if (!source) return null;
    const base = {
      tournament: row.tournament,
      roundLevel: row.roundLevel,
      affTeam: row.affTeam,
      negTeam: row.negTeam,
      seasonYear: row.seasonYear,
      publishedAt: row.publishedAt,
    };
    const budget = (fetcher: FetchLike) => createBudgetedFetcher(fetcher, { maxRequests: DECISION_MAX_REQUESTS });
    if (source === "college-debate-results") return lookupCollegeResult(base, budget(deps.fetch ?? fetch));
    if (row.style === 8) return lookupTabroomResult({ ...base, style: 8 }, budget(deps.tabroomFetch()));
    return lookupHsResult({ ...base, style: row.style ?? "" }, budget(deps.tabroomFetch()));
  };
}

const boolOrNull = (value: boolean | number | null | undefined): boolean | null =>
  value === null || value === undefined ? null : Boolean(value);

/** Stored judges as the API returns them; their sides follow the winner, and stay unnamed when the squirrels are unknown. */
function storedJudges(row: RoundDecisionRow, affWin: boolean | null): RoundDecisionJudge[] {
  return judgeVotes(row.resultsJudges, row.resultsSquirrels, affWin).map((vote) => ({
    name: vote.name,
    side: row.resultsSquirrels === null ? null : vote.side,
    squirreled: vote.squirreled,
  }));
}

/** The winner a decision text names ("3-0 Neg", "Aff 2-1"); null when it names neither side. */
function sideInText(text: string | null): boolean | null {
  const side = text?.match(/\b(aff|neg)/i)?.[1].toLowerCase();
  return side === undefined ? null : side === "aff";
}

/** The decision a stored row already holds, or null when it holds none. */
function fromStored(row: RoundDecisionRow): RoundDecision | null {
  if (!hasDecision(boolOrNull(row.affWin) ?? undefined, row.judgeDecision)) return null;
  const affWin = boolOrNull(row.affWin) ?? sideInText(row.judgeDecision);
  return {
    status: "known",
    source: "stored",
    affWin,
    decision: row.judgeDecision?.trim() || null,
    judges: row.resultsJudges ? storedJudges(row, affWin) : [],
    url: null,
  };
}

/**
 * The lookup's decision in the video's own orientation. `knownAffWin` is the
 * winner already stored, which a contradicting lookup does not override.
 */
function fromLookup(
  lookup: CollegeResultsLookup,
  source: RoundDecisionSource,
  knownAffWin: boolean | null,
): RoundDecision | null {
  if (!lookup.match) return null;
  const lookedUpAffWin = lookup.status === "verified" && lookup.winnerSide
    ? (lookup.winnerSide === "aff") !== lookup.sidesSwapped
    : null;
  const affWin = knownAffWin ?? lookedUpAffWin;
  const agrees = knownAffWin === null || lookedUpAffWin === null || knownAffWin === lookedUpAffWin;
  const panel = parseJudgePanel(lookup.match.judges, lookup.ballots);
  // Sides are only named when the winner is settled, the site agrees with it,
  // and the panel's markers add up (squirrels known).
  const namedSides = affWin !== null && agrees && panel.squirrels !== null;
  const votes = namedSides
    ? judgeVotes(panel.judges.join(", "), panel.squirrels!.join(", "), affWin)
    : panel.judges.map((name) => ({ name, side: null, squirreled: false }));
  const decision = lookup.ballots ?? null;
  const known = affWin !== null || decision !== null;
  return {
    status: known ? "known" : "unknown",
    source,
    affWin,
    decision,
    judges: votes.map((vote) => ({ name: vote.name, side: vote.side, squirreled: vote.squirreled })),
    url: lookup.tournament?.url ?? null,
  };
}

/** A decision plus whether it is final enough to cache for long. */
export interface ResolvedDecision {
  decision: RoundDecision;
  /** False when a lookup failed (network, auth, budget): retry sooner. */
  settled: boolean;
}

/**
 * The decision for one round row. `lookup` is only called when the row lacks a
 * decision or its judges, and has a tournament, both teams, and a style a
 * results site covers.
 */
export async function resolveRoundDecision(row: RoundDecisionRow, lookup: DecisionLookup): Promise<ResolvedDecision> {
  const stored = fromStored(row);
  const lookable = !!row.tournament?.trim() && !!row.affTeam?.trim() && !!row.negTeam?.trim() && resultsSourceFor(row.style) !== null;
  if (stored && (stored.judges.length > 0 || !lookable)) return { decision: stored, settled: true };
  if (!lookable) return { decision: UNKNOWN_DECISION, settled: true };

  const source = resultsSourceFor(row.style)!;
  try {
    const result = await lookup({ ...row, tournament: row.tournament!, affTeam: row.affTeam!, negTeam: row.negTeam! });
    const found = result ? fromLookup(result, source, stored ? stored.affWin : null) : null;
    if (!found) return { decision: stored ?? UNKNOWN_DECISION, settled: true };
    if (!stored) return { decision: found, settled: true };
    // Stored result with no saved judges: keep it, add the judges the site names.
    return { decision: { ...stored, judges: found.judges, url: found.url }, settled: true };
  } catch {
    // Out of requests, a lost Tabroom session or a results-site outage: the
    // round just reads as unknown for now.
    return { decision: stored ?? UNKNOWN_DECISION, settled: false };
  }
}

/** How long this instance remembers an answer: a settled result for a day, an unknown one for an hour. */
const KNOWN_TTL_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED = 500;

const cache = new Map<string, { decision: RoundDecision; expires: number }>();

/** The remembered decision for a video, or null when none is fresh. */
export function cachedDecision(videoId: string): RoundDecision | null {
  const hit = cache.get(videoId);
  return hit && hit.expires > Date.now() ? hit.decision : null;
}

/** Remembers a settled decision for this instance (oldest entries drop first). */
export function cacheDecision(videoId: string, decision: RoundDecision): void {
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
  cache.set(videoId, { decision, expires: Date.now() + (decision.status === "known" ? KNOWN_TTL_MS : UNKNOWN_TTL_MS) });
}

/** Test helper: forgets every remembered decision. */
export function resetDecisionCache(): void {
  cache.clear();
}
