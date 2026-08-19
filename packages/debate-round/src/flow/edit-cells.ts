/**
 * @fileoverview Pure helpers for surfacing `FlowEdit`s on their
 * `FlowSpreadsheet` cell — the remaining half of follow-up (b) ("a
 * `FlowSpreadsheet`-grid affordance for logging/reviewing an edit") under
 * idea #16 ("Shared, Ai-Generated Debate Flow") in TODO.md. Mirrors
 * `annotation-cells.ts`'s box-path derivation, reused directly here since a
 * cell's box path is addressed identically for both annotations and edits.
 */

import type { FlowEdit } from "./shared-flow-sync";

export { boxPathForCell, columnIndexFromField } from "./annotation-cells";

function samePath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Filters `edits` down to the ones addressed to exactly `boxPath`. */
export function filterEditsForBox(edits: FlowEdit[], boxPath: number[]): FlowEdit[] {
  return edits.filter((edit) => samePath(edit.boxPath, boxPath));
}

/**
 * Sorts edits newest-first, matching `FlowEditLogPanel`'s "logged edits"
 * ordering, so a cell's badge tooltip and the review popover both read
 * most-recent-first.
 */
export function sortEditsByTimestampDesc(edits: FlowEdit[]): FlowEdit[] {
  return [...edits].sort((a, b) => b.timestampMs - a.timestampMs);
}
