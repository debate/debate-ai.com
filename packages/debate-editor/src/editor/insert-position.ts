/**
 * Where a slice should be inserted near a caret so it lands at a valid drop
 * target *for that kind of content* — mirroring drag-and-drop, where what counts
 * as a drop target depends on what you're dropping.
 *
 * Inserting a block-level slice (a shelf item, a quick card, a sent slice) at a
 * raw caret inside a `card` forces ProseMirror to split the card to fit it,
 * spawning a phantom blank-tag (`id: null`) card for the orphaned tail. But
 * snapping everything to the doc root is wrong too. The snap is content-aware:
 *
 *   - inline text stays at the caret (a textblock accepts it directly);
 *   - card content (`card_body` / `cite_paragraph` / `undertag` / `table`) drops
 *     into the nearest gap between the children of the enclosing card;
 *   - a doc-level structural object (`card` / `analytic_unit` / `pocket` / `hat`
 *     / `block`) drops at the nearest OUTLINE slot for its level, exactly like
 *     the drag surface: a card lands between cards, a block between blocks, a hat
 *     between hats, and so on.
 */

import { type Fragment, type Node as PMNode } from 'prosemirror-model';
import { collectHeadings, headingInsertPos, TYPE_TO_LEVEL } from './headings.js';

/**
 * Outline level of a doc-level structural slice lead, or `undefined` if the lead
 * isn't a heading-anchored doc-level object. `card` / `analytic_unit` take their
 * head's level (tag / analytic = 4); pocket / hat / block are 1 / 2 / 3.
 */
function docLevelObjectLevel(node: PMNode): number | undefined {
  const t = node.type.name;
  if (t === 'card') return TYPE_TO_LEVEL['tag'];
  if (t === 'analytic_unit') return TYPE_TO_LEVEL['analytic'];
  return TYPE_TO_LEVEL[t]; // pocket / hat / block (or a bare tag / analytic)
}

/**
 * The nearest outline slot valid for a doc-level object of `level`, mirroring
 * the drag surface (`drag-editor-surface.ts`): the start of every heading entry
 * whose level is `<= level`, plus the doc end. So a card (level 4) can land
 * before any card/heading, a block (level 3) only at pocket/hat/block
 * boundaries, etc.
 */
function nearestOutlineSlot(doc: PMNode, pos: number, level: number): number {
  let best = doc.content.size; // doc-end is always a valid slot
  let bestDist = Math.abs(best - pos);
  for (const entry of collectHeadings(doc, { skipCite: true })) {
    if (entry.level > level) continue;
    const slot = headingInsertPos(doc, entry);
    if (slot == null) continue;
    const dist = Math.abs(slot - pos);
    if (dist < bestDist) {
      best = slot;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * The position near `pos` where `content` legally drops. Doc-level structural
 * content snaps to the nearest outline slot for its level; inline and card
 * content walk outward from the caret to the innermost ancestor that accepts it
 * (via `Node.canReplace`) and snap to the nearer surrounding gap there. Returns
 * `pos` unchanged when it's already valid, or when nothing accepts `content`.
 */
export function nearestValidInsertPos(
  doc: PMNode,
  pos: number,
  content: Fragment,
): number {
  const lead = content.firstChild;
  if (lead) {
    const level = docLevelObjectLevel(lead);
    if (level !== undefined) return nearestOutlineSlot(doc, pos, level);
  }

  // Inline / card content: snap to the innermost ancestor that accepts it.
  const $pos = doc.resolve(pos);
  for (let d = $pos.depth; d >= 0; d--) {
    const container = $pos.node(d);
    const index = $pos.index(d);
    if (d === $pos.depth) {
      // `pos` sits directly inside this node — keep the caret if it fits here
      // (inline in a textblock, or a block at an already-valid gap).
      if (container.canReplace(index, index, content)) return pos;
      continue;
    }
    // node(d) is an ancestor; the child on the path to `pos` is at depth d+1.
    const before = $pos.before(d + 1);
    const after = $pos.after(d + 1);
    const canBefore = container.canReplace(index, index, content);
    const canAfter = container.canReplace(index + 1, index + 1, content);
    if (canBefore && canAfter) return pos - before <= after - pos ? before : after;
    if (canBefore) return before;
    if (canAfter) return after;
  }
  return pos;
}
