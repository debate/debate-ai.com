/**
 * @fileoverview Where each speech of a round starts, as the reader marked it
 * while watching.
 *
 * Most rounds have no document that times their speeches, so the watch page
 * lets the reader press "Mark start" on a speech at the moment it begins.
 * That is what turns the even row of speech buttons under the player into a
 * proportional timeline, lets the tabs follow playback, and cuts the captions
 * into per-speech transcripts for the Outcomes simulator.
 *
 * Kept in this browser only, like the outcome cache: one record per video and
 * speech key, capped at {@link MAX_SPEECH_START_MARKS} with the oldest
 * dropped first.
 * @module state/speechStartMarks
 */

import { readLocalRecords, writeLocalRecords } from "./localRecordStore";

export const SPEECH_START_MARKS_KEY = "debate-videos:speech-starts";
export const MAX_SPEECH_START_MARKS = 2000;

interface SpeechStartMark {
  videoId: string;
  speechKey: string;
  seconds: number;
}

function isMark(value: unknown): value is SpeechStartMark {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<SpeechStartMark>;
  return (
    typeof record.videoId === "string" &&
    typeof record.speechKey === "string" &&
    typeof record.seconds === "number" &&
    Number.isFinite(record.seconds) &&
    record.seconds >= 0
  );
}

function readAll(): SpeechStartMark[] {
  return readLocalRecords(SPEECH_START_MARKS_KEY).filter(isMark);
}

/** Seconds per speech key for one video. */
export function readSpeechStarts(videoId: string): Record<string, number> {
  const marks: Record<string, number> = {};
  for (const mark of readAll()) if (mark.videoId === videoId) marks[mark.speechKey] = mark.seconds;
  return marks;
}

/**
 * Sets or clears one speech's start.
 *
 * @param seconds - The start, or `null` to clear the mark.
 */
export function writeSpeechStart(videoId: string, speechKey: string, seconds: number | null): void {
  const rest = readAll().filter((mark) => !(mark.videoId === videoId && mark.speechKey === speechKey));
  const next =
    seconds === null ? rest : [{ videoId, speechKey, seconds: Math.max(0, Math.floor(seconds)) }, ...rest];
  writeLocalRecords(SPEECH_START_MARKS_KEY, next.slice(0, MAX_SPEECH_START_MARKS));
}
