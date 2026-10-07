/**
 * @fileoverview What the watch page's transcript AI buttons already produced
 * in this browser, so reopening a round shows it instead of paying again.
 *
 *   - **Detected speeches** — one segmentation per video
 *     (`lib/speech-segmentation.ts`), capped at {@link MAX_SEGMENTATIONS}.
 *   - **Speech summaries** — one outline per video and speech key
 *     (`lib/speech-summary.ts`), capped at {@link MAX_SPEECH_SUMMARIES}.
 *
 * Convenience caches like the Outcomes cache, not records the user owns:
 * oldest dropped first, and empty when storage is blocked. Running again
 * replaces the entry.
 * @module state/speechAiCache
 */

import { readLocalRecords, writeLocalRecords } from "./localRecordStore";
import type { SpeechSegmentation } from "../lib/speech-segmentation";

export const SPEECH_SEGMENTATION_CACHE_KEY = "debate-videos:speech-segmentations";
export const SPEECH_SUMMARY_CACHE_KEY = "debate-videos:speech-summaries";
export const MAX_SEGMENTATIONS = 200;
export const MAX_SPEECH_SUMMARIES = 400;

interface CachedSegmentation {
  videoId: string;
  segmentation: SpeechSegmentation;
  savedAt: number;
}

interface CachedSummary {
  videoId: string;
  speechKey: string;
  outline: string;
  savedAt: number;
}

function isSegmentation(value: unknown): value is CachedSegmentation {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<CachedSegmentation>;
  return (
    typeof record.videoId === "string" &&
    typeof record.segmentation === "object" &&
    record.segmentation !== null &&
    typeof record.segmentation.format === "string" &&
    Array.isArray(record.segmentation.speeches)
  );
}

function isSummary(value: unknown): value is CachedSummary {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<CachedSummary>;
  return typeof record.videoId === "string" && typeof record.speechKey === "string" && typeof record.outline === "string";
}

export function readSpeechSegmentation(videoId: string): SpeechSegmentation | null {
  const found = readLocalRecords(SPEECH_SEGMENTATION_CACHE_KEY)
    .filter(isSegmentation)
    .find((record) => record.videoId === videoId);
  return found?.segmentation ?? null;
}

/** Saves (or, with `null`, forgets) a video's detected speeches. */
export function writeSpeechSegmentation(videoId: string, segmentation: SpeechSegmentation | null): void {
  const rest = readLocalRecords(SPEECH_SEGMENTATION_CACHE_KEY)
    .filter(isSegmentation)
    .filter((record) => record.videoId !== videoId);
  const next = segmentation ? [{ videoId, segmentation, savedAt: Date.now() }, ...rest] : rest;
  writeLocalRecords(SPEECH_SEGMENTATION_CACHE_KEY, next.slice(0, MAX_SEGMENTATIONS));
}

/** Every saved outline for one video, by speech key. */
export function readSpeechSummaries(videoId: string): Record<string, string> {
  const outlines: Record<string, string> = {};
  for (const record of readLocalRecords(SPEECH_SUMMARY_CACHE_KEY).filter(isSummary)) {
    if (record.videoId === videoId && !(record.speechKey in outlines)) outlines[record.speechKey] = record.outline;
  }
  return outlines;
}

export function writeSpeechSummary(videoId: string, speechKey: string, outline: string): void {
  const rest = readLocalRecords(SPEECH_SUMMARY_CACHE_KEY)
    .filter(isSummary)
    .filter((record) => !(record.videoId === videoId && record.speechKey === speechKey));
  writeLocalRecords(
    SPEECH_SUMMARY_CACHE_KEY,
    [{ videoId, speechKey, outline, savedAt: Date.now() }, ...rest].slice(0, MAX_SPEECH_SUMMARIES),
  );
}
