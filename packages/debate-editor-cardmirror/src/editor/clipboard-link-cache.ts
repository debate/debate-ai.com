/**
 * Same-document clipboard link preservation.
 *
 * A live view (`self_ref`) or linked copy (`transclusion_ref`) can't travel a
 * clipboard round-trip carrying its link: a self_ref is a REFERENCE (its cards
 * aren't in the node, so cross-doc it must materialize), and a zone's ref is
 * doc-relative (meaningless in another doc). So copy always puts self-contained
 * PLAIN CARDS on the clipboard (self_refs flattened; zones flattened on paste),
 * which is right for a cross-doc / external paste.
 *
 * To ALSO keep the link on a SAME-doc paste — matching the drag behavior — we
 * stash the original, link-bearing slice here, keyed by the source view. A paste
 * back into that same view (identified by matching the clipboard slice's
 * signature, so pasting unrelated/external content doesn't trip it) restores the
 * original instead of the flattened clipboard content.
 */

import type { EditorView } from 'prosemirror-view';
import { type Slice } from 'prosemirror-model';

interface CopyRecord {
  /** The un-flattened slice, links intact. */
  original: Slice;
  /** The view it was copied from — a paste into the SAME view is same-doc. */
  view: EditorView;
  /** Signature of what actually went on the clipboard (the flattened slice), so
   *  a paste is matched to THIS copy and not to unrelated content. */
  sig: string;
}

let record: CopyRecord | null = null;

/** Text + top-level node-type sequence — stable across the clipboard's
 *  toDOM/parseDOM round-trip (which drops ids and open depths, but keeps text and
 *  structure), and distinctive enough to tell our copy from other pasted content. */
export function sliceSignature(slice: Slice): string {
  const types: string[] = [];
  slice.content.forEach((n) => types.push(n.type.name));
  return `${types.join(',')}␞${slice.content.textBetween(0, slice.content.size, ' ', ' ')}`;
}

/** Remember a link-bearing copy so a same-doc paste can restore it. `clipboard`
 *  is the flattened slice that actually reaches the clipboard (used for the
 *  match). */
export function rememberLinkedCopy(original: Slice, view: EditorView, clipboard: Slice): void {
  record = { original, view, sig: sliceSignature(clipboard) };
}

/** Forget any remembered copy (a link-less copy supersedes it). */
export function clearLinkedCopy(): void {
  record = null;
}

/** If `pasted` (into `view`) is our own link-bearing copy pasted back into the
 *  SAME document, return the original link-bearing slice; else null. */
export function recallLinkedCopy(view: EditorView, pasted: Slice): Slice | null {
  if (record && record.view === view && record.sig === sliceSignature(pasted)) {
    return record.original;
  }
  return null;
}
