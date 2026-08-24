/**
 * Comment integrity guard: the range a comment covers can only grow by
 * typing inside it.
 *
 * Every mechanism that duplicates document content — clipboard paste,
 * Alt-drag copies in the editor, nav-pane option-drag section copies,
 * dropzone-parked cards dragged back in, cards sent to yourself
 * through pairing, transclusion flattening, and whatever gets built
 * next — copies `comment_range` marks with it. Two spans carrying the
 * same threadId render as one comment stretched across everything
 * between them, and the clipboard plugin can only fix the paths it
 * sits on. Rather than chase each mechanism (the paste ladder alone
 * took two field reports), this guard enforces the invariant at the
 * only chokepoint every one of them shares: the transaction.
 *
 * On any local transaction whose steps INSERT comment-marked content
 * (mark-only steps like comment creation never trigger it), the guard
 * diffs each thread's spans against the old state's spans mapped
 * through the transaction:
 *
 *  - Span content that maps from the thread's old spans is the
 *    original — untouchable, including deletion splits (a split is
 *    not an expansion; both fragments keep their id).
 *  - New span content DISJOINT from the mapped original, where the
 *    thread is known here (live or tombstoned): a copy. It is re-ided
 *    to a fresh duplicate thread — Word's behavior, same as paste —
 *    with every comment id in the clone re-minted. Content butted up
 *    against the original is trimmed at the mapped boundary, so even
 *    an exactly-adjacent copy cannot fuse with it.
 *  - New span content whose thread nobody has — not live, not
 *    tombstoned, not just added, not staged by the clipboard plugin —
 *    is stripped. There is no comment to show, and an anchored
 *    highlight with nothing behind it is the original field bug. This
 *    is what makes cross-machine sends safe today: the send pipeline
 *    doesn't carry thread content, so received spans drop their marks
 *    instead of arriving as phantom comments.
 *  - If ALL of a thread's old spans vanished in the same transaction
 *    (drag-MOVE, structural reorder), the reappearing span keeps its
 *    id: a move is not a copy, and re-iding moves would churn ids on
 *    every nav-pane reorder.
 *
 * Skips: sync-origin transactions (remote content is already merged
 * fact — both replicas run this guard locally before their edits ship,
 * and re-writing remote content here would desynchronize), history
 * undo/redo (restoring a span is not duplicating it; the comments GC's
 * tombstone path owns resurrection), and threads added in the same
 * batch (that's creation, or the clipboard plugin's restore landing).
 *
 * Cost: the O(doc) span scan runs only when a step actually inserts
 * comment-marked content — never on ordinary typing outside comments.
 */

import { Plugin } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import type { Node as PMNode, Slice } from 'prosemirror-model';
import { schema } from '../schema/index.js';
import { isSyncOrigin } from './sync-origin.js';
import {
  commentsKey,
  getCommentsState,
  addThreadsMeta,
  newCommentId,
  type Thread,
} from './comments-plugin.js';
import { hasQueuedThreadAdd, cloneThreadUnder } from './comment-clipboard.js';

interface Range {
  from: number;
  to: number;
}

/** Contiguous comment spans per threadId, in document order. A
 *  comment crossing block boundaries legitimately yields several
 *  ranges — the guard compares range SETS, never assumes one. */
function collectCommentRanges(doc: PMNode): Map<string, Range[]> {
  const out = new Map<string, Range[]>();
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    for (const m of node.marks) {
      if (m.type.name !== 'comment_range') continue;
      const id = String(m.attrs['threadId'] ?? '');
      if (!id) continue;
      const arr = out.get(id) ?? [];
      const last = arr[arr.length - 1];
      if (last && last.to === pos) last.to = pos + node.nodeSize;
      else arr.push({ from: pos, to: pos + node.nodeSize });
      out.set(id, arr);
    }
    return true;
  });
  return out;
}

/** Does any step of `tr` insert slice content carrying a
 *  comment_range mark? Mark-only steps (AddMarkStep — comment
 *  creation) have no slice and never match. */
function insertsCommentMarks(tr: Transaction): boolean {
  for (const step of tr.steps) {
    const slice = (step as { slice?: Slice }).slice;
    if (!slice || slice.content.size === 0) continue;
    let found = false;
    slice.content.descendants((node) => {
      if (found) return false;
      if (node.isText && node.marks.some((m) => m.type.name === 'comment_range')) {
        found = true;
        return false;
      }
      return true;
    });
    if (found) return true;
  }
  return false;
}

