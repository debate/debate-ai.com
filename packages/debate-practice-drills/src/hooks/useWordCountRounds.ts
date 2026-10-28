"use client";

/**
 * @fileoverview Local word-count-round history. `WordCountRoundsPanel` reads
 * and writes `localStorage` (`state/wordCountRounds.ts`) through this hook.
 * Round history is not synced to the account — word counts are part of
 * regular speech, not a separate synced record.
 *
 * Subscribes to the browser's `storage` event via
 * `state/live-update.ts`'s `isWordCountRoundsLiveUpdateStorageEvent`,
 * mirroring `useCounselPanelAssessments`'s own `storage`-event subscription
 * — a round saved or cleared in another same-origin tab refreshes this one
 * too.
 *
 * @module hooks/useWordCountRounds
 */

import { useCallback, useEffect, useState } from "react";
import {
  buildWordCountRoundsPanelView,
  clearWordCountRounds,
  deleteWordCountRound,
  saveWordCountRound,
  type WordCountRoundRecord,
} from "@debate-ai/round/src/state/wordCountRounds";
import { isWordCountRoundsLiveUpdateStorageEvent } from "../state/live-update";

export type UseWordCountRoundsResult = {
  /** `null` until the initial local read completes. */
  rounds: WordCountRoundRecord[] | null;
  saveRound: (record: WordCountRoundRecord) => void;
  deleteRound: (roundId: string) => void;
  /** Clears every persisted round at once. */
  clearAllRounds: () => void;
};

/** Binds the current user's local word-count round history (`state/wordCountRounds.ts`). */
export function useWordCountRounds(): UseWordCountRoundsResult {
  const [rounds, setRounds] = useState<WordCountRoundRecord[] | null>(null);

  useEffect(() => {
    setRounds(buildWordCountRoundsPanelView());
  }, []);

  /** A `storage` event never fires in the tab that made the write, only in other tabs. */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isWordCountRoundsLiveUpdateStorageEvent(event)) return;
      setRounds(buildWordCountRoundsPanelView());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveRound = useCallback((record: WordCountRoundRecord) => {
    saveWordCountRound(record);
    setRounds(buildWordCountRoundsPanelView());
  }, []);

  const deleteRound = useCallback((roundId: string) => {
    deleteWordCountRound(roundId);
    setRounds(buildWordCountRoundsPanelView());
  }, []);

  const clearAllRounds = useCallback(() => {
    if (clearWordCountRounds().length === 0) return;
    setRounds(buildWordCountRoundsPanelView());
  }, []);

  return { rounds, saveRound, deleteRound, clearAllRounds };
}
