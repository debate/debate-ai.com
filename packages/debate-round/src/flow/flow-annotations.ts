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

  return {
    id: input.id,
    flowId: input.flowId,
    boxPath: input.boxPath,
    speechId: input.speechId,
    timestampMs: input.timestampMs,
    createdAt: input.createdAt,
    ...(note ? { note: note.slice(0, MAX_NOTE_LENGTH) } : {}),
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
