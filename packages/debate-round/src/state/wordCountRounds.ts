/**
 * @fileoverview Persistent storage for word-count-mode round results, keyed
 * by `roundId` — the "(c) persisting word-count-mode round results alongside
 * timed rounds" follow-up named under idea #2 ("Word-Count-Only Speech
 * Format") in TODO.md's Product Feature Ideas list. Stores each round's
 * chosen `debate-timer` word-count style and submitted speech text in
 * localStorage, mirroring the existing
 * `aiVersusRounds.ts`/`practiceRounds.ts` persistence convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing). A speech's `WordCountStatus` is derived on read via
 * `getWordCountStatus` rather than stored, so a stored record never goes
 * stale if the format's word limits ever change.
 *
 * `buildWordCountRoundsPanelView` sorts the stored list by `roundId` for a
 * stable panel display order, mirroring the same helper on
 * `coachingSessions.ts`/`opponentPersonaSelections.ts`.
 *
 * @module state/wordCountRounds
 */

import { getWordCountStatus, wordCountStyles, type WordCountStyleKey } from "debate-timer/src/formats/word-count-format";

export type WordCountSpeechSubmission = {
  /** Matches a `WordCountSpeech.name` in the round's style, e.g. `"AC"`. */
  name: string;
  speaker: string;
  text: string;
};

export type WordCountRoundRecord = {
  roundId: string;
  styleKey: WordCountStyleKey;
  submittedSpeeches: WordCountSpeechSubmission[];
};

const STORAGE_KEY = "wordCountRounds";

function readAll(): WordCountRoundRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WordCountRoundRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: WordCountRoundRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted word-count round. */
export function listWordCountRounds(): WordCountRoundRecord[] {
  return readAll();
}

/** Looks up the persisted state for a round, if any. */
export function getWordCountRound(roundId: string): WordCountRoundRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's state, overwriting any existing record for that `roundId`. */
export function saveWordCountRound(record: WordCountRoundRecord): void {
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
export function deleteWordCountRound(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/** Every persisted word-count round, sorted by `roundId` for a stable panel display order. */
export function buildWordCountRoundsPanelView(): WordCountRoundRecord[] {
  return [...readAll()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}

/**
 * Computes each submitted speech's `WordCountStatus` against its round's
 * style, by matching each submission's `name` to the style's `WordCountSpeech`.
 * A submission whose `name` no longer matches any speech in the style is
 * skipped rather than throwing, since a format's speech list could change
 * after a round was recorded.
 */
export function getWordCountRoundStatuses(
  roundId: string,
): { name: string; speaker: string; status: ReturnType<typeof getWordCountStatus> }[] {
  const record = getWordCountRound(roundId);
  if (!record) return [];
  const style = wordCountStyles[record.styleKey];
  return record.submittedSpeeches
    .map((submission) => {
      const speech = style.speeches.find((candidate) => candidate.name === submission.name);
      if (!speech) return undefined;
      return {
        name: submission.name,
        speaker: submission.speaker,
        status: getWordCountStatus(submission.text, speech.wordLimit),
      };
    })
    .filter((entry): entry is { name: string; speaker: string; status: ReturnType<typeof getWordCountStatus> } => entry !== undefined);
}
