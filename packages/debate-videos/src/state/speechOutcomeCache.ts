/**
 * @fileoverview Simulations already run on this browser, so reopening a
 * speech's "Outcomes" view shows the last run instead of paying for another.
 *
 * A convenience cache, not a record the user owns: it is not synced to the
 * account, is capped at {@link MAX_CACHED_RUNS} (oldest dropped first), and
 * reads as empty when storage is blocked. One run per video, speech and
 * judge lens — running again replaces it.
 * @module state/speechOutcomeCache
 */

import { readLocalRecords, writeLocalRecords } from "./localRecordStore";
import type { JudgeLens, SpeechOutcomeSimulation } from "../lib/speech-outcomes";

export const SPEECH_OUTCOME_CACHE_KEY = "debate-videos:speech-outcomes";
export const MAX_CACHED_RUNS = 40;

export interface CachedSpeechOutcome {
  videoId: string;
  speechKey: string;
  lens: JudgeLens;
  simulation: SpeechOutcomeSimulation;
  /** Epoch milliseconds. */
  savedAt: number;
}

function isCachedRun(value: unknown): value is CachedSpeechOutcome {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<CachedSpeechOutcome>;
  return (
    typeof record.videoId === "string" &&
    typeof record.speechKey === "string" &&
    typeof record.lens === "string" &&
    typeof record.savedAt === "number" &&
    typeof record.simulation === "object" &&
    record.simulation !== null &&
    Array.isArray(record.simulation.alternatives)
  );
}

function readAll(): CachedSpeechOutcome[] {
  return readLocalRecords(SPEECH_OUTCOME_CACHE_KEY).filter(isCachedRun);
}

export function readCachedSpeechOutcome(
  videoId: string,
  speechKey: string,
  lens: JudgeLens,
): CachedSpeechOutcome | null {
  return (
    readAll().find((run) => run.videoId === videoId && run.speechKey === speechKey && run.lens === lens) ?? null
  );
}

export function writeCachedSpeechOutcome(run: CachedSpeechOutcome): void {
  const rest = readAll().filter(
    (other) => !(other.videoId === run.videoId && other.speechKey === run.speechKey && other.lens === run.lens),
  );
  writeLocalRecords(SPEECH_OUTCOME_CACHE_KEY, [run, ...rest].slice(0, MAX_CACHED_RUNS));
}

/** The speech keys of one video that have a run under any lens — marks them on the tab strip. */
export function cachedSpeechKeys(videoId: string): Set<string> {
  return new Set(readAll().filter((run) => run.videoId === videoId).map((run) => run.speechKey));
}
