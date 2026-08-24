/**
 * Keep a text selection from straddling a live-zone boundary.
 *
 * `transclusion_ref` is `isolating`, but that only stops editing operations
 * (backspace, lift, fitting) from crossing the boundary — it does NOT stop a
 * text selection from spanning it. A mouse drag from outside a zone into it (or
 * vice-versa) forms a cross-boundary `TextSelection`, and then deleting /
 * cutting / typing / pasting over that selection tears the zone: the wrapper is
 * stripped and its transcluded cards spill out as loose siblings.
 *
 * This plugin clamps any such selection back to the anchor's side of the
 * boundary on the very transaction that forms it, so those destructive ops can
 * never see a cross-boundary range. Untouched: collapsed cursors, selections
 * wholly inside or outside a zone, and a whole-zone `NodeSelection` (whose ends
 * sit at the zone's outer boundary, i.e. the same "outside" zone on both sides).
 */
import { Plugin, TextSelection } from 'prosemirror-state';
import { enclosingZonePos, isTransclusionNode } from './transclusion.js';

export const transclusionSelectionGuard = new Plugin({
  appendTransaction(_trs, _oldState, newState) {
    const sel = newState.selection;
    if (sel.empty || !(sel instanceof TextSelection)) return null;
    const doc = newState.doc;
    const anchorZone = enclosingZonePos(doc, sel.anchor);
    const headZone = enclosingZonePos(doc, sel.head);
    if (anchorZone === headZone) return null; // wholly one side — fine

    const forward = sel.head > sel.anchor;
    let clampedHead: number;
    if (anchorZone !== null) {
      // Anchor is inside a zone → keep the head inside that same zone.
      const z = doc.nodeAt(anchorZone);
      if (!z) return null;
      clampedHead = forward ? anchorZone + z.nodeSize - 1 : anchorZone + 1;
    } else if (headZone !== null) {
      // Anchor is outside → keep the head outside the zone it reached into.
      const z = doc.nodeAt(headZone);
      if (!z) return null;
      clampedHead = forward ? headZone : headZone + z.nodeSize;
    } else {
      return null;
    }

    // Bias the resolved position away from the zone so `between` doesn't re-enter.
    return newState.tr.setSelection(
      TextSelection.between(doc.resolve(sel.anchor), doc.resolve(clampedHead), forward ? -1 : 1),
    );
  },
});

/**
 * Remove a live zone the moment an edit leaves it with NO content. A zone edited
 * down to empty (e.g. selecting all its cards and deleting) would otherwise
 * linger as an invisible phantom — see `dropEmptyZones` for the load-time twin.
 * Deleting whole cards is a normal in-zone edit the isolating boundary allows;
 * this just tidies up the husk left behind. The removal rides on the same
 * transaction group as the edit, so a single undo restores the whole zone.
 */
export const transclusionEmptyZoneReaper = new Plugin({
  appendTransaction(trs, _oldState, newState) {
    if (!trs.some((tr) => tr.docChanged)) return null;
    const empties: number[] = [];
    newState.doc.forEach((child, offset) => {
      if (isTransclusionNode(child) && child.content.size === 0) empties.push(offset);
    });
    if (empties.length === 0) return null;
    const tr = newState.tr;
    // Delete high→low so each earlier offset stays valid as we go.
    for (const pos of empties.sort((a, b) => b - a)) {
      const node = tr.doc.nodeAt(pos);
      if (node && isTransclusionNode(node) && node.content.size === 0) {
        tr.delete(pos, pos + node.nodeSize);
      }
    }
    return tr.docChanged ? tr : null;
  },
});
