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
import { findPresetWordLimit, type WordLimitPreset } from "./wordLimitPresets";

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
  /**
   * Stamped automatically by `saveWordCountRound` the first time a
   * `roundId` is saved, and preserved across later updates to that same
   * `roundId` — a debater's word-count trend view (`buildWordCountTrendData`
   * below) sorts on this. Optional so a record persisted before this field
   * existed still parses; such a record is excluded from the trend view
   * rather than sorted arbitrarily.
   */
  createdAt?: number;
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

/**
 * Saves a round's state, overwriting any existing record for that
 * `roundId`. Stamps `createdAt` with the current time on a round's first
 * save, and preserves that original timestamp across later updates (rather
 * than taking a caller-supplied `createdAt`, so every save site — the
 * standalone form and the live in-round meter alike — gets consistent
 * trend-view dates for free).
 */
export function saveWordCountRound(record: WordCountRoundRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  const createdAt = index === -1 ? Date.now() : (records[index].createdAt ?? Date.now());
  const stamped: WordCountRoundRecord = { ...record, createdAt };
  if (index === -1) {
    records.push(stamped);
  } else {
    records[index] = stamped;
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
 * after a round was recorded. `presets` (TODO.md idea #2's "per-style
 * word-limit preset manager" follow-up) overrides a matching speech's
 * authored limit, same priority order as `resolveSpeechWordLimit`.
 */
export function getWordCountRoundStatuses(
  roundId: string,
  presets: WordLimitPreset[] = [],
): { name: string; speaker: string; status: ReturnType<typeof getWordCountStatus> }[] {
  const record = getWordCountRound(roundId);
  if (!record) return [];
  const style = wordCountStyles[record.styleKey];
  return record.submittedSpeeches
    .map((submission) => {
      const speech = style.speeches.find((candidate) => candidate.name === submission.name);
      if (!speech) return undefined;
      const wordLimit = findPresetWordLimit(presets, submission.name) ?? speech.wordLimit;
      return {
        name: submission.name,
        speaker: submission.speaker,
        status: getWordCountStatus(submission.text, wordLimit),
      };
    })
    .filter((entry): entry is { name: string; speaker: string; status: ReturnType<typeof getWordCountStatus> } => entry !== undefined);
}

export type WordCountTrendPoint = {
  roundId: string;
  name: string;
  speaker: string;
  createdAt: number;
  count: number;
  wordLimit: number;
  overLimit: boolean;
};

/**
 * Flattens every persisted round's submitted speeches into a single
 * chronological list — the "(a) a trend view showing a debater's
 * word-count-vs-limit history across past submissions" follow-up named
 * under idea #2 ("Word-Count-Only Speech Format") in TODO.md's Product
 * Feature Ideas list. Each point recomputes its status the same way
 * `getWordCountRoundStatuses` does (so a stored round never goes stale if a
 * format's limits or a user's presets change later), plus the `wordLimit`
 * actually used and the round's `createdAt`.
 *
 * A record saved before `createdAt` existed is excluded rather than sorted
 * arbitrarily; a submission whose `name` no longer matches any speech in
 * its round's style is skipped, same as `getWordCountRoundStatuses`.
 */
export function buildWordCountTrendData(presets: WordLimitPreset[] = []): WordCountTrendPoint[] {
  return readAll()
    .filter((record): record is WordCountRoundRecord & { createdAt: number } => record.createdAt !== undefined)
    .flatMap((record) => {
      const style = wordCountStyles[record.styleKey];
      return record.submittedSpeeches
        .map((submission): WordCountTrendPoint | undefined => {
          const speech = style.speeches.find((candidate) => candidate.name === submission.name);
          if (!speech) return undefined;
          const wordLimit = findPresetWordLimit(presets, submission.name) ?? speech.wordLimit;
          const status = getWordCountStatus(submission.text, wordLimit);
          return {
            roundId: record.roundId,
            name: submission.name,
            speaker: submission.speaker,
            createdAt: record.createdAt,
            count: status.count,
            wordLimit,
            overLimit: status.overLimit,
          };
        })
        .filter((point): point is WordCountTrendPoint => point !== undefined);
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}
