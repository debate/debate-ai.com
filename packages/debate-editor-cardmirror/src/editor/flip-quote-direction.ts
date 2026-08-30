/**
 * "Flip Quote Direction" command — for every curly quote in the selection, swap
 * it to the opposite direction (left ↔ right), preserving marks. A plain
 * character toggle, NOT context-aware, so applying it twice is a no-op. The
 * manual escape hatch for cases smart quotes can't guess (e.g. `'tis`, `'90s`).
 *
 * Selection-only: a collapsed cursor does nothing.
 */

import type { Command } from 'prosemirror-state';
import type { Mark } from 'prosemirror-model';

const FLIP: Record<string, string> = {
  '‘': '’', // U+2018 → U+2019  (single)
  '’': '‘', // U+2019 → U+2018
  '“': '”', // U+201C → U+201D  (double)
  '”': '“', // U+201D → U+201C
};

export const flipQuoteDirection: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  if (empty) return false; // selection-only

  const edits: { pos: number; flipped: string; marks: readonly Mark[] }[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return true;
    for (let i = 0; i < node.text.length; i++) {
      const charPos = pos + i;
      if (charPos < from || charPos >= to) continue; // only within the selection
      const flipped = FLIP[node.text[i]!];
      if (flipped) edits.push({ pos: charPos, flipped, marks: node.marks });
    }
    return true;
  });
  if (edits.length === 0) return false;

  if (dispatch) {
    let tr = state.tr;
    // Each replacement is 1 char → 1 char, so positions don't shift.
    for (const e of edits) {
      tr = tr.replaceWith(e.pos, e.pos + 1, state.schema.text(e.flipped, e.marks));
    }
    dispatch(tr);
  }
  return true;
};
