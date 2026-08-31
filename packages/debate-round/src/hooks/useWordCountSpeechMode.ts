/**
 * @fileoverview React binding for the live-round word-limited speech mode.
 *
 * Holds the current round's in-progress speech text (loaded from, and written
 * back to, `state/wordCountRounds.ts` via `round/word-count-speech-mode.ts`)
 * and the on/off toggle for the mode, so the speech header bar can swap its
 * countdown for a live word-count meter. All limit and status computation
 * lives in the pure module; this hook only owns React state and persistence
 * timing. Also mounts `useWordLimitPresets` so a signed-in user's custom
 * presets (TODO.md idea #2's "per-style word-limit preset manager"
 * follow-up, managed from `WordLimitPresetsPanel`) override the built-in
 * registry here too, the same way they do on the standalone `/word-count`
 * form.
 *
 * @module hooks/useWordCountSpeechMode
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createWordCountSpeechMode,
  getSpeechWordCountStatus,
  getWordCountSpeechText,
  loadWordCountSpeechMode,
  persistWordCountSpeechMode,
  setWordCountSpeechText,
  type SpeechWordCountStatus,
  type WordCountSpeechModeState,
} from "../round/word-count-speech-mode";
import { useWordLimitPresets } from "./useWordLimitPresets";

const TOGGLE_STORAGE_KEY = "wordLimitModeEnabled";

function readToggle(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(TOGGLE_STORAGE_KEY) === "true";
}

export type WordCountSpeechModeBinding = {
  /** Whether word-limit mode is currently on. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** Text typed so far for the given speech. */
  text: string;
  /** Replaces the speech's text and persists the round. */
  setText: (text: string) => void;
  /** Live limit status, or `undefined` when the speech has no resolvable limit. */
  status: SpeechWordCountStatus | undefined;
};

/**
 * Binds one live speech to word-limit mode.
 *
 * @param roundId - Round the typed speeches belong to; a missing id keeps the
 *   mode off, since there would be nowhere to persist the text.
 * @param speechName - Speech/column name currently shown, e.g. `"AC"`.
 * @param timedSpeechMinutes - Length of the equivalent timed speech, used to
 *   estimate a limit for speeches the word-count style does not name.
 */
export function useWordCountSpeechMode(
  roundId: string | number | undefined,
  speechName: string,
  timedSpeechMinutes?: number,
): WordCountSpeechModeBinding {
  const resolvedRoundId = roundId === undefined ? "" : String(roundId);
  const { presets } = useWordLimitPresets();
  const [enabled, setEnabledState] = useState(false);
  const [mode, setMode] = useState<WordCountSpeechModeState>(() =>
    createWordCountSpeechMode(resolvedRoundId),
  );

  useEffect(() => {
    setEnabledState(readToggle());
  }, []);

  useEffect(() => {
    setMode(
      resolvedRoundId
        ? loadWordCountSpeechMode(resolvedRoundId)
        : createWordCountSpeechMode(""),
    );
  }, [resolvedRoundId]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TOGGLE_STORAGE_KEY, String(next));
    }
  }, []);

  const setText = useCallback(
    (text: string) => {
      setMode((previous) => {
        const next = setWordCountSpeechText(previous, speechName, text);
        if (next.roundId) persistWordCountSpeechMode(next);
        return next;
      });
    },
    [speechName],
  );

  return {
    enabled: enabled && Boolean(resolvedRoundId),
    setEnabled,
    text: getWordCountSpeechText(mode, speechName),
    setText,
    status: getSpeechWordCountStatus(mode, { speechName, timedSpeechMinutes, presets }),
  };
}
