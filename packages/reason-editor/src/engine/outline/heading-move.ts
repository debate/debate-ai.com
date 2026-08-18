/**
 * Move-heading-section command — the "move headings" half of follow-up
 * (a) under idea #14 ("Legacy Verbatim / Cardmirror Compatibility") in
 * TODO.md's Product Feature Ideas list: "wiring these commands into
 * actual keyboard-shortcut handlers in reason-editor's toolbar/editor
 * view".
 *
 * Reuses `debate-card-parser`'s `moveOutlineNode` (now generic — see that
 * module) directly against this engine's own flat `OutlineHeading[]` to
 * validate a move is in-bounds and resolve the swap target, mirroring
 * Verbatim's "move heading" reorder shortcut. `moveOutlineNode` has no
 * notion of document positions, so it only decides *whether/which* two
 * headings swap; this module does the actual work of swapping the two
 * headings' document ranges (each running from the heading itself to the
 * next heading, of any level, in document order — headings are flat, per
 * `heading-outline.ts`) via a ProseMirror transaction.
 */
import type { Node as PMNode } from "prosemirror-model";
import { Fragment, Slice } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";
// Imported from the specific source file rather than the package barrel —
// see the note in `../verbatim-shortcuts.ts`.
import { moveOutlineNode } from "debate-card-parser/src/utils/verbatim-shortcuts.js";
import type { OutlineHeading } from "./heading-outline.js";

function fragmentToArray(fragment: Fragment): PMNode[] {
  const nodes: PMNode[] = [];
  fragment.forEach((node) => nodes.push(node));
  return nodes;
}

/** The document range a heading's section spans: from the heading itself
 *  up to (not including) the next heading in document order, or the end
 *  of the document for the last heading. */
function sectionEnd(outline: readonly OutlineHeading[], index: number, docSize: number): number {
  const next = outline[index + 1];
  return next ? next.pos : docSize;
}

/**
 * Builds the transaction that swaps `headingId`'s section with the
 * adjacent one in `direction`, or `null` when the move is out of bounds
 * (first heading moving up, last heading moving down, or an unknown id).
 */
export function buildMoveHeadingSectionTransaction(
  state: EditorState,
  outline: readonly OutlineHeading[],
  headingId: string,
  direction: "up" | "down",
): Transaction | null {
  const index = outline.findIndex((heading) => heading.id === headingId);
  if (index === -1) return null;

  // Reuse the shared bounds-checked swap purely to confirm this move is
  // legal (moveOutlineNode returns the same array reference, unchanged,
  // when the target would be out of range).
  const reordered = moveOutlineNode(outline as OutlineHeading[], index, direction);
  if (reordered === outline) return null;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  const [firstIndex, secondIndex] = index < targetIndex ? [index, targetIndex] : [targetIndex, index];
  const first = outline[firstIndex];
  const second = outline[secondIndex];
  if (!first || !second) return null;

  const docSize = state.doc.content.size;
  const secondEnd = sectionEnd(outline, secondIndex, docSize);

  const firstSlice = state.doc.slice(first.pos, second.pos);
  const secondSlice = state.doc.slice(second.pos, secondEnd);

  const swapped = Fragment.from([
    ...fragmentToArray(secondSlice.content),
    ...fragmentToArray(firstSlice.content),
  ]);

  return state.tr.replace(first.pos, secondEnd, new Slice(swapped, 0, 0));
}

/** The heading whose section contains `pos` — the last heading at or
 *  before `pos` in document order, or `null` before the first heading. */
export function findHeadingAtPos(
  outline: readonly OutlineHeading[],
  pos: number,
): OutlineHeading | null {
  let current: OutlineHeading | null = null;
  for (const heading of outline) {
    if (heading.pos > pos) break;
    current = heading;
  }
  return current;
}