/** Merge sorted-ish intervals into a disjoint sorted union. */
function unionize(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const out: Range[] = [];
  for (const r of sorted) {
    if (r.to <= r.from) continue;
    const last = out[out.length - 1];
    if (last && r.from <= last.to) last.to = Math.max(last.to, r.to);
    else out.push({ ...r });
  }
  return out;
}

/** The parts of `r` not covered by the disjoint sorted `union`. */
function subtract(r: Range, union: Range[]): Range[] {
  const out: Range[] = [];
  let cursor = r.from;
  for (const u of union) {
    if (u.to <= cursor) continue;
    if (u.from >= r.to) break;
    if (u.from > cursor) out.push({ from: cursor, to: Math.min(u.from, r.to) });
    cursor = Math.max(cursor, u.to);
    if (cursor >= r.to) break;
  }
  if (cursor < r.to) out.push({ from: cursor, to: r.to });
  return out;
}

export function commentGuardPlugin(): Plugin {
  return new Plugin({
    appendTransaction(trs, oldState, newState) {
      const candidates = trs.filter(
        (tr) =>
          tr.docChanged &&
          !isSyncOrigin(tr) &&
          // prosemirror-history stamps undo/redo transactions with its
          // plugin-key meta; restoring spans is not duplication.
          !tr.getMeta('history$') &&
          insertsCommentMarks(tr),
      );
      if (candidates.length === 0) return null;

      const oldRanges = collectCommentRanges(oldState.doc);
      const newRanges = collectCommentRanges(newState.doc);
      const oldComments = getCommentsState(oldState);
      const newComments = getCommentsState(newState);

      // Combined mapping across the whole batch — positions in
      // oldState.doc → positions in newState.doc.
      const maps = trs.flatMap((tr) => tr.mapping.maps);
      const mapThrough = (pos: number, assoc: -1 | 1): number =>
        maps.reduce((p, m) => m.map(p, assoc), pos);

      const markType = schema.marks['comment_range']!;
      const tr = newState.tr;
      const toAdd: Thread[] = [];
      let dirty = false;

      for (const [id, ranges] of newRanges) {
        // The clipboard plugin staged this id (restore or its own
        // pre-insert duplicate) — its thread is on the way.
        if (hasQueuedThreadAdd(id)) continue;
        const knownBefore = oldComments.threads.has(id) || oldComments.tombstone.has(id);
        const olds = oldRanges.get(id) ?? [];

        if (olds.length === 0) {
          if (knownBefore) {
            // Thread parked (tombstoned / span-less) and a span for it
            // reappeared via an insert: a copy of content captured
            // earlier (dropzone, etc.). Duplicate under a fresh id —
            // resurrection belongs to the tombstone/undo paths alone.
            reId(ranges, id);
          } else if (!newComments.threads.has(id)) {
            // Nobody has this thread and nothing in the batch added
            // it: a phantom span (comment-bearing content from a
            // pipeline that doesn't carry threads). Strip the mark.
            for (const r of ranges) tr.removeMark(r.from, r.to, markType);
            dirty = true;
          }
          // else: thread added this batch (creation / restore) — leave.
          continue;
        }

        // Tight mapping (shrink at insertion boundaries) so content
        // pasted EXACTLY adjacent to the original falls outside the
        // mapped image and gets trimmed off instead of fusing.
        const mappedUnion = unionize(
          olds.map((r) => ({ from: mapThrough(r.from, 1), to: mapThrough(r.to, -1) })),
        );
        const foreign = ranges.flatMap((r) => subtract(r, mappedUnion));
        if (foreign.length === 0) continue;
        const len = (rs: Range[]): number => rs.reduce((n, r) => n + (r.to - r.from), 0);
        if (len(foreign) === len(ranges)) {
          // Every bit of this thread's content is "foreign" — the old
          // spans were deleted in the same transaction. That's a MOVE
          // (drag reorder), not a copy: the span keeps its identity.
          continue;
        }
        reId(foreign, id);
      }

      function reId(segments: Range[], id: string): void {
        const source = newComments.threads.get(id) ?? newComments.tombstone.get(id);
        if (!source) return;
        const newId = newCommentId();
        toAdd.push(cloneThreadUnder(source, newId));
        for (const seg of segments) {
          if (seg.to <= seg.from) continue;
          tr.removeMark(seg.from, seg.to, markType);
          tr.addMark(seg.from, seg.to, markType.create({ threadId: newId }));
        }
        dirty = true;
      }

      if (toAdd.length > 0) tr.setMeta(commentsKey, addThreadsMeta(toAdd));
      return dirty || toAdd.length > 0 ? tr : null;
    },
  });
}
