/**
 * @fileoverview Account-linked word-count-round history sync — TODO.md idea
 * #2 ("Word-Count-Only Speech Format"), "account-sync round history itself
 * (today `wordCountRounds` is local-storage-only, unlike
 * `wordLimitPresets`), so the trend view follows a signed-in user across
 * devices instead of staying per-browser" follow-up. Pure validation
 * helpers shared by the `/api/word-count-rounds` D1-backed routes
 * (`apps/debate-ai.com`) and `hooks/useWordCountRounds.ts`, mirroring
 * `state/savedFlows.ts`/`state/savedRounds.ts`'s split — kept
 * framework/fetch-free so both sides agree on what a valid synced record is
 * without duplicating logic.
 *
 * Unlike `saved_flows`/`saved_rounds` (whose `GET` list route returns only
 * a derived label + timestamp, with a per-item route for the full blob), a
 * `WordCountRoundRecord`'s payload is small — a handful of short speech
 * texts, not a recursive `Box` tree or a full `Round` — so
 * `GET /api/word-count-rounds` returns every record in full; there is no
 * separate summary/label concept here.
 *
 * @module state/savedWordCountRounds
 */

import { wordCountStyles, type WordCountStyleKey } from "debate-timer/src/formats/word-count-format";
import type { WordCountRoundRecord, WordCountSpeechSubmission } from "./wordCountRounds";

/** Hard cap on a single round's JSON size — generous for even a round with every speech maxed out, well short of D1's row-size limits. */
export const MAX_SAVED_WORD_COUNT_ROUND_BYTES = 200_000;

function isValidSubmission(value: unknown): value is WordCountSpeechSubmission {
  if (typeof value !== "object" || value === null) return false;
  const submission = value as Record<string, unknown>;
  return (
    typeof submission.name === "string" &&
    typeof submission.speaker === "string" &&
    typeof submission.text === "string"
  );
}

function isValidStyleKey(value: unknown): value is WordCountStyleKey {
  return typeof value === "string" && value in wordCountStyles;
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `WordCountRoundRecord`. `styleKey` is checked
 * against `debate-timer`'s live `wordCountStyles` registry rather than a
 * hardcoded list, the same way `wordCountRounds.ts` itself resolves a
 * record's style. `createdAt`, when present, must be a number — a synced
 * record always carries its originating device's `createdAt` so the trend
 * view stays chronologically correct across devices (see
 * `adoptWordCountRound`). `updatedAt`, when present, must likewise be a
 * number — it drives `resolveWordCountRoundConflict`'s cross-device
 * same-`roundId` conflict resolution.
 */
export function isValidWordCountRoundRecord(value: unknown): value is WordCountRoundRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.roundId !== "string" || record.roundId.trim().length === 0) return false;
  if (!isValidStyleKey(record.styleKey)) return false;
  if (!Array.isArray(record.submittedSpeeches) || !record.submittedSpeeches.every(isValidSubmission)) return false;
  if (record.createdAt !== undefined && typeof record.createdAt !== "number") return false;
  if (record.updatedAt !== undefined && typeof record.updatedAt !== "number") return false;

  return true;
}
