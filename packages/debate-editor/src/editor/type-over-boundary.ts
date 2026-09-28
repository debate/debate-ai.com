/**
 * Editing over selections that cross block/container boundaries.
 *
 * Two concerns share this module:
 *
 * 1. Typing over a block-TAIL selection must not eat the block
 *    boundary. Triple-click selects a paragraph's INLINE content, so
 *    typing over it replaces in place and the paragraph break
 *    survives. Ctrl-Shift-Down (and Shift-Down past a block's end)
 *    extends the selection to the START of the next textblock — the
 *    boundary is inside the selection, so ProseMirror's replace merges
 *    the blocks. Worst case: cursor at a tag's start, Ctrl-Shift-Down
 *    to select the tag, type — the cite folds into the tag. The
 *    plugin trims the replace range back to the end of the previous
 *    textblock. Selections that genuinely reach INTO the next block's
 *    text keep the standard merging behavior.
 *
 * 2. A selection whose tail ends inside a container's required HEAD
 *    block (a card's tag, an analytic unit's head) is the one range
 *    shape ProseMirror's replace fit cannot close — deleting it must
 *    join the tail container's remainder onto the from-side container,
 *    and no depth combination is schema-legal ("Cannot join card onto
 *    analytic_unit", field crash 2026-08-29: typing over such a
 *    mouse-drag selection threw UNCAUGHT and ate the keystroke).
 *    Body-to-body selections already merge fine via the default path.
 *    `mergingCrossDelete` rebuilds the edit with the intended merge
 *    semantics — exactly as if the intervening boundary had been
 *    deleted first: the head's remaining text flows UP inline into the
 *    cut block, and the tail container's remaining body blocks follow
 *    it into the from-side container.
 */

import { Plugin, Selection, TextSelection } from 'prosemirror-state';
import type { Command, EditorState, Transaction } from 'prosemirror-state';
import { Fragment } from 'prosemirror-model';
import type { Node as PMNode } from 'prosemirror-model';

/** The Ctrl-Shift-Down trim: when the selection's tail sits at offset
 *  0 of a textblock it doesn't start in, the replace range pulls back
 *  to the end of the previous textblock. Null = not that shape. */
function trimmedTail(state: EditorState, from: number, to: number): number | null {
  const $to = state.doc.resolve(to);
  if (!$to.parent.isTextblock || $to.parentOffset !== 0) return null;
  // The tail block must not be where the selection starts —
  // otherwise this is an ordinary within-block replacement.
  const tailBlockStart = $to.before($to.depth);
  if (from >= tailBlockStart) return null;
  // Walk back across the boundary to the nearest valid cursor
  // position — the end of the previous textblock, however deep
  // the structural nesting between the two blocks is.
  const prev = Selection.near(state.doc.resolve(tailBlockStart), -1);
  const trimmedTo = prev.to;
  if (trimmedTo <= from || trimmedTo >= to) return null;
  return trimmedTo;
}

/** Delete `from..to` with merge-up semantics for the head-tail shape
 *  the direct replace cannot fit. Returns null when the shape doesn't
 *  apply or the rebuild itself fails (caller falls back / gives up).
 *  Only call this after the DIRECT delete/replace threw — legal
 *  ranges must keep ProseMirror's own (already correct) merge. */
export function mergingCrossDelete(
  state: EditorState,
  from: number,
  to: number,
): Transaction | null {
  if (from >= to) return null;
  const $from = state.doc.resolve(from);
  const $to = state.doc.resolve(to);
  if (!$from.parent.isTextblock || !$to.parent.isTextblock) return null;
  const shared = $from.sharedDepth(to);
  if ($to.depth <= shared) return null; // tail at a boundary — not this shape
  const bDepth = shared + 1;
  const afterB = $to.after(bDepth);
  // Content the merge carries up: the tail block's text after the
  // selection, then — when the tail block is a container's child —
  // the container's remaining children after it.
  const remainderInline = $to.parent.content.cut($to.parentOffset);
  let followers = Fragment.empty;
  if ($to.depth > bDepth) {
    const b = $to.node(bDepth);
    const parts: PMNode[] = [];
    for (let i = $to.index(bDepth) + 1; i < b.childCount; i++) parts.push(b.child(i));
    followers = Fragment.from(parts);
  }
  try {
    const tr = state.tr;
    // Deleting to the BOUNDARY after the tail's top-level node is
    // always fittable (it closes the from-side without a join).
    tr.delete(from, afterB);
    if (remainderInline.size) tr.insert(from, remainderInline);
    if (followers.size) {
      const $cut = tr.doc.resolve(from);
      const blockAfter = $cut.after($cut.depth);
      try {
        tr.insert(blockAfter, followers);
      } catch {
        // Destination can't host these block types (from-side is a
        // flat context) — carry the text as paragraphs instead.
        const paras: PMNode[] = [];
        followers.forEach((child) => {
          paras.push(state.schema.nodes['paragraph']!.create(null, child.content));
        });
        tr.insert(blockAfter, Fragment.from(paras));
      }
    }
    return tr;
  } catch {
    return null;
  }
}

