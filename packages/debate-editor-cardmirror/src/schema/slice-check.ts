/**
 * Validated Slice reconstruction (structural-integrity audit, tier 2).
 *
 * `Slice.fromJSON` — like `nodeFromJSON` — validates NOTHING, and
 * ProseMirror's step machinery validates only the splice frontier: a
 * hollow node embedded as a CLOSED node in an inserted slice passes
 * `tr.insert`/`tr.replaceSelection` silently and lands in the live doc
 * invalid. Seven surfaces rebuild stored slice JSON (quick cards, the
 * dropzone shelf, the pairing inbox + Receive pill, speech-doc send) —
 * a corrupted payload at rest would re-inject forever, and the pairing
 * path carries it across machines.
 *
 * The guard mirrors the threat model exactly: CLOSED nodes get a full
 * recursive `node.check()`; nodes on the OPEN left/right spines are
 * legitimately partial (a copy from mid-card yields e.g. a card whose
 * open edge cut the tag away — the Fitter closes those on insertion),
 * so only their descent continues, with openness decreasing one level
 * per depth, matching Slice semantics.
 */

import { Slice, Fragment } from 'prosemirror-model';
import { schema } from './index.js';

function checkFragment(frag: Fragment, openStart: number, openEnd: number): void {
  frag.forEach((child, _offset, index) => {
    const onLeftSpine = index === 0 && openStart > 0;
    const onRightSpine = index === frag.childCount - 1 && openEnd > 0;
    if (!onLeftSpine && !onRightSpine) {
      child.check(); // closed node: full recursive validation
      return;
    }
    if (child.isText) return;
    checkFragment(
      child.content,
      onLeftSpine ? openStart - 1 : 0,
      onRightSpine ? openEnd - 1 : 0,
    );
  });
}

/** Parse slice JSON and validate it per the rules above. Throws (same
 *  error shapes as `Slice.fromJSON` / `Node.check`) on anything
 *  invalid — callers' existing bad-payload handling applies. */
export function checkedSliceFromJSON(json: unknown): Slice {
  const slice = Slice.fromJSON(schema, json as Parameters<typeof Slice.fromJSON>[1]);
  checkFragment(slice.content, slice.openStart, slice.openEnd);
  return slice;
}

/** Non-throwing variant for import-time filtering of stored payloads. */
export function sliceJsonIsValid(json: unknown): boolean {
  try {
    checkedSliceFromJSON(json);
    return true;
  } catch {
    return false;
  }
}
