/**
 * @fileoverview Persistent storage for `ai-versus-speech-order.ts`'s
 * submitted-speech state, keyed by `roundId` — the "(c) persisting an
 * online-versus-AI round's submitted speeches" follow-up named in idea #3
 * ("Online Debate Versus AI") in TODO.md's Product Feature Ideas list.
 * Stores each round's format, chosen side, and delivered speeches in
 * localStorage, mirroring the existing
 * `preRoundBriefings.ts`/`coachingPrograms.ts` persistence convention.
 * `submittedSpeeches.length` doubles as the `submittedCount` that
 * `getNextSpeechSlot`/`isUsersTurn`/`validateSpeechSubmission`/
 * `buildAiResponseRequest` expect, so no separate counter field is stored.
 *
 * `buildAiVersusRoundsPanelView` sorts the stored list by `roundId` for a
 * stable panel display order, mirroring the same helper on
 * `wordCountRounds.ts`/`coachingSessions.ts`. `getAiVersusRoundStatus`
 * derives a round's turn order and next-slot status on read rather than
 * storing it, mirroring `wordCountRounds.ts`'s `getWordCountRoundStatuses`.
 *
 * `canRegenerateAiSpeechAt`/`replaceAiSpeechAt` close the "regenerate
 * affordance" follow-up noted in `docs/features/ai-versus-rounds.md`'s
 * Known gaps: replacing any already-submitted AI speech in place (keeping
 * its slot name, every earlier speech, and every later speech untouched)
 * rather than clearing the whole round and starting over, or only ever
 * being able to redo the single most recent speech. Neither calls the AI
 * itself — the panel rebuilds the same `buildAiResponseRequest` used to
 * generate the original speech (from the speeches delivered before that
 * index) and calls the existing
 * `requestAiVersusSpeech`/`requestAiVersusSpeechWithPersona` client, then
 * saves the returned text through `replaceAiSpeechAt`.
 *
 * @module state/aiVersusRounds
 */

import type { DebateStyleKey } from "debate-timer/src/formats/debate-format-times";
import {
  buildAiVersusSpeechOrder,
  getNextSpeechSlot,
  isUsersTurn,
  type AiVersusSide,
  type AiVersusSpeechSlot,
  type PriorSpeechRecord,
} from "../round/ai-versus-speech-order";

export type AiVersusRoundRecord = {
  roundId: string;
  styleKey: DebateStyleKey;
  userSide: AiVersusSide;
  submittedSpeeches: PriorSpeechRecord[];
};

const STORAGE_KEY = "aiVersusRounds";

function readAll(): AiVersusRoundRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiVersusRoundRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: AiVersusRoundRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted AI-versus round. */
export function listAiVersusRounds(): AiVersusRoundRecord[] {
  return readAll();
}

/** Looks up the persisted state for a round, if any. */
export function getAiVersusRound(roundId: string): AiVersusRoundRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's state, overwriting any existing record for that `roundId`. */
export function saveAiVersusRound(record: AiVersusRoundRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a round's persisted state; a no-op if it isn't stored. */
export function deleteAiVersusRound(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Whether the submitted speech at `index` exists and is the AI's, and so
 * can be regenerated in place — false for an out-of-range index or one
 * whose speech was the user's. Any already-submitted AI speech qualifies,
 * not just the most recently submitted one.
 */
export function canRegenerateAiSpeechAt(record: AiVersusRoundRecord, index: number): boolean {
  const speech = record.submittedSpeeches[index];
  return speech !== undefined && speech.speaker === "ai";
}

/**
 * Returns a copy of `record` with the submitted speech at `index` text
 * replaced by `text`, keeping that speech's `name`/`speaker` and every
 * other speech — earlier or later — untouched. Throws if there's no
 * speech at `index` or it isn't the AI's (check `canRegenerateAiSpeechAt`
 * first) — this only ever replaces an AI speech, never a user one. Does
 * not persist the result; call `saveAiVersusRound` with it.
 */
export function replaceAiSpeechAt(
  record: AiVersusRoundRecord,
  index: number,
  text: string,
): AiVersusRoundRecord {
  if (!canRegenerateAiSpeechAt(record, index)) {
    throw new Error("There's no AI speech at that position, so it can't be regenerated.");
  }
  const speeches = record.submittedSpeeches;
  const target = speeches[index]!;
  return {
    ...record,
    submittedSpeeches: [
      ...speeches.slice(0, index),
      { ...target, text },
      ...speeches.slice(index + 1),
    ],
  };
}

/** Every persisted AI-versus round, sorted by `roundId` for a stable panel display order. */
export function buildAiVersusRoundsPanelView(): AiVersusRoundRecord[] {
  return [...readAll()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}

export type AiVersusRoundStatus = {
  order: AiVersusSpeechSlot[];
  submittedCount: number;
  nextSlot: AiVersusSpeechSlot | null;
  isUsersTurn: boolean;
};

/**
 * Derives a persisted round's turn order and next-slot status by rebuilding
 * `buildAiVersusSpeechOrder` from its stored `styleKey`/`userSide`, rather
 * than storing the order itself — so a stored round never goes stale if a
 * format's speech list ever changes. Returns `undefined` when the round
 * isn't persisted.
 */
export function getAiVersusRoundStatus(roundId: string): AiVersusRoundStatus | undefined {
  const record = getAiVersusRound(roundId);
  if (!record) return undefined;

  const order = buildAiVersusSpeechOrder(record.styleKey, record.userSide);
  const submittedCount = record.submittedSpeeches.length;
  return {
    order,
    submittedCount,
    nextSlot: getNextSpeechSlot(order, submittedCount),
    isUsersTurn: isUsersTurn(order, submittedCount),
  };
}
