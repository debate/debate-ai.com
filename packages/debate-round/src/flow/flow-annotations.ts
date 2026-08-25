/**
 * @fileoverview Timestamped flow annotations — pure data model + query
 * helpers for idea #15 in TODO.md ("Flow-in-Speech Flow Annotations").
 * While watching a streamed or recorded speech, a viewer can drop an
 * annotation at a playback timestamp and attach it to a specific flow `Box`
 * (addressed the same way `boxFromPath` already addresses boxes), so the
 * round can later be scrubbed straight back to where an answer was made.
 * This is the first slice only — it is not wired into the video player or
 * `FlowSpreadsheet` UI; see the follow-ups noted in TODO.md.
 */

import type { Box } from "debate-core/src/types/flow";
import { boxFromPath } from "../utils/flow-utils";

export type FlowAnnotation = {
  id: string;
  flowId: number;
  /** Path from the flow's root children down to the annotated box (see `boxFromPath`). */
  boxPath: number[];
  /** Which speech in the round this annotation was made during, e.g. "1AC". */
  speechId: string;
  /** Playback position within the speech recording, in milliseconds. */
  timestampMs: number;
  note?: string;
  createdAt: number;
  /** Id of the recording (e.g. a `debate-videos` YouTube video id) this annotation was dropped against, if any. */
  videoId?: string;
  /** The recording's display title, if known at the time the annotation was created. */
  videoTitle?: string;
};

const MAX_NOTE_LENGTH = 500;

export type CreateFlowAnnotationInput = {
  id: string;
  flowId: number;
  boxPath: number[];
  speechId: string;
  timestampMs: number;
  createdAt: number;
  note?: string;
  videoId?: string;
  videoTitle?: string;
};

/**
 * Builds a `FlowAnnotation`, validating that it actually addresses a box
 * (non-empty `boxPath`), belongs to a real speech, and has a non-negative
 * playback position. `note` is trimmed and clamped to `MAX_NOTE_LENGTH`,
 * and omitted entirely if it's empty after trimming.
 */
export function createFlowAnnotation(input: CreateFlowAnnotationInput): FlowAnnotation {
  if (input.boxPath.length === 0) {
    throw new Error("createFlowAnnotation: boxPath must address a box");
  }
  if (!input.speechId.trim()) {
    throw new Error("createFlowAnnotation: speechId is required");
  }
  if (input.timestampMs < 0) {
    throw new Error("createFlowAnnotation: timestampMs must be >= 0");
  }

  const note = input.note?.trim();
  const videoId = input.videoId?.trim();
  const videoTitle = input.videoTitle?.trim();

  return {
    id: input.id,
    flowId: input.flowId,
    boxPath: input.boxPath,
    speechId: input.speechId,
    timestampMs: input.timestampMs,
    createdAt: input.createdAt,
    ...(note ? { note: note.slice(0, MAX_NOTE_LENGTH) } : {}),
    ...(videoId ? { videoId } : {}),
    ...(videoTitle ? { videoTitle } : {}),
  };
}

/** Ascending by `timestampMs`, without mutating the input array. */
export function sortAnnotationsByTimestamp(annotations: FlowAnnotation[]): FlowAnnotation[] {
  return [...annotations].sort((a, b) => a.timestampMs - b.timestampMs);
}

