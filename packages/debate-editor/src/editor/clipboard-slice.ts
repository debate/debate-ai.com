/**
 * The one way to put document ranges on the clipboard.
 *
 * ProseMirror's own copy path runs the editor's `transformCopied` hook,
 * which materializes live views (`self_ref`) against the source document —
 * a view holds no cards of its own, so it cannot travel — and remembers
 * the link-bearing original so a paste back into the SAME document keeps
 * the link (clipboard-link-cache.ts). Several copy commands build their
 * clipboard HTML themselves with the bare schema serializer and skipped
 * all of that: the outline's Copy / Cut, Copy Current Heading, the
 * discontinuous copy, cut-in-place's payload. Since `self_ref` parses
 * back from its own DOM, those pastes landed a live view pointing at a
 * heading in the backfile — "Source section not found in this document"
 * (field reports, 2026-09-09). Every such command now goes through here.
 */
import { DOMSerializer, Fragment, Slice, type Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { newHeadingId } from '../schema/index.js';
import { flattenSelfRefsInSlice, fragmentHasSelfRef } from './self-transclusion.js';
import { fragmentHasZone } from './transclusion.js';
import { rememberLinkedCopy, clearLinkedCopy } from './clipboard-link-cache.js';

export interface DocRange {
  from: number;
  to: number;
}

/** The slice a copy of `[from, to]` puts on the clipboard: live views
 *  materialized against this document. Linked copies stay as they are —
 *  the paste side unwraps them (paste-plugin.ts). */
export function clipboardSlice(view: EditorView, range: DocRange): Slice {
  return flattenSelfRefsInSlice(view.state.doc.slice(range.from, range.to), view.state.doc, newHeadingId);
}

/** HTML + plain text for one or more ranges (concatenated in the order
 *  given), exactly as the editor's own copy would produce them, and with
 *  the same-document link preservation the editor's copy has: a paste back
 *  into this view restores the un-flattened original. */
export function serializeRangesForClipboard(view: EditorView, ranges: readonly DocRange[]): { html: string; text: string } {
  const serializer = view.someProp('clipboardSerializer') ?? DOMSerializer.fromSchema(view.state.schema);
  const tmp = document.createElement('div');
  const texts: string[] = [];
  let original = Fragment.empty;
  let clipboard = Fragment.empty;
  for (const range of ranges) {
    const raw = view.state.doc.slice(range.from, range.to);
    const flat = flattenSelfRefsInSlice(raw, view.state.doc, newHeadingId);
    tmp.appendChild(serializer.serializeFragment(flat.content));
    texts.push(flat.content.textBetween(0, flat.content.size, '\n', '\n'));
    original = original.append(raw.content);
    clipboard = clipboard.append(flat.content);
  }
  if (fragmentHasSelfRef(original) || fragmentHasZone(original)) {
    rememberLinkedCopy(new Slice(original, 0, 0), view, new Slice(clipboard, 0, 0));
  } else {
    clearLinkedCopy();
  }
  return { html: tmp.innerHTML, text: texts.join('\n') };
}

/** HTML + plain text for nodes that are not a range of the document —
 *  built or rewritten by a command (cards with their numbering cleared,
 *  say) — through the same serializer and live-view materialization as
 *  a range copy. Never a linked copy: the nodes are already copies. */
export function serializeNodesForClipboard(view: EditorView, nodes: readonly PMNode[]): { html: string; text: string } {
  const serializer = view.someProp('clipboardSerializer') ?? DOMSerializer.fromSchema(view.state.schema);
  const flat = flattenSelfRefsInSlice(new Slice(Fragment.from(nodes), 0, 0), view.state.doc, newHeadingId);
  const tmp = document.createElement('div');
  tmp.appendChild(serializer.serializeFragment(flat.content));
  clearLinkedCopy();
  return { html: tmp.innerHTML, text: flat.content.textBetween(0, flat.content.size, '\n', '\n') };
}
