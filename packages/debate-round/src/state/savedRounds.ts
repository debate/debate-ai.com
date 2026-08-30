/**
 * @fileoverview Account-linked round cloud save — TODO.md idea #17 ("User
 * Settings — account-linked debate preferences"), follow-up (3)/(b):
 * "migrate rounds themselves (the tournament/debaters/judges wrapper)...
 * needs its own schema design for how a saved round should reference its
 * saved flows." Pure validation/derivation helpers shared by the
 * `/api/rounds` D1-backed routes (`apps/debate-ai.com`) and the round
 * cloud-save UI, kept framework/fetch-free so both sides agree on what a
 * "valid saved round" is without duplicating logic, mirroring
 * `state/savedFlows.ts`'s split for the flows slice.
 *
 * A `Round` only ever references its flows indirectly via
 * `flowIds: number[]` (the local `Flow.id`s in `useFlowStore`'s `flows`
 * array), so this module — and the `saved_rounds` row it validates — keeps
 * that same indirection rather than embedding the flows themselves. Saving
 * a round to the account does not save its flows; a caller that wants both
 * saves each flow (via `saveFlowToAccount`) separately.
 *
 * @module state/savedRounds
 */

import type { Round } from "debate-core/src/types/flow";

/** Hard cap on a single round's JSON size — generous for even a round with many judges/spectators, well short of D1's row-size limits. */
export const MAX_SAVED_ROUND_BYTES = 200_000;

const ROUND_STATUSES = ["pending", "active", "completed"] as const;
const ROUND_WINNERS = ["aff", "neg"] as const;

function isPairOfStrings(value: unknown): value is [string, string] {
  return Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === "string");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === "number");
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `Round`. Checks required fields and, when
 * present, the shape of each optional field.
 */
export function isValidRound(value: unknown): value is Round {
  if (typeof value !== "object" || value === null) return false;
  const round = value as Record<string, unknown>;

  if (typeof round.id !== "number") return false;
  if (typeof round.tournamentName !== "string") return false;
  if (typeof round.roundLevel !== "string") return false;
  if (typeof round.debaters !== "object" || round.debaters === null) return false;
  const debaters = round.debaters as Record<string, unknown>;
  if (!isPairOfStrings(debaters.aff) || !isPairOfStrings(debaters.neg)) return false;
  if (!isStringArray(round.judges)) return false;
  if (!isNumberArray(round.flowIds)) return false;
  if (typeof round.timestamp !== "number") return false;
  if (!ROUND_STATUSES.includes(round.status as (typeof ROUND_STATUSES)[number])) return false;

  if (round.schools !== undefined) {
    if (typeof round.schools !== "object" || round.schools === null) return false;
    const schools = round.schools as Record<string, unknown>;
    if (!isPairOfStrings(schools.aff) || !isPairOfStrings(schools.neg)) return false;
  }
  if (round.spectators !== undefined && !isStringArray(round.spectators)) return false;
  if (round.isPrivate !== undefined && typeof round.isPrivate !== "boolean") return false;
  if (round.winner !== undefined && !ROUND_WINNERS.includes(round.winner as (typeof ROUND_WINNERS)[number])) {
    return false;
  }
  if (round.title !== undefined && typeof round.title !== "string") return false;
  if (round.slug !== undefined && typeof round.slug !== "string") return false;

  return true;
}

/**
 * Derives a short display label for a saved round, so `GET /api/rounds`'s
 * list view doesn't need to parse every row's full `data` blob just to
 * show something to the user. Prefers the round's own formatted `title`
 * (see `generateRoundTitle`) and falls back to tournament + round level.
 */
export function deriveRoundLabel(round: Pick<Round, "title" | "tournamentName" | "roundLevel">): string {
  const trimmedTitle = round.title?.trim();
  if (trimmedTitle) return trimmedTitle.slice(0, 120);
  return `${round.tournamentName} - ${round.roundLevel}`.slice(0, 120);
}

/** A saved round's list-view summary — everything `GET /api/rounds` returns without the full `data` blob. */
export type SavedRoundSummary = {
  clientId: number;
  label: string;
  updatedAt: string;
};
