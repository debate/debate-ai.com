/**
 * @fileoverview Pure helpers for surfacing `FlowEdit`s on their
 * `FlowSpreadsheet` cell — the remaining half of follow-up (b) under idea
 * #16 ("Shared, Ai-Generated Debate Flow") in TODO.md: "a `FlowSpreadsheet`
 * grid affordance for logging or reviewing an edit."
 *
 * Box-path derivation (`boxPathForCell`/`columnIndexFromField`) is generic
 * to any per-cell, box-addressed feature, not specific to annotations, so
 * this reuses `annotation-cells.ts`'s helpers directly rather than
 * duplicating them.
 */

import type { FlowEdit } from "./shared-flow-sync";

/**
 * Orders a box's edits newest first — the order a reviewer opening the
 * popover would want to see them in, most-recent proposal on top.
 */
export function sortEditsNewestFirst(edits: FlowEdit[]): FlowEdit[] {
  return [...edits].sort((a, b) => b.timestampMs - a.timestampMs);
}
