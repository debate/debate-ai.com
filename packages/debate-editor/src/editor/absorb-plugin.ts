/**
 * Card-body absorption plugin.
 *
 * Enforces the editing-semantics rule (ARCHITECTURE.md §14.3): a
 * `paragraph` (or `cite_paragraph`) at doc level whose previous
 * sibling is a `card` or `analytic_unit` is auto-absorbed into that
 * container. To bound a region of loose paragraphs after a card,
 * the user inserts a heading (Pocket / Hat / Block) — anything
 * non-absorbable breaks the absorption zone.
 *
 * Absorption type mapping:
 *   - paragraph → card_body
 *   - cite_paragraph → cite_paragraph (valid as a child of both
 *     `card` and `analytic_unit`).
 *   - undertag → undertag (valid in both containers; the bare-doc-level
 *     case shows up after F7 on text that's followed by undertag
 *     annotations, or after promote-then-demote round-trips). Undertags
 *     do NOT terminate the absorption zone.
 *   - card_body → card_body (rare at doc level, but valid in both
 *     containers and harmless to absorb in place).
 *   - table → table (valid in both containers; shows up after F7 on text
 *     followed by an evidence table — without absorbing it the card wrapper
 *     would stop at the table instead of covering the whole card).
 *
 * Cases preserved (no absorption):
 *   - Block / Hat / Pocket → paragraph → tag        (legitimate bridge text)
 *   - Doc start → paragraph → anything              (top-of-doc preface)
 *   - Heading → paragraph → heading                  (between sections)
 *
 * Why an appendTransaction plugin and not a schema constraint:
 * ProseMirror content expressions are context-free, so they can't say
 * "paragraph is illegal here only when the previous sibling is a card."
 * Absorption runs after every doc-changing transaction; it walks the
 * doc-level children once and rebuilds any cards / analytic_units that
 * need to grow.
 */

import { Plugin, TextSelection } from 'prosemirror-state';
import { Fragment, type Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema/index.js';
import { guardNormalizerTr } from './normalizer-guard.js';

const ABSORBING_TYPES = new Set(['card', 'analytic_unit']);

export const absorbPlugin: Plugin = new Plugin({
  appendTransaction(transactions, _oldState, newState) {
    if (!transactions.some((t) => t.docChanged)) return null;
    const regions = findAbsorbRegions(newState.doc);
    if (regions.length === 0) return null;
    const tr = newState.tr;
    // Apply right-to-left so each region's positions stay valid
    // through the in-flight transaction. Each region takes TWO
    // surgical steps:
    //   1. Insert the absorbed-bodies fragment INSIDE the
    //      absorbing card, just before its closing boundary.
    //   2. Delete the absorbed doc-level orphan paragraphs.
    // Surgical steps rather than a single
    // `replaceWith(0, doc.content.size, rebuilt)`: they never
    // touch the part of the card containing the cursor, so PM's
    // selection mapping leaves the cursor in place; a wholesale
    // replace maps cursors inside the replaced range to doc end,
    // rocketing the viewport there.
    //
    // One case the per-region steps don't cover: a cursor INSIDE
    // an orphan being absorbed. Step 2's `delete` claims the
    // cursor's range; PM's default assoc=1 mapping pushes it to
    // the END of the deletion (which auto-snaps to the last
    // textblock — the bottom of the now-absorbed card). Catch that
    // here and re-anchor manually: each absorbed orphan moves to
    // just before the card's closing boundary, so a position `P`
    // in the original orphan range corresponds to `P - 1` in the
    // final doc (one fewer doc-level boundary). The same delta
    // works for every orphan in a region because the orphans
    // absorb in document order into a single contiguous run
    // inside the card.
    const origHead = newState.selection.head;
    const origAnchor = newState.selection.anchor;
    let headInOrphans = false;
    let anchorInOrphans = false;
    try {
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i]!;
      if (origHead > r.orphansStart && origHead < r.orphansEnd) headInOrphans = true;
      if (origAnchor > r.orphansStart && origAnchor < r.orphansEnd) anchorInOrphans = true;
      const cardContentEnd = r.absorbingPos + r.absorbingNodeSize - 1;
      tr.insert(cardContentEnd, r.bodiesContent);
      const insertSize = r.bodiesContent.size;
      tr.delete(r.orphansStart + insertSize, r.orphansEnd + insertSize);
    }
    if (headInOrphans || anchorInOrphans) {
      const newHead = headInOrphans ? origHead - 1 : origHead;
      const newAnchor = anchorInOrphans ? origAnchor - 1 : origAnchor;
      const $head = tr.doc.resolve(newHead);
      const $anchor = tr.doc.resolve(newAnchor);
      tr.setSelection(TextSelection.between($anchor, $head));
    }
    } catch (err) {
      // A schema-invalid container mid-dispatch (Issue #34 fitter
      // shells) makes inserts throw contentMatchAt — skipping the
      // round beats aborting the dispatch; the container-integrity
      // normalizer heals first and absorb re-runs on the next round.
      console.warn('[absorb] skipped round on invalid doc:', err);
      return null;
    }
    return guardNormalizerTr(transactions, tr);
  },
});

