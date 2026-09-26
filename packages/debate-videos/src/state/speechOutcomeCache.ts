/**
 * @fileoverview Simulations already run on this browser, so reopening a
 * speech's "Outcomes" view shows the last run instead of paying for another.
 *
 * A convenience cache, not a record the user owns: capped at
 * {@link MAX_CACHED_RUNS} (oldest dropped first), and reads as empty when
 * storage is blocked. One run per video, speech and judge panel — running
 * again replaces it. The panel is stored as its `panelKey`, which for a lone
 * judge is the bare judge id runs were saved under before panels existed, so
 * those still open.
 *
 * `id` closes the "Saved outcome runs stay in the browser that made them"
 * Known gap recorded in
 * `packages/debate-help-docs/content/docs/internals/video-watch-page.mdx`:
 * every other synced store keys its records by one stable string field, and
 * this one didn't have one — it was keyed only by the `(videoId, speechKey,
 * lens)` triple. `writeCachedSpeechOutcome` now stamps that triple into a
 * single `id` field before caching, and `speechOutcomeRuns` is registered in
 * `debate-data-sync`'s `TOOL_RECORD_COLLECTIONS`, so a signed-in user's
 * cached runs follow them to another device instead of starting over —
 * mirroring `coachingSessions`' own composite-key fix. A run cached before
 * this field existed has none and is simply never matched by id: it stays
 * valid and locally readable, just un-synced, until it's run again.
 * @module state/speechOutcomeCache
 */

import { readLocalRecords, writeLocalRecords } from "./localRecordStore";
import type { SpeechOutcomeSimulation } from "../lib/speech-outcomes";

export const SPEECH_OUTCOME_CACHE_KEY = "debate-videos:speech-outcomes";
export const MAX_CACHED_RUNS = 40;

export interface CachedSpeechOutcome {
  /**
   * Stable id this record is keyed by — `${videoId}::${speechKey}::${lens}` —
   * what lets it join `debate-data-sync`'s account-sync allowlist (see
   * `state/toolRecordCollections.ts`'s `speechOutcomeRuns` entry).
   * `writeCachedSpeechOutcome` always derives and stamps this rather than
   * trusting a caller-supplied value.
   */
  id: string;
  videoId: string;
  speechKey: string;
  /** The panel's `panelKey` — `flow`, or `flow+lay+theory`. */
  lens: string;
  simulation: SpeechOutcomeSimulation;
  /** Epoch milliseconds. */
  savedAt: number;
}

/** The stable id a video+speech+lens triple's cached run is always stamped with. */
export function speechOutcomeCacheId(videoId: string, speechKey: string, lens: string): string {
  return `${videoId}::${speechKey}::${lens}`;
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
  lens: string,
): CachedSpeechOutcome | null {
  return (
    readAll().find((run) => run.videoId === videoId && run.speechKey === speechKey && run.lens === lens) ?? null
  );
}

export function writeCachedSpeechOutcome(run: Omit<CachedSpeechOutcome, "id">): void {
  const id = speechOutcomeCacheId(run.videoId, run.speechKey, run.lens);
  const rest = readAll().filter((other) => other.id !== id);
  writeLocalRecords(SPEECH_OUTCOME_CACHE_KEY, [{ ...run, id }, ...rest].slice(0, MAX_CACHED_RUNS));
}

/** The speech keys of one video that have a run under any panel — marks them on the tab strip. */
export function cachedSpeechKeys(videoId: string): Set<string> {
  return new Set(readAll().filter((run) => run.videoId === videoId).map((run) => run.speechKey));
}
