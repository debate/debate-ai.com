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

/** The Word Count page's path. */
export const WORD_COUNT_PAGE_PATH = "/word-count";

/** Query param naming one word-count round (its `roundId`) to scroll to and outline on the Word Count page. */
export const WORD_COUNT_ROUND_LINK_PARAM = "round";

/**
 * Deep link to one word-count round: `/word-count?round=<roundId>`. The
 * account stores the `roundId` as `client_id`, so Settings → Saved to your
 * account can link a row straight to it.
 */
export function buildWordCountRoundOpenHref(roundId: string): string {
  return `${WORD_COUNT_PAGE_PATH}?${WORD_COUNT_ROUND_LINK_PARAM}=${encodeURIComponent(roundId)}`;
}

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

/** How many round ids a message names before it says "and N more". */
const MAX_NAMED_ROUND_IDS = 3;

function nameRounds(roundIds: readonly string[]): string {
  const named = roundIds.slice(0, MAX_NAMED_ROUND_IDS).map((id) => `"${id}"`);
  const rest = roundIds.length - named.length;
  if (rest > 0) return `${named.join(", ")} and ${rest} more`;
  if (named.length <= 1) return named.join("");
  return `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
}

/**
 * The prompt shown before one saved round is deleted. Signed in, it says the
 * account copy goes too, since that is the row other devices merge from.
 */
export function buildWordCountRoundDeleteConfirm(roundId: string, synced: boolean): string {
  return synced
    ? `Delete round "${roundId}"? It is removed from this browser and from your account.`
    : `Delete round "${roundId}" from this browser?`;
}

/** The prompt shown before "Delete all history" removes `count` saved rounds. */
export function buildWordCountClearAllConfirm(count: number, synced: boolean): string {
  const rounds = count === 1 ? "your 1 saved round" : `all ${count} saved rounds`;
  const them = count === 1 ? "It is" : "They are";
  return synced
    ? `Delete ${rounds}? ${them} removed from this browser and from your account.`
    : `Delete ${rounds} from this browser?`;
}

/**
 * The alert shown when rounds were deleted here but the account still has
 * them, so another device (or this one's next merge) would bring them back
 * until a retry succeeds. Empty for an empty list.
 */
export function buildWordCountDeleteFailureMessage(roundIds: readonly string[]): string {
  if (roundIds.length === 0) return "";
  const noun = roundIds.length === 1 ? "round" : "rounds";
  return `Couldn't remove ${noun} ${nameRounds(roundIds)} from your account. ${
    roundIds.length === 1 ? "It's" : "They're"
  } gone from this browser, but your other devices still have ${roundIds.length === 1 ? "it" : "them"}.`;
}
