/**
 * Tab / Shift-Tab handlers for paragraph-level indentation.
 *
 * Behavior matches Word:
 *   - Tab with collapsed cursor: insert a literal '\t' character.
 *   - Tab with a selection that fully encloses ≥1 paragraph-like
 *     block (or spans across paragraph boundaries): increase the
 *     `indent` attr of every paragraph the selection touches by
 *     one tab stop. Selection within a single paragraph that
 *     doesn't fully cover it falls through (default replace).
 *   - Shift-Tab: decrement `indent` for every paragraph the
 *     selection (or cursor's containing paragraph) currently has
 *     indented. No-op when no touched paragraph has any indent.
 *
 * Inside tables, these commands defer entirely — `tableEditing()`'s
 * own Tab handlers (cell navigation) run earlier in the plugin
 * chain, so this file never sees Tab while inside a table cell.
 */

import type { Command } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';

/** OOXML dxa per step: 720 dxa = 0.5 inch = Word's default tab stop. */
export const INDENT_STEP_DXA = 720;

/** Schema node types that round-trip to `<w:p>` and therefore carry
 *  the `indent` attr. Keep in sync with `indentAttr` propagation in
 *  `src/schema/nodes.ts`. */
const INDENTABLE_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'pocket',
  'hat',
  'block',
  'tag',
  'analytic',
  'undertag',
  'cite_paragraph',
  'card_body',
]);

interface Hit {
  pos: number;
  node: PMNode;
}

/** Collect every indentable block whose range overlaps `[from, to]`.
 *  Returns the hits in document order along with a flag indicating
 *  whether any of them are fully enclosed by the selection (used by
 *  `indentParagraph` to decide between "indent" and "fall through"). */
function collectTouchedBlocks(
  doc: PMNode,
  from: number,
  to: number,
): { hits: Hit[]; anyFullyEnclosed: boolean } {
  const hits: Hit[] = [];
  let anyFullyEnclosed = false;
  doc.nodesBetween(from, to, (node, pos) => {
    if (!INDENTABLE_TYPES.has(node.type.name)) return true;
    // "Fully enclosed" means the selection covers every position
    // inside the paragraph's CONTENT — not the wrapping node tokens
    // (pos itself and pos + nodeSize - 1 are the open/close
    // positions that surround the content). Selecting all text in a
    // paragraph spans [contentStart, contentEnd] inclusive, which is
    // what users mean when they say they've selected the "whole
    // paragraph".
    const contentStart = pos + 1;
    const contentEnd = pos + node.nodeSize - 1;
    hits.push({ pos, node });
    if (from <= contentStart && contentEnd <= to) anyFullyEnclosed = true;
    return false;
  });
  return { hits, anyFullyEnclosed };
}

/** Tab behavior — see file header. */
export const indentParagraph: Command = (state, dispatch) => {
  const sel = state.selection;

  if (sel.empty) {
    // Collapsed cursor: insert a literal tab character.
    if (dispatch) dispatch(state.tr.insertText('\t').scrollIntoView());
    return true;
  }

  const { from, to } = sel;
  const { hits, anyFullyEnclosed } = collectTouchedBlocks(state.doc, from, to);

  if (!anyFullyEnclosed) {
    // Partial selection within a single paragraph: replace the
    // selection with a tab character. We always handle Tab so the
    // browser doesn't take over (its default is focus-traversal,
    // which would move keyboard focus out of the editor entirely).
    if (dispatch) dispatch(state.tr.insertText('\t').scrollIntoView());
    return true;
  }

  if (!dispatch) return true;
  let tr = state.tr;
  for (const { pos, node } of hits) {
    const current = Number(node.attrs['indent'] ?? 0);
    const next = current + INDENT_STEP_DXA;
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
  }
  dispatch(tr.scrollIntoView());
  return true;
};

/** Shift-Tab behavior — see file header. */
export const outdentParagraph: Command = (state, dispatch) => {
  const { from, to } = state.selection;
  const { hits } = collectTouchedBlocks(state.doc, from, to);
  // Only act when at least one touched paragraph currently has
  // indent to give back; otherwise defer (no insert behavior on the
  // collapsed-cursor case — Shift-Tab has no useful "insert").
  const indentable = hits.filter(
    (h) => Number(h.node.attrs['indent'] ?? 0) > 0,
  );
  if (indentable.length === 0) return false;

  if (!dispatch) return true;
  let tr = state.tr;
  for (const { pos, node } of indentable) {
    const current = Number(node.attrs['indent'] ?? 0);
    const next = Math.max(0, current - INDENT_STEP_DXA);
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
  }
  dispatch(tr.scrollIntoView());
  return true;
};
