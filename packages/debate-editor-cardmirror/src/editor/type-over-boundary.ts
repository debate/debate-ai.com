/**
 * Typing over a block-tail selection must not eat the block boundary.
 *
 * Triple-click selects a paragraph's INLINE content, so typing over it
 * replaces in place and the paragraph break survives. Ctrl-Shift-Down
 * (and Shift-Down past a block's end) extends the selection to the
 * START of the next textblock — the boundary is inside the selection,
 * so ProseMirror's replace merges the blocks. Worst case: cursor at a
 * tag's start, Ctrl-Shift-Down to select the tag, type — the cite
 * folds into the tag.
 *
 * This plugin intercepts text input over any non-empty selection whose
 * tail sits at offset 0 of a textblock (the Ctrl-Shift-Down shape:
 * nothing of the next block is visually selected) and trims the
 * replace range back to the end of the previous textblock. Selections
 * that genuinely reach INTO the next block's text keep the standard
 * merging behavior — there the user visibly selected across the
 * boundary.
 */

import { Plugin, Selection, TextSelection } from 'prosemirror-state';

export const typeOverBoundaryPlugin: Plugin = new Plugin({
  props: {
    handleTextInput(view, from, to, text): boolean {
      if (from >= to) return false;
      const { state } = view;
      const $to = state.doc.resolve(to);
      if (!$to.parent.isTextblock || $to.parentOffset !== 0) return false;
      // The tail block must not be where the selection starts —
      // otherwise this is an ordinary within-block replacement.
      const tailBlockStart = $to.before($to.depth);
      if (from >= tailBlockStart) return false;
      // Walk back across the boundary to the nearest valid cursor
      // position — the end of the previous textblock, however deep
      // the structural nesting between the two blocks is.
      const prev = Selection.near(state.doc.resolve(tailBlockStart), -1);
      const trimmedTo = prev.to;
      if (trimmedTo <= from || trimmedTo >= to) return false;
      const tr = state.tr.insertText(text, from, trimmedTo);
      // Collapse to a cursor after the typed text — PM's default input
      // path does this implicitly; without it the mapped selection
      // stays a range with its tail at the block start, so every
      // following keystroke re-enters this handler and overwrites the
      // first character in place.
      tr.setSelection(TextSelection.create(tr.doc, from + text.length));
      view.dispatch(tr.scrollIntoView());
      return true;
    },
  },
});