/** Wrap a command so an escaping TransformError becomes a logged
 *  no-op instead of an uncaught crash. For the BASE-command fallbacks
 *  at the end of the Enter/Backspace/Delete chains: ProseMirror's
 *  join/split machinery still has fit shapes it cannot close (fuzzer
 *  finds, 2026-08-31 — cursor joins at container boundaries), and an
 *  uncaught throw out of a keystroke ate the input and spammed the
 *  console (field log, 2026-08-29). A no-op is honest: the edit had
 *  no legal result. */
export function neverThrow(cmd: Command): Command {
  return (state, dispatch, view) => {
    try {
      return cmd(state, dispatch, view);
    } catch (err) {
      console.warn('[cardmirror] editing command failed on this selection:', err);
      return true; // claim the key: half-dispatched work must not cascade
    }
  };
}

/** Backspace/Delete over a selection the direct delete cannot fit —
 *  runs the merge-up rebuild. Defers to the default commands (returns
 *  false) whenever the ordinary delete is legal. */
export const crossContainerDeleteSelection: Command = (state, dispatch) => {
  const { empty, from, to } = state.selection;
  if (empty) return false;
  try {
    state.tr.deleteSelection();
    return false; // legal — the default chain handles it
  } catch {
    /* the unfittable shape — rebuild below */
  }
  const tr = mergingCrossDelete(state, from, to);
  if (!tr) return false;
  if (dispatch) {
    tr.setSelection(TextSelection.create(tr.doc, from));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Make the current selection safe to replace-over: when the direct
 *  delete of the selected range cannot fit (the head-tail shape),
 *  merge-delete it and leave a collapsed cursor at the cut point, so
 *  a following replaceSelection (paste, drop) proceeds instead of
 *  throwing "Cannot join …" out of the input pipeline (fuzzer find,
 *  2026-08-31 — the paste-over cousin of the typing crash). Returns
 *  false only when the selection was unfittable AND the rebuild
 *  failed; callers should then swallow the gesture. */
export function prepareSelectionForReplace(view: {
  state: EditorState;
  dispatch: (tr: Transaction) => void;
}): boolean {
  const { state } = view;
  const { empty, from, to } = state.selection;
  if (empty) return true;
  try {
    state.tr.deleteSelection();
    return true; // fits — the replace's own delete will be fine
  } catch {
    /* unfittable — merge-delete below */
  }
  const tr = mergingCrossDelete(state, from, to);
  if (!tr) return false;
  tr.setSelection(TextSelection.create(tr.doc, from));
  view.dispatch(tr);
  return true;
}

export const typeOverBoundaryPlugin: Plugin = new Plugin({
  props: {
    handleTextInput(view, from, to, text): boolean {
      if (from >= to) return false;
      const { state } = view;
      const effTo = trimmedTail(state, from, to);
      let tr: Transaction;
      try {
        tr = state.tr.insertText(text, from, effTo ?? to);
      } catch {
        // The unfittable head-tail shape (see mergingCrossDelete):
        // merge-delete, then type at the cut point.
        const merged = mergingCrossDelete(state, from, effTo ?? to);
        if (!merged) {
          // Nothing legal to do — swallow the keystroke rather than
          // crash the input pipeline; doc and selection are untouched.
          return true;
        }
        merged.insertText(text, from, from);
        merged.setSelection(TextSelection.create(merged.doc, from + text.length));
        view.dispatch(merged.scrollIntoView());
        return true;
      }
      // Not the trim shape and the direct replace is legal → let the
      // default input path do its ordinary (identical) work.
      if (effTo === null) return false;
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
