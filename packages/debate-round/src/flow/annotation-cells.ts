/**
 * @fileoverview Pure helpers for surfacing `FlowAnnotation`s on their
 * `FlowSpreadsheet` cell — the "(b) a flow-grid affordance (`FlowSpreadsheet`)
 * that surfaces annotations on their box via `listFlowAnnotationsForBox` and
 * links back to the timestamp" follow-up under idea #15 ("Flow-in-Speech Flow
 * Annotations") in TODO.md.
 *
 * `FlowSpreadsheet` flattens each row's box chain into `col_0..col_N` grid
 * fields (see `dataTransform.ts#buildRowData`), where column `j` is reached
 * from the row's root box (`flow.children[originalIndex]`) by walking
 * `children[0]` `j` times. `boxFromPath` (see `utils/flow-utils.ts`) expects
 * exactly that path, so a cell's box path is the row's `originalIndex`
 * followed by `j` zeros.
 */

import { sortAnnotationsByTimestamp } from "./flow-annotations";
import type { FlowAnnotation } from "./flow-annotations";

const COLUMN_FIELD_PATTERN = /^col_(\d+)$/;

/** The `boxPath` addressing the cell at grid row `rowOriginalIndex`, column index `columnIndex`. */
export function boxPathForCell(rowOriginalIndex: number, columnIndex: number): number[] {
  return [rowOriginalIndex, ...Array(Math.max(0, columnIndex)).fill(0)];
}

/** Extracts a grid column's 0-based index from its AG Grid field name (`"col_3"` -> `3`). Falls back to `0` for an unrecognized field. */
export function columnIndexFromField(field: string | undefined): number {
  const match = field ? COLUMN_FIELD_PATTERN.exec(field) : null;
  return match ? Number(match[1]) : 0;
}

/**
 * Picks which annotation a badge click should jump to when a cell carries
 * more than one: the earliest by playback timestamp, matching the reading
 * order a viewer scrubbing the recording would encounter them in. Returns
 * `null` for an empty list.
 */
export function pickJumpAnnotation(annotations: FlowAnnotation[]): FlowAnnotation | null {
  if (annotations.length === 0) return null;
  return sortAnnotationsByTimestamp(annotations)[0];
}
