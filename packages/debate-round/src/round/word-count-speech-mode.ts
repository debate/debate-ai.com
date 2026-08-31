/**
 * @fileoverview Live-round word-limited speech mode — the "(b) extending
 * `useTimerState`/`SpeechTimer` to support a non-timed, word-limited speech
 * mode in the live round timer itself" follow-up named under idea #2
 * ("Word-Count-Only Speech Format") in TODO.md's Product Feature Ideas list.
 *
 * Resolves the word limit for a speech that is being given right now in the
 * flow page and holds the in-progress text for it, so the speech header bar
 * can swap its countdown for a live word-count meter. A speech whose name
 * matches a user's own custom preset (`state/wordLimitPresets.ts`, TODO.md
 * idea #2's "per-style word-limit preset manager" follow-up) uses that
 * override first; otherwise a speech whose name matches a `wordCountStyles`
 * entry uses that entry's authored limit; otherwise the limit is estimated
 * from the live timed style's speech length via `estimateWordLimit`, so
 * word-limit mode works for every debate style, not just the authored
 * word-count ones.
 *
 * Persistence reuses the existing `state/wordCountRounds.ts` store rather than
 * introducing a second source of truth, so a round typed under the live meter
 * shows up on `/word-count` and vice versa.
 *
 * @module round/word-count-speech-mode
 */

import {
  estimateWordLimit,
  getWordCountStatus,
  wordCountStyleMap,
  wordCountStyles,
  type WordCountStatus,
  type WordCountStyleKey,
} from "debate-timer/src/formats/word-count-format";
import {
  getWordCountRound,
  saveWordCountRound,
  type WordCountRoundRecord,
} from "../state/wordCountRounds";
import { findPresetWordLimit, type WordLimitPreset } from "../state/wordLimitPresets";

/** Default word-count style used when a caller does not name one. */
export const DEFAULT_WORD_COUNT_STYLE_KEY: WordCountStyleKey = wordCountStyleMap[0];

export type SpeechWordLimitOptions = {
  /** The live speech's column name, e.g. `"AC"` or `"1AR"`. */
  speechName: string;
  /** Word-count style consulted for an authored limit. */
  styleKey?: WordCountStyleKey;
  /** Length of the equivalent timed speech, used when no authored limit matches. */
  timedSpeechMinutes?: number;
  /** Speaking pace used for the timed-speech estimate. */
  wordsPerMinute?: number;
  /** User-defined overrides, checked before the authored registry. */
  presets?: WordLimitPreset[];
};

/**
 * Resolves the word limit for a live speech: a user's own custom preset when
 * the speech name matches (case-insensitively), otherwise an authored
 * `wordCountStyles` limit when the speech name matches, otherwise an
 * estimate from the timed speech's length. Returns `undefined` when none of
 * those sources is available, so callers can leave the countdown in place
 * instead of showing a meaningless meter.
 */
export function resolveSpeechWordLimit({
  speechName,
  styleKey = DEFAULT_WORD_COUNT_STYLE_KEY,
  timedSpeechMinutes,
  wordsPerMinute,
  presets,
}: SpeechWordLimitOptions): number | undefined {
  const preset = presets ? findPresetWordLimit(presets, speechName) : undefined;
  if (preset !== undefined) return preset;
  const normalized = speechName.trim().toUpperCase();
  const authored = wordCountStyles[styleKey]?.speeches.find(
    (speech) => speech.name.toUpperCase() === normalized,
  );
  if (authored) return authored.wordLimit;
  if (timedSpeechMinutes !== undefined && timedSpeechMinutes > 0) {
    return estimateWordLimit(timedSpeechMinutes, wordsPerMinute);
  }
  return undefined;
}

export type WordCountSpeechModeState = {
  roundId: string;
  styleKey: WordCountStyleKey;
  /** In-progress speech text keyed by speech name. */
  drafts: Record<string, string>;
};

/** Creates empty word-limit mode state for a round. */
export function createWordCountSpeechMode(
  roundId: string,
  styleKey: WordCountStyleKey = DEFAULT_WORD_COUNT_STYLE_KEY,
): WordCountSpeechModeState {
  return { roundId, styleKey, drafts: {} };
}

/** Returns a copy of `state` with one speech's in-progress text replaced. */
export function setWordCountSpeechText(
  state: WordCountSpeechModeState,
  speechName: string,
  text: string,
): WordCountSpeechModeState {
  return { ...state, drafts: { ...state.drafts, [speechName]: text } };
}

/** The in-progress text for a speech, or `""` when nothing has been typed. */
export function getWordCountSpeechText(
  state: WordCountSpeechModeState,
  speechName: string,
): string {
  return state.drafts[speechName] ?? "";
}

export type SpeechWordCountStatus = WordCountStatus & { wordLimit: number };

/**
 * Live status for one speech under word-limit mode. Returns `undefined` when
 * no limit can be resolved for the speech.
 */
export function getSpeechWordCountStatus(
  state: WordCountSpeechModeState,
  options: Omit<SpeechWordLimitOptions, "styleKey">,
): SpeechWordCountStatus | undefined {
  const wordLimit = resolveSpeechWordLimit({ ...options, styleKey: state.styleKey });
  if (wordLimit === undefined) return undefined;
  return {
    wordLimit,
    ...getWordCountStatus(getWordCountSpeechText(state, options.speechName), wordLimit),
  };
}

/**
 * Loads a round's persisted word-count submissions into mode state. Falls back
 * to empty state for a round that has never been saved.
 */
export function loadWordCountSpeechMode(
  roundId: string,
  styleKey: WordCountStyleKey = DEFAULT_WORD_COUNT_STYLE_KEY,
): WordCountSpeechModeState {
  const record = getWordCountRound(roundId);
  if (!record) return createWordCountSpeechMode(roundId, styleKey);
  const drafts: Record<string, string> = {};
  for (const submission of record.submittedSpeeches ?? []) {
    drafts[submission.name] = submission.text;
  }
  return { roundId, styleKey: record.styleKey ?? styleKey, drafts };
}

/**
 * Persists mode state through the existing word-count round store. Speeches
 * with no typed text are dropped so an untouched speech never creates an empty
 * submission row on `/word-count`.
 */
export function persistWordCountSpeechMode(
  state: WordCountSpeechModeState,
  speakersBySpeech: Record<string, string> = {},
): WordCountRoundRecord {
  const record: WordCountRoundRecord = {
    roundId: state.roundId,
    styleKey: state.styleKey,
    submittedSpeeches: Object.entries(state.drafts)
      .filter(([, text]) => text.trim().length > 0)
      .map(([name, text]) => ({ name, speaker: speakersBySpeech[name] ?? "", text })),
  };
  saveWordCountRound(record);
  return record;
}
