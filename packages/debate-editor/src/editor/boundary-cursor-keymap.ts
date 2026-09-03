/**
 * Keep the caret in the leading block after a cross-boundary delete.
 *
 * A selection's end (`to`) can sit at `parentOffset === 0` of a later
 * textblock — the Ctrl/Alt-Shift-Down shape (and native Shift-Down past a
 * block's end) — so the paragraph break is inside the selection (see
 * `pilcrow-selection-plugin.ts`). Deleting such a selection leaves the caret
 * at the mapped selection END. When the two blocks merge (plain body
 * paragraphs) that's fine — the end maps into the merged block. But when the
 * merge is BLOCKED (an isolating tag/card boundary: the delete empties the
 * leading block yet leaves both blocks standing), the mapped end lands at the
 * START of the untouched trailing block — e.g. select a card's tag including
 * the break and delete, and the caret jumps to the next card. The break was
 * NOT consumed, so per our invariant the caret must stay in the leading block.
 *
 * `deleteSelectionKeepingLeadingCursor` decides what happened with a probe:
 * it runs `deleteSelection` and compares the textblock count. If the count is
 * UNCHANGED, the leading block survived (emptied) but didn't merge — so it
 * instead deletes only the leading block's selected content `[from,
 * leadingEnd]`, leaving the break and trailing block untouched, and the caret
 * maps cleanly into the (now empty) leading block. If the count DROPPED, the
 * blocks really merged (plain paragraphs) or the whole leading container was
 * removed (a tag-only card) — in both the leading block is gone, so the plain
 * `deleteSelection` caret is correct and we use it. (Position-mapping the
 * survivor directly is unreliable: `deleteSelection` collapses content AND the
 * boundary into one ambiguous cut point, so no original position resolves back
 * inside the emptied block — hence the clean re-delete.)
 *
 * Used by the Backspace/Delete keymap fallback below and the voice deletes.
 *
 * Detection mirrors `type-over-boundary.ts` / `pilcrow-selection-plugin.ts`:
 * the selection end resolves to `parentOffset === 0` of a textblock and the
 * selection starts before that block, so a real break is captured.
 */

import { Selection, TextSelection } from 'prosemirror-state';
import type { Command, EditorState, Transaction } from 'prosemirror-state';
import type { Node as PMNode, ResolvedPos } from 'prosemirror-model';
import { joinBackward, joinForward } from 'prosemirror-commands';
import { canJoin } from 'prosemirror-transform';

/** True when the selection's end grabs a trailing paragraph break: it sits
 *  at offset 0 of a textblock that the selection started before. */
function grabsTrailingBreak(state: EditorState): boolean {
  const sel = state.selection;
  if (sel.empty) return false;
  const $to = state.doc.resolve(sel.to);
  if (!$to.parent.isTextblock || $to.parentOffset !== 0) return false;
  const tailBlockStart = $to.before($to.depth);
  return sel.from < tailBlockStart;
}

function countTextblocks(doc: PMNode): number {
  let n = 0;
  doc.descendants((node) => {
    if (node.isTextblock) n++;
    return true;
  });
  return n;
}

/**
 * Delete the current selection; if it grabbed a trailing break that didn't
 * actually merge, keep the caret in the leading block. Returns the
 * transaction with `scrollIntoView()` applied. Identical to a plain
 * `deleteSelection().scrollIntoView()` for every other selection shape.
 */
export function deleteSelectionKeepingLeadingCursor(
  state: EditorState,
): Transaction {
  const sel = state.selection;
  if (grabsTrailingBreak(state)) {
    const $to = state.doc.resolve(sel.to);
    const tailBlockStart = $to.before($to.depth);
    try {
      const leadingEnd = Selection.near(state.doc.resolve(tailBlockStart), -1).to;
      if (leadingEnd > sel.from) {
        const probe = state.tr.deleteSelection();
        if (countTextblocks(state.doc) === countTextblocks(probe.doc)) {
          // Blocked merge: the leading block survives, emptied. Delete only
          // its selected content so the break and trailing block stay put and
          // the caret lands inside the leading block.
          const tr = state.tr.delete(sel.from, leadingEnd);
          tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(sel.from)));
          return tr.scrollIntoView();
        }
      }
    } catch {
      /* fall through to the plain delete */
    }
  }
  return state.tr.deleteSelection().scrollIntoView();
}

