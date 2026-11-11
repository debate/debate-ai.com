/**
 * @fileoverview Account-linked word-count-round sync. Pure validation
 * helpers shared by the `/api/word-count-rounds` D1-backed routes
 * (`apps/debate-web`) and `hooks/useWordCountRounds.ts`, kept
 * framework/fetch-free so both sides agree on what a valid synced record is
 * without duplicating logic. `state/savedDrillSets.ts` and
 * `state/savedJudgeDecisions.ts` follow the same split.
 *
 * A `WordCountRoundRecord`'s payload is small (a style key plus a handful of
 * speech texts), so `GET /api/word-count-rounds` returns every record in
 * full, one `saved_word_count_rounds` row per (user, `roundId`).
 *
 * @module state/savedWordCountRounds
 */

import { wordCountStyles } from "@debate-ai/timer/src/formats/word-count-format";
import type { WordCountRoundRecord } from "@debate-ai/round/src/state/wordCountRounds";

/** Hard cap on a single round's JSON size: room for long speeches, well short of D1's row-size limits. */
export const MAX_SAVED_WORD_COUNT_ROUND_BYTES = 200_000;

/** Longest `roundId` accepted. It is typed freely into the form, so it gets a cap like any other user text. */
export const MAX_WORD_COUNT_ROUND_ID_LENGTH = 200;

function isValidSubmission(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const speech = value as Record<string, unknown>;
  return typeof speech.name === "string" && typeof speech.speaker === "string" && typeof speech.text === "string";
}

function isOptionalTimestamp(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

/**
 * Structural validator for an untrusted value (e.g. parsed request-body
 * JSON) claiming to be a `WordCountRoundRecord`. The style key must be one
 * `debate-timer` still knows, so a synced record can always be rendered.
 */
export function isValidWordCountRoundRecord(value: unknown): value is WordCountRoundRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.roundId !== "string") return false;
  const roundId = record.roundId.trim();
  if (roundId.length === 0 || record.roundId.length > MAX_WORD_COUNT_ROUND_ID_LENGTH) return false;
  if (typeof record.styleKey !== "string" || !Object.prototype.hasOwnProperty.call(wordCountStyles, record.styleKey)) return false;
  if (!Array.isArray(record.submittedSpeeches) || !record.submittedSpeeches.every(isValidSubmission)) return false;
  if (!isOptionalTimestamp(record.createdAt) || !isOptionalTimestamp(record.updatedAt)) return false;

  return true;
}
