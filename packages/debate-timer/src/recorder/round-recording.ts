/**
 * @fileoverview A round's speeches as one recording: where each speech starts
 * in the joined MP3, the captions for the whole round, and the manifest that
 * is saved beside the MP3 (this browser, and R2 when uploaded).
 *
 * The start-time shape — speech key → seconds — is the same one the video
 * watch page keeps for a YouTube round (`@debate/videos`'
 * `state/speechStartMarks.ts`), so {@link SpeechStartsDialog} labels either
 * source. Pure functions only; the audio work is in `round-recording-audio.ts`.
 *
 * @module recorder/round-recording
 */

import type { SpokenSegment } from "./spoken-words-store"

/** A speech that can be given a start time: its stable key and what to call it. */
export interface SpeechStartItem {
  key: string
  label: string
}

/** Seconds into the media where each speech starts, by speech key. */
export type SpeechStarts = Record<string, number>

/** One speech's place in the joined recording. */
export interface JoinedSpeech extends SpeechStartItem {
  /** Where the speech's own audio begins (after any spoken announcement). */
  start: number
  /** Length of the speech's own audio, in seconds. */
  duration: number
  /** Length of the Kokoro announcement read before it, when one was added. */
  announcementSeconds?: number
}

/** One webcam clip spliced into the round: whose camera, which speech. */
export interface RoundVideoClip {
  /** Key of the clip in this browser's clip store (`video-clip-store.ts`). */
  id: string
  speechKey: string
  /** The debater (or judge) whose camera it is; "You" for this device's own. */
  participant: string
  /** R2 object key, once uploaded. */
  remoteKey?: string
}

/** Everything saved about a joined round recording. */
export interface RoundRecordingManifest {
  version: 1
  roundId: string
  createdAt: string
  durationSeconds: number
  speeches: JoinedSpeech[]
  /**
   * Starts the user adjusted in the speech-start modal; they win over each
   * speech's computed `start` (see {@link effectiveStarts}).
   */
  adjustedStarts?: SpeechStarts
  /** Which optional processing ran when the MP3 was built. */
  processing: { announcements: boolean; captions: boolean; moonshine: boolean }
  videos: RoundVideoClip[]
  /** R2 object keys, once uploaded. */
  remote?: { audio?: string; captions?: string; manifest?: string }
}

/** Silence between two speeches in the joined MP3, so they don't run together. */
export const SPEECH_GAP_SECONDS = 1

/**
 * Lays the speeches end to end, each after its announcement (if any) and a
 * short gap, and returns where each one starts.
 */
export function layoutJoinedSpeeches(
  parts: Array<SpeechStartItem & { duration: number; announcementSeconds?: number }>,
  gapSeconds = SPEECH_GAP_SECONDS,
): { speeches: JoinedSpeech[]; durationSeconds: number } {
  let at = 0
  const speeches = parts.map((part, index) => {
    if (index > 0) at += gapSeconds
    const lead = part.announcementSeconds ?? 0
    const speech: JoinedSpeech = {
      key: part.key,
      label: part.label,
      start: at + lead,
      duration: Math.max(0, part.duration),
      ...(part.announcementSeconds ? { announcementSeconds: part.announcementSeconds } : {}),
    }
    at = speech.start + speech.duration
    return speech
  })
  return { speeches, durationSeconds: at }
}

/** The start of every speech: the user's adjustment where there is one, else where it was joined. */
export function effectiveStarts(manifest: Pick<RoundRecordingManifest, "speeches" | "adjustedStarts">): SpeechStarts {
  const starts: SpeechStarts = {}
  for (const speech of manifest.speeches) starts[speech.key] = manifest.adjustedStarts?.[speech.key] ?? speech.start
  return starts
}

/**
 * The speech playing at `time`: the one with the latest start at or before
 * it, or null before the first start.
 */
export function speechAtTime(starts: SpeechStarts, time: number): string | null {
  let best: string | null = null
  let bestStart = -Infinity
  for (const [key, start] of Object.entries(starts)) {
    if (start <= time && start > bestStart) {
      best = key
      bestStart = start
    }
  }
  return best
}

/** `m:ss` (or `h:mm:ss`) for a number of seconds. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`
}

/** Reads `ss`, `m:ss` or `h:mm:ss` (fractions allowed) as seconds; null when it isn't a time. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(":")
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  return parts.reduce((total, part) => total * 60 + Number(part), 0)
}

/** One caption line of the joined recording. */
export interface CaptionCue {
  start: number
  end: number
  text: string
}

/**
 * Captions for the joined recording from what the browser heard while each
 * speech was recorded (`spoken-words-store.ts`), shifted to where the speech
 * sits in the joined MP3.
 */
export function shiftSpeechCaptions(
  bySpeech: Array<{ start: number; duration: number; segments: SpokenSegment[] }>,
): CaptionCue[] {
  return bySpeech.flatMap(({ start, duration, segments }) =>
    segments
      .filter((segment) => segment.text.trim() && segment.start < duration)
      .map((segment) => ({
        start: start + segment.start,
        end: start + Math.min(Math.max(segment.end, segment.start), duration),
        text: segment.text.trim(),
      })),
  )
}

function vttTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`
}

/** A WebVTT file for the cues, sorted by start; cues with no length get one second. */
export function toWebVtt(cues: CaptionCue[]): string {
  const lines = ["WEBVTT", ""]
  ;[...cues]
    .sort((a, b) => a.start - b.start)
    .forEach((cue, index) => {
      const end = cue.end > cue.start ? cue.end : cue.start + 1
      lines.push(String(index + 1), `${vttTime(cue.start)} --> ${vttTime(end)}`, cue.text.replace(/\n+/g, " "), "")
    })
  return lines.join("\n")
}

/** Spoken name of a speech for the Kokoro announcement ("1AC" → "1 A C"), so the voice spells codes out. */
export function announcementText(label: string): string {
  return label.replace(/\b([0-9]?[A-Z]{2,3})\b/g, (code) => code.split("").join(" "))
}

const MANIFEST_PREFIX = "debate-round-recording-"

/** localStorage key of a round's manifest. */
export function roundRecordingKey(roundId: string): string {
  return `${MANIFEST_PREFIX}${roundId}`
}

function isManifest(value: unknown): value is RoundRecordingManifest {
  const v = value as RoundRecordingManifest | null
  return !!v && v.version === 1 && typeof v.roundId === "string" && Array.isArray(v.speeches) && Array.isArray(v.videos)
}

export function loadRoundRecordingManifest(roundId: string): RoundRecordingManifest | null {
  try {
    const raw = localStorage.getItem(roundRecordingKey(roundId))
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return isManifest(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveRoundRecordingManifest(manifest: RoundRecordingManifest): void {
  try {
    localStorage.setItem(roundRecordingKey(manifest.roundId), JSON.stringify(manifest))
  } catch (e) {
    console.warn("Could not save the round recording manifest:", e)
  }
}

/**
 * Sets or clears one speech's adjusted start, keeping it inside the
 * recording. Returns the updated manifest (the input is not changed).
 */
export function adjustSpeechStart(
  manifest: RoundRecordingManifest,
  speechKey: string,
  seconds: number | null,
): RoundRecordingManifest {
  const adjusted = { ...(manifest.adjustedStarts ?? {}) }
  if (seconds === null || !Number.isFinite(seconds)) delete adjusted[speechKey]
  else adjusted[speechKey] = Math.min(Math.max(0, seconds), manifest.durationSeconds)
  return { ...manifest, adjustedStarts: adjusted }
}