/** Backspace/Delete fallback: handle the trailing-break-grab shape so the
 *  caret stays in the leading block; defer otherwise. */
export const keepCursorInLeadingBlockOnBlockedMerge: Command = (
  state,
  dispatch,
) => {
  if (!grabsTrailingBreak(state)) return false;
  if (!dispatch) return true;
  dispatch(deleteSelectionKeepingLeadingCursor(state));
  return true;
};

/** prosemirror-commands' `findCutBefore` (not exported): the position a
 *  backward / forward delete would cut at, or null when an isolating wall
 *  blocks it. Reimplemented because prosemirror-commands doesn't export them. */
function findCutBefore($pos: ResolvedPos): ResolvedPos | null {
  if (!$pos.parent.type.spec.isolating) {
    for (let d = $pos.depth - 1; d >= 0; d--) {
      if ($pos.index(d) > 0) return $pos.doc.resolve($pos.before(d + 1));
      if ($pos.node(d).type.spec.isolating) break;
    }
  }
  return null;
}
function findCutAfter($pos: ResolvedPos): ResolvedPos | null {
  if (!$pos.parent.type.spec.isolating) {
    for (let d = $pos.depth - 1; d >= 0; d--) {
      const parent = $pos.node(d);
      if ($pos.index(d) + 1 < parent.childCount) return $pos.doc.resolve($pos.after(d + 1));
      if (parent.type.spec.isolating) break;
    }
  }
  return null;
}

/**
 * Backspace/Delete pressed while the caret sits at a GAP it shouldn't rest at
 * — e.g. a click that landed just past the last card, so `$head.parent` is the
 * doc/card rather than a textblock. The default would node-select the adjacent
 * body, and a bare swallow leaves the key dead (it only "works" after an arrow
 * round-trip normalizes the caret into the body). Instead, jump into the
 * adjacent body and delete there, so the key edits it immediately — exactly
 * what the user expected from where they clicked. `dir` -1 = Backspace (the
 * node before), +1 = Delete (the node after).
 */
function editAdjacentBodyFromGap(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  dir: -1 | 1,
): boolean {
  const $head = state.selection.$head;
  // A gap BETWEEN two blocks first (field report, beta.22): a click in
  // the blank spacing between paragraphs (or below a block's last line)
  // parks the caret here, visually indistinguishable from the start of
  // the next line — so the user's Backspace/Delete means "remove the
  // return". The old delete-a-char-in-the-adjacent-body behavior ate
  // the previous block's last character instead (or, when that block
  // was empty, just moved the caret — a dead-feeling first press). Join
  // the two sides when the schema allows it; `canJoin` refusing (card
  // against card, tag boundaries) falls through to caret normalization
  // into the following block, where the ordinary boundary rules apply
  // on the next press.
  if ($head.nodeBefore && $head.nodeAfter) {
    if (!dispatch) return true;
    if (canJoin(state.doc, $head.pos)) {
      const tr = state.tr.join($head.pos);
      tr.setSelection(
        Selection.near(tr.doc.resolve(tr.mapping.map($head.pos, -1)), -1),
      );
      dispatch(tr.scrollIntoView());
    } else {
      const into = Selection.near(state.doc.resolve($head.pos), dir === -1 ? 1 : -1);
      dispatch(state.tr.setSelection(into).scrollIntoView());
    }
    return true;
  }
  // Edge gap (nothing on one side — e.g. a click just past the LAST
  // card): jump into the adjacent body and delete there, so the key
  // edits it immediately — what the user expected from where they
  // clicked.
  const near = Selection.near(state.doc.resolve($head.pos), dir);
  if (!(near instanceof TextSelection)) return false;
  if (!dispatch) return true;
  const at = near.$head.pos;
  const $at = state.doc.resolve(at);
  if (dir < 0 && $at.parentOffset > 0) {
    // Non-empty body: delete the char before its end (native Backspace there).
    const tr = state.tr.delete(at - 1, at);
    tr.setSelection(TextSelection.create(tr.doc, at - 1));
    dispatch(tr.scrollIntoView());
  } else if (dir > 0 && $at.parentOffset < $at.parent.content.size) {
    // Non-empty body: delete the char at its start (native Delete there).
    const tr = state.tr.delete(at, at + 1);
    tr.setSelection(TextSelection.create(tr.doc, at));
    dispatch(tr.scrollIntoView());
  } else {
    // Empty target block — nothing to delete; just move the caret inside so
    // the next keystroke edits it.
    dispatch(state.tr.setSelection(near).scrollIntoView());
  }
  return true;
}

