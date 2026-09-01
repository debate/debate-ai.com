/**
 * @fileoverview Account-linked round-pairing sync — idea #12 ("Pre-Round
 * Intelligence Panel")'s "A manual pairing/room-assignment entry form as the
 * practical stand-in" follow-up in TODO.md. Pure validation helpers shared
 * by the `/api/round-pairings` D1-backed routes (`apps/debate-ai.com`) and
 * `hooks/useRoundPairings.ts`, mirroring `state/savedWordCountRounds.ts`'s
 * exact split — kept framework/fetch-free so both sides agree on what a
 * valid synced record is without duplicating logic.
 *
 * Like `WordCountRoundRecord`, a `RoundPairingRecord`'s payload is a
 * handful of short text fields, so `GET /api/round-pairings` returns every
 * record in full; there is no separate summary/label concept here.
 *
 * @module state/savedRoundPairings
 */

import type { RoundPairingRecord } from "./roundPairings";

/** Hard cap on a single pairing's JSON size — generous for every field maxed out, well short of D1's row-size limits. */
export const MAX_SAVED_ROUND_PAIRING_BYTES = 20_000;

function isDebateSide(value: unknown): value is "aff" | "neg" {
  return value === "aff" || value === "neg";
}

function isOptionalNonEmptyString(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.trim().length > 0);
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `RoundPairingRecord`.
 */
export function isValidRoundPairingRecord(value: unknown): value is RoundPairingRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.roundId !== "string" || record.roundId.trim().length === 0) return false;
  if (typeof record.tournamentName !== "string" || record.tournamentName.trim().length === 0) return false;
  if (typeof record.division !== "string" || record.division.trim().length === 0) return false;
  if (typeof record.roundLabel !== "string" || record.roundLabel.trim().length === 0) return false;
  if (!isDebateSide(record.side)) return false;
  if (!isOptionalNonEmptyString(record.room)) return false;
  if (!isOptionalNonEmptyString(record.opponentLabel)) return false;
  if (!isOptionalNonEmptyString(record.judgeLabel)) return false;
  if (record.updatedAt !== undefined && typeof record.updatedAt !== "number") return false;

  return true;
}
