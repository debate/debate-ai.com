/**
 * @fileoverview Account-linked tournament-result sync —
 * docs/features/team-rankings.md's "Standings data (logged/imported
 * tournament results, the custom points table, and the qualification
 * cutoff) is stored in localStorage only... it doesn't yet follow a
 * signed-in user across devices" Known gap. Pure validation helpers shared
 * by the `/api/tournament-results` D1-backed routes (`apps/debate-ai.com`)
 * and `hooks/useStandingsAccountSync.ts`, mirroring
 * `debate-practice-drills`' `state/savedWordCountRounds.ts` split — kept
 * framework/fetch-free so both sides agree on what a valid synced record is
 * without duplicating logic.
 *
 * Like `savedWordCountRounds.ts`'s `WordCountRoundRecord`, a
 * `TournamentResultRecord`'s payload is small, so
 * `GET /api/tournament-results` returns every record in full — no separate
 * summary/label concept here.
 *
 * @module state/savedTournamentResults
 */

import type { OutroundFinish } from "../rankings/ndca-standings";
import type { TournamentResultRecord } from "./tournamentResults";

/** Hard cap on a single result's JSON size — generous for even a long team/tournament name, well short of D1's row-size limits. */
export const MAX_SAVED_TOURNAMENT_RESULT_BYTES = 20_000;

const OUTROUND_FINISHES = new Set<OutroundFinish>([
  "champion",
  "finalist",
  "semifinalist",
  "quarterfinalist",
  "octofinalist",
  "doubleOctofinalist",
  "tripleOctofinalist",
  "prelims",
]);

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `TournamentResultRecord`. `finish` is checked
 * against the same `OutroundFinish` union `ndca-standings.ts` itself
 * scores with.
 */
export function isValidTournamentResultRecord(value: unknown): value is TournamentResultRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.trim().length === 0) return false;
  if (typeof record.teamId !== "string" || record.teamId.trim().length === 0) return false;
  if (typeof record.tournamentName !== "string" || record.tournamentName.trim().length === 0) return false;
  if (typeof record.date !== "string" || record.date.trim().length === 0) return false;
  if (typeof record.division !== "string" || record.division.trim().length === 0) return false;
  if (typeof record.finish !== "string" || !OUTROUND_FINISHES.has(record.finish as OutroundFinish)) return false;
  if (!isNonNegativeInt(record.bidLevel)) return false;
  if (!isNonNegativeInt(record.prelimWins)) return false;
  if (!isNonNegativeInt(record.prelimLosses)) return false;

  return true;
}
