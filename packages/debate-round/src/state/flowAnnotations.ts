/**
 * @fileoverview Persistent storage for `flow-annotations.ts`'s `FlowAnnotation`
 * records — the "(c) persisting annotations alongside a `Round`/`Flow`" follow-up
 * named in that slice for the "Flow-in-Speech Flow Annotations" idea (#15) in
 * TODO.md. Stores annotations in localStorage, mirroring the existing
 * `prepNotes.ts`/`coachingPrograms.ts` persistence convention.
 *
 * @module state/flowAnnotations
 */

import type { FlowAnnotation } from "../flow/flow-annotations";
import {
  getAnnotationsForBox,
  getAnnotationsForSpeech,
  getAnnotationsForVideo,
  sortAnnotationsByTimestamp,
} from "../flow/flow-annotations";

const STORAGE_KEY = "flowAnnotations";

function readAll(): FlowAnnotation[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FlowAnnotation[]) : [];
  } catch {
    return [];
  }
}

function writeAll(annotations: FlowAnnotation[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
}

/** Lists every persisted annotation, across all flows. */
export function listFlowAnnotations(): FlowAnnotation[] {
  return readAll();
}

/** Lists every persisted annotation for one flow, in playback order. */
export function listFlowAnnotationsForFlow(flowId: number): FlowAnnotation[] {
  return sortAnnotationsByTimestamp(readAll().filter((a) => a.flowId === flowId));
}

/** Lists every persisted annotation made during one speech, in playback order. */
export function listFlowAnnotationsForSpeech(speechId: string): FlowAnnotation[] {
  return getAnnotationsForSpeech(readAll(), speechId);
}

/** Lists every persisted annotation attached to one box on one flow, in playback order. */
export function listFlowAnnotationsForBox(flowId: number, boxPath: number[]): FlowAnnotation[] {
  return getAnnotationsForBox(readAll(), flowId, boxPath);
}

/** Lists every persisted annotation dropped against one recording, in playback order. */
export function listFlowAnnotationsForVideo(videoId: string): FlowAnnotation[] {
  return getAnnotationsForVideo(readAll(), videoId);
}

/**
 * Builds a stable, panel-ready view of every persisted annotation, newest
 * first by `createdAt` — the ordering the Flow Annotations panel renders.
 */
export function buildFlowAnnotationsPanelView(): FlowAnnotation[] {
  return [...readAll()].sort((a, b) => b.createdAt - a.createdAt);
}

/** Looks up a single persisted annotation by id, if any. */
export function getFlowAnnotation(id: string): FlowAnnotation | undefined {
  return readAll().find((annotation) => annotation.id === id);
}

/** Saves an annotation, overwriting any existing record with the same id. */
export function saveFlowAnnotation(annotation: FlowAnnotation): void {
  const annotations = readAll();
  const index = annotations.findIndex((existing) => existing.id === annotation.id);
  if (index === -1) {
    annotations.push(annotation);
  } else {
    annotations[index] = annotation;
  }
  writeAll(annotations);
}

/** Deletes a persisted annotation by id; a no-op if it isn't stored. */
export function deleteFlowAnnotation(id: string): void {
  writeAll(readAll().filter((annotation) => annotation.id !== id));
}