interface AbsorbRegion {
  /** Doc position of the absorbing card / analytic_unit. */
  absorbingPos: number;
  /** Original `nodeSize` of the absorbing container (before the
   *  insert step grows it). */
  absorbingNodeSize: number;
  /** Doc position of the first absorbable doc-level orphan that
   *  belongs to this region (= just after the absorbing
   *  container). */
  orphansStart: number;
  /** Doc position just past the last absorbable doc-level
   *  orphan in this region. */
  orphansEnd: number;
  /** The absorbed bodies as a Fragment (already wrapped — bare
   *  paragraph orphans get converted into card_bodies; other
   *  absorbable types pass through). */
  bodiesContent: Fragment;
}

/** Walk the doc's top-level children and find each contiguous
 *  region where an absorbing container (card / analytic_unit) is
 *  followed by one or more absorbable doc-level siblings. The
 *  appendTransaction above uses this to surgically MOVE the
 *  orphans into the container (preserving cursor positions
 *  outside the moved range) rather than wholesale-replacing the
 *  doc content. */
function findAbsorbRegions(doc: PMNode): AbsorbRegion[] {
  const regions: AbsorbRegion[] = [];
  let cursor = 0; // doc-level offset from start
  let absorbing: PMNode | null = null;
  let absorbingPos = 0;
  let bodiesPieces: PMNode[] = [];
  let regionEndPos = 0;
  let firstOrphanPos = 0;

  function flush(): void {
    if (absorbing !== null && bodiesPieces.length > 0) {
      regions.push({
        absorbingPos,
        absorbingNodeSize: absorbing.nodeSize,
        orphansStart: firstOrphanPos,
        orphansEnd: regionEndPos,
        bodiesContent: Fragment.fromArray(bodiesPieces),
      });
    }
    absorbing = null;
    bodiesPieces = [];
  }

  doc.forEach((child) => {
    const childStart = cursor;
    const childEnd = cursor + child.nodeSize;
    const t = child.type.name;
    if (ABSORBING_TYPES.has(t)) {
      flush();
      absorbing = child;
      absorbingPos = childStart;
      firstOrphanPos = childEnd;
      regionEndPos = childEnd;
    } else if (absorbing === null) {
      // Outside any absorption zone — nothing to do.
    } else if (t === 'paragraph') {
      bodiesPieces.push(schema.nodes['card_body']!.create(null, child.content));
      regionEndPos = childEnd;
    } else if (
      t === 'cite_paragraph' ||
      t === 'undertag' ||
      t === 'card_body' ||
      t === 'table'
    ) {
      bodiesPieces.push(child);
      regionEndPos = childEnd;
    } else {
      // Anything else breaks the absorption zone.
      flush();
    }
    cursor = childEnd;
  });
  flush();

  return regions;
}

/**
 * Walk the doc's top-level children and produce a new Fragment with
 * loose paragraphs / cite_paragraphs absorbed into preceding card /
 * analytic_unit siblings. Returns `null` if no changes were necessary,
 * so callers can skip dispatching a no-op transaction.
 */
export function absorbedDocChildren(doc: PMNode): Fragment | null {
  const out: PMNode[] = [];
  let absorbing: PMNode | null = null;
  let absorbed: PMNode[] = [];
  let modified = false;

  function flush(): void {
    if (absorbing === null) return;
    if (absorbed.length === 0) {
      out.push(absorbing);
    } else {
      const merged = absorbing.copy(
        absorbing.content.append(Fragment.fromArray(absorbed)),
      );
      out.push(merged);
      modified = true;
    }
    absorbing = null;
    absorbed = [];
  }

  doc.forEach((child) => {
    const t = child.type.name;
    if (ABSORBING_TYPES.has(t)) {
      flush();
      absorbing = child;
      return;
    }
    if (absorbing === null) {
      out.push(child);
      return;
    }
    if (t === 'paragraph') {
      absorbed.push(schema.nodes['card_body']!.create(null, child.content));
      return;
    }
    if (
      t === 'cite_paragraph' ||
      t === 'undertag' ||
      t === 'card_body' ||
      t === 'table'
    ) {
      // All four are valid in both `card` and `analytic_unit` content
      // expressions (see the header's absorption type mapping), so
      // absorb regardless of container type.
      absorbed.push(child);
      return;
    }
    // Anything else breaks the absorption zone.
    flush();
    out.push(child);
  });
  flush();

  if (!modified) return null;
  return Fragment.fromArray(out);
}
