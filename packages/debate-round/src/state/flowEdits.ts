/**
 * @fileoverview Persistent storage for `shared-flow-sync.ts`'s `FlowEdit`
 * records — closes the data-source gap left in idea #16 ("Shared,
 * Ai-Generated Debate Flow") in TODO.md: `SharedFlowSyncPanel` merges and
 * flags conflicts in whatever `FlowEdit[]` it's handed, but until now
 * nothing actually recorded one, so every caller passed an empty array and
 * the panel only ever rendered its own-edits empty state. This gives a
 * contributor a way to log a proposed edit to a box (their own, or one
 * they're relaying from a teammate) and persists it to localStorage,
 * mirroring the existing `flowAnnotations.ts`/`prepNotes.ts` persistence
 * convention, so `mergeFlowEdits` finally has real edits to reconcile.
 *
 * There is still no live transport (e.g. WebSocket) pushing a teammate's
 * edits here automatically — see the follow-ups noted under idea #16 in
 * TODO.md.
 *
 * @module state/flowEdits
 */

import type { FlowEdit } from "../flow/shared-flow-sync";

const STORAGE_KEY = "flowEdits";

function readAll(): FlowEdit[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FlowEdit[]) : [];
  } catch {
    return [];
  }
}

function writeAll(edits: FlowEdit[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
}

/** Lists every persisted edit, across all flows, oldest first. */
export function listFlowEdits(): FlowEdit[] {
  return [...readAll()].sort((a, b) => a.timestampMs - b.timestampMs);
}

/** Lists every persisted edit for one flow, oldest first. */
export function listFlowEditsForFlow(flowId: number): FlowEdit[] {
  return listFlowEdits().filter((edit) => edit.flowId === flowId);
}

/**
 * Lists a single box's persisted edits within one flow, oldest first —
 * feeds the `FlowSpreadsheet` cell affordance (`EditBadge`/
 * `EditReviewPopover`) that surfaces a box's pending edits without leaving
 * the live grid for the separate `FlowEditLogPanel` form.
 */
export function listFlowEditsForBox(flowId: number, boxPath: number[]): FlowEdit[] {
  return listFlowEditsForFlow(flowId).filter(
    (edit) =>
      edit.boxPath.length === boxPath.length && edit.boxPath.every((value, i) => value === boxPath[i]),
  );
}

/** Saves an edit, overwriting any existing record with the same id. */
export function saveFlowEdit(edit: FlowEdit): void {
  const edits = readAll();
  const index = edits.findIndex((existing) => existing.id === edit.id);
  if (index === -1) {
    edits.push(edit);
  } else {
    edits[index] = edit;
  }
  writeAll(edits);
}

/** Deletes a persisted edit by id; a no-op if it isn't stored. */
export function deleteFlowEdit(id: string): void {
  writeAll(readAll().filter((edit) => edit.id !== id));
}

/**
 * Deletes every persisted edit for one flow — used once a merge has been
 * applied (see `SharedFlowSyncPanel`'s `onApply`), so an already-applied
 * edit doesn't linger and get re-offered for merging next time.
 */
export function clearFlowEditsForFlow(flowId: number): void {
  writeAll(readAll().filter((edit) => edit.flowId !== flowId));
}