/** All annotations made during a given speech, in playback order. */
export function getAnnotationsForSpeech(
  annotations: FlowAnnotation[],
  speechId: string,
): FlowAnnotation[] {
  return sortAnnotationsByTimestamp(annotations.filter((a) => a.speechId === speechId));
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** All annotations attached to one specific box on one specific flow, in playback order. */
export function getAnnotationsForBox(
  annotations: FlowAnnotation[],
  flowId: number,
  boxPath: number[],
): FlowAnnotation[] {
  return sortAnnotationsByTimestamp(
    annotations.filter((a) => a.flowId === flowId && pathsEqual(a.boxPath, boxPath)),
  );
}

/**
 * Finds the most recent annotation at-or-before `atMs` within a speech, for
 * a "what was flowed here" lookup as playback is scrubbed. Returns `null`
 * if `atMs` is before every annotation in the speech (or there are none).
 */
export function findAnnotationAtPlaybackPosition(
  annotations: FlowAnnotation[],
  speechId: string,
  atMs: number,
): FlowAnnotation | null {
  let match: FlowAnnotation | null = null;
  for (const annotation of getAnnotationsForSpeech(annotations, speechId)) {
    if (annotation.timestampMs > atMs) break;
    match = annotation;
  }
  return match;
}

/**
 * Resolves the flow `Box` an annotation points to, for rendering a
 * "jump to argument" link. Returns `null` if the path no longer resolves to
 * a box (e.g. the flow was edited/rows removed after the annotation was made).
 */
export function resolveAnnotationBox(
  flow: { children: Box[] },
  annotation: FlowAnnotation,
): Box | null {
  const resolved = boxFromPath(flow, annotation.boxPath);
  return resolved !== null && "content" in resolved ? (resolved as Box) : null;
}

export type JumpToAnnotationDeps = {
  /** The recording currently loaded in the player, if any. */
  activeVideoId: string | null;
  /** `debate-videos`'s `useVideoPlayerStore().setActiveVideo` — switches the player to a different recording. */
  setActiveVideo: (videoId: string, title: string, meta?: undefined, startTimeSeconds?: number) => void;
  /** `debate-videos`'s `sendYouTubeCommand("seekTo", ...)`, given a position in milliseconds. */
  seekTo: (timestampMs: number) => void;
  /** `debate-videos`'s `sendYouTubeCommand("playVideo")`. */
  playVideo: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
};

/**
 * Jumps the persistent video player to an annotation's timestamp, switching
 * to its recording first via `setActiveVideo` if it isn't already the one
 * loaded (rather than requiring it to already be open). Uses the
 * annotation's own `videoTitle` (captured at creation time, if the creator
 * knew it) as the switched-to title; falls back to the bare `videoId` when
 * no title was captured, matching the panel's own
 * `activeVideoTitle ?? activeVideoId` display fallback.
 *
 * Returns `false` (no-op) if the annotation has no `videoId` at all.
 */
export function jumpToAnnotation(annotation: FlowAnnotation, deps: JumpToAnnotationDeps): boolean {
  if (!annotation.videoId) return false;

  if (annotation.videoId === deps.activeVideoId) {
    deps.seekTo(annotation.timestampMs);
    deps.playVideo();
    deps.setIsPlaying(true);
    return true;
  }

  deps.setActiveVideo(
    annotation.videoId,
    annotation.videoTitle ?? annotation.videoId,
    undefined,
    annotation.timestampMs / 1000,
  );
  return true;
}

/** All annotations dropped against a given recording, in playback order. */
export function getAnnotationsForVideo(
  annotations: FlowAnnotation[],
  videoId: string,
): FlowAnnotation[] {
  return sortAnnotationsByTimestamp(annotations.filter((a) => a.videoId === videoId));
}

/**
 * Formats a playback position in milliseconds as `m:ss` (or `h:mm:ss` past
 * an hour), for a video-player annotation UI's timestamp badges.
 */
export function formatAnnotationTimestamp(timestampMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

/**
 * Parses a user-typed `m:ss` or `h:mm:ss` timestamp into milliseconds.
 * Returns `null` for anything that isn't a valid, non-negative timestamp.
 */
export function parseAnnotationTimestamp(input: string): number | null {
  const parts = input.trim().split(":");
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => part.trim() === "")) {
    return null;
  }
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((n) => !Number.isFinite(n) || n < 0 || !Number.isInteger(n))) {
    return null;
  }

  const [hours, minutes, seconds] =
    numbers.length === 3
      ? numbers
      : numbers.length === 2
        ? [0, numbers[0], numbers[1]]
        : [0, 0, numbers[0]];

  if (minutes > 59 || seconds > 59) return null;

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/**
 * Parses a user-typed, comma-separated box path (e.g. `"0, 1"`) into the
 * `number[]` `createFlowAnnotation` expects. Returns `null` for anything
 * that isn't a non-empty list of non-negative integers.
 */
export function parseBoxPathInput(input: string): number[] | null {
  const parts = input.split(",").map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => part === "")) return null;

  const path = parts.map((part) => Number(part));
  if (path.some((n) => !Number.isFinite(n) || n < 0 || !Number.isInteger(n))) return null;

  return path;
}
