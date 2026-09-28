/**
 * Heading-id integrity guard — the systemic backstop behind every
 * per-path re-id (paste's freshHeadingIds, drag/dropzone/send's
 * rewriteHeadingIds, the split handlers' fresh ids).
 *
 * The workspace invariant (ARCHITECTURE §4/§12): every pocket / hat /
 * block / tag / analytic carries a unique, non-null id — the nav
 * pane's jump target, transclusion's anchor, the docx bookmark. Two
 * ProseMirror-internal doors mint violations that no per-path guard
 * can cover (field forensics 2026-08-31, reproduced at scale by
 * dev/heading-id-fuzz.mts):
 *
 *   - a replace whose fit SPLITS a heading (paste into the middle of
 *     a block header) copies the heading's attrs onto both halves —
 *     duplicate id;
 *   - a replace whose fit must close a card/analytic-unit shell
 *     synthesizes the required head via `fillBefore` with schema-
 *     default attrs — null id.
 *
 * This plugin appends a repair to the OFFENDING transaction itself:
 *
 *   - LOCAL transactions only. Anything the collab binding dispatched
 *     (loroSyncPluginKey meta) is skipped — policing remote peers'
 *     content mid-session would fight old-version clients edit-for-
 *     edit; their violations stay inert (exactly today's behavior)
 *     until the file's next open, where the load-chain dedupe heals
 *     them. Keeps mixed-version rooms convergent and calm.
 *   - Provenance-aware keeper: the node that carried an id BEFORE the
 *     transaction (its position mapped forward) keeps it; every other
 *     bearer is re-minted. So pasting a copy of a section ABOVE its
 *     original re-ids the COPY — nav jumps and live views keep
 *     pointing at the original. When no bearer maps back (both halves
 *     of a split are "new"), the first in document order keeps.
 *   - Cheap on the hot path: a step pre-filter skips any transaction
 *     whose replace slices carry no heading nodes AND stay inside a
 *     single textblock (= every plain keystroke) in O(step count).
 *     Only structural edits pay the document scan.
 */

import { Plugin } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { ReplaceStep, ReplaceAroundStep } from 'prosemirror-transform';
import type { Node as PMNode, Slice } from 'prosemirror-model';
import { Mapping } from 'prosemirror-transform';
import { HEADING_TYPE_NAMES, newHeadingId } from '../schema/ids.js';

/** loro-prosemirror's sync PluginKey, matched by its STRING form so
 *  this always-loaded module never imports the lazy Loro wasm chunk —
 *  `tr.getMeta` accepts the key string, and the binding stamps every
 *  transaction it dispatches with this key ('doc-changed' /
 *  'non-local-updates' / presence). PluginKey('loro-sync') stores
 *  metas under 'loro-sync$' (PM appends '$'); the guard's tests pin
 *  this string against the real loroSyncPluginKey.key. */
const LORO_SYNC_META = 'loro-sync$';

function sliceHasHeading(slice: Slice): boolean {
  let found = false;
  slice.content.descendants((n) => {
    if (HEADING_TYPE_NAMES.has(n.type.name)) { found = true; return false; }
    return !found;
  });
  return found;
}

/** Could this transaction possibly have minted an id violation?
 *  True only for replaces that carry heading nodes or cut across a
 *  textblock's bounds — a plain keystroke (inline slice, same-parent
 *  range) never qualifies. Errs toward true on anything unusual. */
function mayViolate(tr: Transaction, before: PMNode): boolean {
  if (!tr.docChanged) return false;
  for (const step of tr.steps) {
    if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) continue;
    const s = step as ReplaceStep & { from: number; to: number; slice: Slice };
    if (s.slice && sliceHasHeading(s.slice)) return true;
    if (s.from === s.to && (!s.slice || s.slice.content.size === 0)) continue;
    try {
      const $from = before.resolve(s.from);
      const $to = before.resolve(s.to);
      // Same textblock parent and both endpoints inside it → pure
      // inline edit; anything else may trigger fit/close machinery.
      if (!$from.parent.isTextblock || !$from.sameParent($to)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

export const headingIdGuardPlugin: Plugin = new Plugin({
  appendTransaction(trs, oldState: EditorState, newState: EditorState) {
    // Local-only: skip binding-dispatched (remote / sync) transactions.
    if (trs.some((tr) => tr.getMeta(LORO_SYNC_META) !== undefined)) return null;
    if (!trs.some((tr) => mayViolate(tr, oldState.doc))) return null;

    // Provenance: where each pre-existing id ENDS UP after these trs.
    const mapping = trs.length === 1 ? trs[0]!.mapping : (() => {
      // Compose into a FRESH Mapping — appending onto a transaction's
      // own mapping would corrupt that transaction.
      const acc = new Mapping();
      for (const t of trs) acc.appendMapping(t.mapping);
      return acc;
    })();
    const rightfulPos = new Map<string, number>();
    oldState.doc.descendants((n, pos) => {
      if (HEADING_TYPE_NAMES.has(n.type.name)) {
        const id = n.attrs['id'];
        if (typeof id === 'string' && id) rightfulPos.set(id, mapping.map(pos));
      }
      return true;
    });

    let fix: Transaction | null = null;
    const claimed = new Set<string>();
    const remint = (pos: number, node: PMNode): void => {
      fix ??= newState.tr;
      fix.setNodeMarkup(pos, null, { ...node.attrs, id: newHeadingId() }, node.marks);
    };
    newState.doc.descendants((n, pos) => {
      if (!HEADING_TYPE_NAMES.has(n.type.name)) return true;
      const id = n.attrs['id'];
      if (typeof id !== 'string' || !id) {
        remint(pos, n); // fit-synthesized head — stamp it
        return true;
      }
      if (claimed.has(id)) {
        remint(pos, n); // a later bearer of an already-claimed id
        return true;
      }
      const rightful = rightfulPos.get(id);
      if (rightful !== undefined && rightful !== pos) {
        // The pre-transaction bearer mapped elsewhere — if that node
        // still holds the id there, THIS one is the copy.
        const atRightful = newState.doc.nodeAt(rightful);
        if (atRightful && atRightful.attrs['id'] === id && rightful > pos) {
          remint(pos, n);
          return true;
        }
      }
      claimed.add(id);
      return true;
    });
    return fix;
  },
});
