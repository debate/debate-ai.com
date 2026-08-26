/**
 * Live view CONTENT plugin — keeps each `self_ref`'s children equal to its
 * projected source, and enforces read-only.
 *
 * A live view now holds its mirrored section as REAL, id-less child content (so
 * native selection just works — no atom boundary). Those children are DERIVED,
 * not authored:
 *  - RE-DERIVE (appendTransaction + an initial pass on mount): whenever the
 *    source changes, replace a view's children with the projected source
 *    (`makeProjectionResolver`, ids blanked). Idempotent — a view whose children
 *    already match is skipped — `addToHistory:false`, and tagged so the read-only
 *    filter lets it through. The children are held OUT of collab sync (a
 *    loro-prosemirror patch makes `self_ref` sync childless), so every peer runs
 *    this LOCALLY against the shared source: the projection is never a CRDT value,
 *    so there is no concurrent-re-projection conflict to reconcile.
 *  - READ-ONLY (filterTransaction): reject any edit landing INSIDE a view (except
 *    the re-derive). The view is still selectable-across, deletable, and movable
 *    as a whole unit.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { Transaction, EditorState } from 'prosemirror-state';
import type { Node as PMNode, Fragment } from 'prosemirror-model';
import { isSelfRef, makeProjectionResolver } from './self-transclusion.js';
import { rewriteHeadingIdsInFragment } from './transclusion.js';

export const selfRefPluginKey = new PluginKey('selfRefContent');

/** Meta stamped on the plugin's own re-derive transaction: the read-only filter
 *  lets it through, and appendTransaction won't re-fire on its own output. */
export const SELF_REF_REDERIVE = 'selfRefRederive';

/** The content range `[from,to]` of the self_ref whose CONTENT contains `pos`, or
 *  null when `pos` isn't inside a live view. */
function enclosingSelfRefContent(doc: PMNode, pos: number): { from: number; to: number } | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (let d = $pos.depth; d > 0; d--) {
    if (isSelfRef($pos.node(d))) {
      const before = $pos.before(d);
      return { from: before + 1, to: before + $pos.node(d).nodeSize - 1 };
    }
  }
  return null;
}

/** Does any step edit the INTERIOR of a live view? Both endpoints inside the same
 *  view's content = an interior edit (the view node itself is untouched). A step
 *  that reaches out of the view (delete/move the whole unit) has an endpoint past
 *  the content, so it's allowed.
 *
 *  Each step is checked against `tr.docs[i]` — the doc that step actually
 *  applies to — NOT the pre-transaction doc: steps after the first are
 *  expressed in intermediate coordinates. Checking them all against the
 *  original doc rejected legitimate multi-step transactions whose later
 *  steps happened to land numerically inside a view's ORIGINAL span — a
 *  drag's delete-then-insert dropping just past a view (the insert,
 *  shifted down by the delete, read as an interior edit), and the undo of
 *  moving a view by less than its own size (the re-insert read as inside
 *  the not-yet-restored span), which silently killed the undo chain. */
function editsInsideView(tr: Transaction): boolean {
  for (let i = 0; i < tr.steps.length; i++) {
    const s = tr.steps[i] as unknown as { from?: number; to?: number };
    if (typeof s.from !== 'number' || typeof s.to !== 'number') continue;
    const doc = tr.docs[i]!;
    const range = enclosingSelfRefContent(doc, s.from);
    if (range && s.from >= range.from && s.to <= range.to) return true;
  }
  return false;
}

/** A transaction re-deriving every stale view's children, or null when all views
 *  already match their projected source. */
function rederiveTransaction(state: EditorState): Transaction | null {
  const doc = state.doc;
  const resolve = makeProjectionResolver(doc);
  const edits: { from: number; to: number; content: Fragment }[] = [];
  doc.descendants((node, pos) => {
    if (!isSelfRef(node)) return true;
    const target = rewriteHeadingIdsInFragment(
      resolve(String(node.attrs['source_heading_id'] ?? '')).content,
      () => '',
    );
    if (!node.content.eq(target)) edits.push({ from: pos + 1, to: pos + node.nodeSize - 1, content: target });
    return false; // a view's children hold no nested view (they're inlined) — don't descend
  });
  if (!edits.length) return null;
  const tr = state.tr;
  // High position first, so an earlier replacement never shifts a later one.
  for (const e of edits.sort((a, b) => b.from - a.from)) {
    tr.replaceWith(e.from, e.to, e.content);
  }
  tr.setMeta(SELF_REF_REDERIVE, true);
  tr.setMeta('addToHistory', false);
  return tr;
}

export function makeSelfRefPlugin(): Plugin {
  return new Plugin({
    key: selfRefPluginKey,
    filterTransaction(tr) {
      if (tr.getMeta(SELF_REF_REDERIVE)) return true;
      if (!tr.docChanged) return true;
      return !editsInsideView(tr);
    },
    appendTransaction(trs, _old, newState) {
      if (!trs.some((t) => t.docChanged)) return null;
      if (trs.some((t) => t.getMeta(SELF_REF_REDERIVE))) return null; // our own output
      return rederiveTransaction(newState);
    },
    view(editorView) {
      // No transaction fires on state init / load / a fresh collab peer receiving
      // a (childless) view — fill them once on mount.
      const tr = rederiveTransaction(editorView.state);
      if (tr) editorView.dispatch(tr);
      return {};
    },
  });
}