/**
 * Stop Backspace from NODE-SELECTING a whole block or container.
 *
 * baseKeymap's Backspace chain ends in `selectNodeBackward`: at a backward
 * boundary where `joinBackward` can't merge — the caret at the start of a
 * block after an isolating card, or at a gap after the last card — it selects
 * the node before as a `NodeSelection`. So one Backspace selects the entire
 * card / card_body and the next deletes it, a jarring two-step that should
 * never happen for structural nodes.
 *
 * Sits at the END of the custom Backspace chain, ahead of baseKeymap:
 *   - at a GAP (caret not in a textblock): redirect into the body and delete
 *     there (see `editAdjacentBodyFromGap`) rather than node-select or die;
 *   - at a textblock start-edge after a card: swallow, but ONLY when no real
 *     merge is available (queried via `joinBackward`) and the target is a
 *     NON-ATOM. Atom node-selection (an image, where select-to-delete is the
 *     point) and every merge path are left untouched.
 * The target node is computed exactly as `selectNodeBackward` does.
 */
export const blockBackspaceNodeSelect: Command = (state, dispatch, view) => {
  const sel = state.selection;
  if (!sel.empty) return false;
  const $head = sel.$head;
  if (!$head.parent.isTextblock) {
    const node = $head.nodeBefore;
    if (!node || node.isAtom) return false;
    return editAdjacentBodyFromGap(state, dispatch, -1);
  }
  const atStartEdge = view
    ? view.endOfTextblock('backward', state)
    : $head.parentOffset === 0;
  if (!atStartEdge) return false; // mid-text: browser deletes a char natively
  const $cut = findCutBefore($head);
  const node = $cut?.nodeBefore;
  if (!node) return false;
  if (joinBackward(state, undefined, view)) return false; // a real merge — allow it
  return !node.isAtom; // swallow node-selection of a block/container
};

/**
 * Mirror of {@link blockBackspaceNodeSelect} for Delete (`selectNodeForward`).
 * Caret at the end of a block before an isolating card, or a gap before a
 * card, would otherwise forward-node-select the whole card/body.
 */
export const blockDeleteNodeSelect: Command = (state, dispatch, view) => {
  const sel = state.selection;
  if (!sel.empty) return false;
  const $head = sel.$head;
  if (!$head.parent.isTextblock) {
    const node = $head.nodeAfter;
    if (!node || node.isAtom) return false;
    return editAdjacentBodyFromGap(state, dispatch, 1);
  }
  const atEndEdge = view
    ? view.endOfTextblock('forward', state)
    : $head.parentOffset === $head.parent.content.size;
  if (!atEndEdge) return false;
  const $cut = findCutAfter($head);
  const node = $cut?.nodeAfter;
  if (!node) return false;
  if (joinForward(state, undefined, view)) return false;
  return !node.isAtom;
};
