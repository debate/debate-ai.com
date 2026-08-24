/**
 * Comments travel with copied text.
 *
 * The `comment_range` mark always survived the clipboard (its toDOM
 * carries the threadId — that's why the faint yellow background
 * pasted), but the thread CONTENT lives in plugin state, not the doc,
 * so a paste into another document produced an anchored highlight with
 * no comment behind it (field report 2026-08-05). This plugin makes the
 * thread ride along:
 *
 *  - COPY: a custom clipboard serializer inlines the thread as JSON in
 *    a `data-pmd-thread` attribute on the comment span, read live from
 *    the copying view's comments state. The OS clipboard is the
 *    carrier, so cross-window and cross-document pastes work; an older
 *    build pasting this HTML simply ignores the attribute (today's
 *    behavior, gracefully).
 *  - PASTE: `transformPastedHTML` extracts the payloads into a
 *    short-lived stash and strips the attribute (the payload must
 *    never become doc content). `transformPasted` then rewrites the
 *    marks IN THE SLICE — before any insertion path touches the doc —
 *    and queues the threads; an appendTransaction adds each queued
 *    thread once its span is actually in the doc, via the ordinary
 *    add-thread meta, so undo, the collab mirror, and every
 *    serialization path see it like any user-created thread.
 *
 * A paste whose thread ALREADY EXISTS in the target doc (pasting a
 * commented span within one document, or pasting the same copy twice)
 * DUPLICATES the comment under a fresh id — Word's behavior — with
 * every comment id in the clone re-minted so exporter id maps stay
 * globally unique.
 *
 * Why slice-level rewriting: the first cut re-pointed marks in the
 * DOC after insertion, walking the paste transaction's step maps. The
 * app's paste ladder (card-fit and friends) can rebuild a whole
 * card_body as one replace step, so the "pasted range" covered the
 * PRE-EXISTING comment span too — the original got re-ided along with
 * the copy, its now-orphaned thread was GC'd, and the two same-id
 * spans rendered as one long comment (field report, same day).
 * Rewriting the slice cannot touch the original by construction: only
 * clipboard-borne content is renamed, wherever and however it lands.
 * Ordinary typing is untouchable for the same reason — it never goes
 * through transformPasted. Same-doc CUT + paste still resurrects the
 * parked thread via the comments GC's tombstone path: the cut span's
 * id is tombstoned, so the slice rewrite treats it as existing and
 * duplicates — each paste of a cut span gets its own live comment.
 */

import { Plugin } from 'prosemirror-state';
import { DOMSerializer, Fragment, Slice } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';
import type { Mark, Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema/index.js';
import {
  commentsKey,
  getCommentsState,
  addThreadsMeta,
  newCommentId,
  type Thread,
} from './comments-plugin.js';

export const THREAD_PAYLOAD_ATTR = 'data-pmd-thread';

/** Threads lifted off pasted HTML, awaiting the restore pass. Keyed by
 *  threadId; TTL'd so a stale stash can't resurrect long-gone content
 *  if the same id ever reappears by other means. */
const pastedThreads = new Map<string, { thread: Thread; at: number }>();
const STASH_TTL_MS = 60_000;

function pruneStash(): void {
  const cutoff = Date.now() - STASH_TTL_MS;
  for (const [id, v] of pastedThreads) if (v.at < cutoff) pastedThreads.delete(id);
}

/** The view whose selection is being copied RIGHT NOW. transformCopied
 *  runs before the clipboard serializer in ProseMirror's copy path, so
 *  this is always current when the serializer needs it. */
let copyingState: EditorState | null = null;

/** Clipboard serializer: stock schema serialization, except a
 *  comment_range span also carries its thread as JSON. Built once —
 *  the thread lookup closes over the copy-in-progress state above. */
function buildClipboardSerializer(): DOMSerializer {
  const base = DOMSerializer.fromSchema(schema);
  const marks = { ...base.marks };
  marks['comment_range'] = (mark: Mark) => {
    const threadId = String(mark.attrs['threadId'] ?? '');
    const thread = copyingState ? getCommentsState(copyingState).threads.get(threadId) : undefined;
    return [
      'span',
      {
        class: 'pmd-comment-range',
        'data-comment-id': threadId,
        ...(thread ? { [THREAD_PAYLOAD_ATTR]: JSON.stringify(thread) } : {}),
      },
      0,
    ];
  };
  return new DOMSerializer(base.nodes, marks);
}

/** Threads waiting for their span to land in the doc, keyed by (new)
 *  threadId. Populated by transformPasted; drained by the
 *  appendTransaction below; TTL'd so an aborted paste can't add a
 *  thread much later if its id somehow reappears. */
const queuedAdds = new Map<string, { thread: Thread; at: number }>();

function queueThreadAdd(thread: Thread): void {
  queuedAdds.set(thread.id, { thread, at: Date.now() });
}

function pruneQueue(): void {
  const cutoff = Date.now() - STASH_TTL_MS;
  for (const [id, v] of queuedAdds) if (v.at < cutoff) queuedAdds.delete(id);
}

/** Is a thread-add staged for this id? The comment guard consults
 *  this so it never strips or re-ids a span whose thread is arriving
 *  from the clipboard restore in the same batch. */
export function hasQueuedThreadAdd(id: string): boolean {
  pruneQueue();
  return queuedAdds.has(id);
}

/** Re-mint EVERY comment id in the clone (exporter id maps are keyed
 *  by comment id globally); remap reply parent links. Shared with the
 *  comment guard, which duplicates threads for non-clipboard copies. */
export function cloneThreadUnder(thread: Thread, newId: string): Thread {
  const idMap = new Map<string, string>([[thread.id, newId]]);
  for (const c of thread.comments) {
    if (!idMap.has(c.id)) idMap.set(c.id, newCommentId());
  }
  return {
    id: newId,
    comments: thread.comments.map((c) => ({
      ...c,
      id: idMap.get(c.id)!,
      parentId: c.parentId == null ? null : (idMap.get(c.parentId) ?? null),
    })),
  };
}

function renameMarksInFragment(frag: Fragment, rename: Map<string, string>): Fragment {
  const out: PMNode[] = [];
  frag.forEach((child) => {
    let node = child;
    if (child.isText) {
      let touched = false;
      const marks = child.marks.map((m) => {
        if (m.type.name !== 'comment_range') return m;
        const next = rename.get(String(m.attrs['threadId'] ?? ''));
        if (!next) return m;
        touched = true;
        return m.type.create({ threadId: next });
      });
      if (touched) node = child.mark(marks);
    } else if (child.content.size) {
      node = child.copy(renameMarksInFragment(child.content, rename));
    }
    out.push(node);
  });
  return Fragment.from(out);
}

export function commentClipboardPlugin(): Plugin {
  return new Plugin({
    props: {
      clipboardSerializer: buildClipboardSerializer(),
      transformCopied(slice, view) {
        // Only a bookmark: the serializer (which runs next, same copy)
        // reads the thread content off this state.
        copyingState = view.state;
        return slice;
      },
      transformPastedHTML(html) {
        if (!html.includes(THREAD_PAYLOAD_ATTR)) return html;
        try {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const spans = doc.querySelectorAll(`span[${THREAD_PAYLOAD_ATTR}]`);
          if (spans.length === 0) return html;
          pruneStash();
          for (const span of spans) {
            const raw = span.getAttribute(THREAD_PAYLOAD_ATTR);
            span.removeAttribute(THREAD_PAYLOAD_ATTR);
            if (!raw) continue;
            try {
              const thread = JSON.parse(raw) as Thread;
              if (thread && typeof thread.id === 'string' && Array.isArray(thread.comments)) {
                pastedThreads.set(thread.id, { thread, at: Date.now() });
              }
            } catch {
              /* malformed payload — the mark still pastes, threadless */
            }
          }
          return doc.body.innerHTML;
        } catch {
          return html; // parse failure — paste proceeds without restore
        }
      },
      transformPasted(slice, view) {
        if (pastedThreads.size === 0) return slice;
        pruneStash();
        // Which stashed ids does this slice actually carry?
        const carried = new Set<string>();
        const collect = (frag: Fragment): void => {
          frag.forEach((child) => {
            if (child.isText) {
              for (const m of child.marks) {
                if (m.type.name === 'comment_range') {
                  const id = String(m.attrs['threadId'] ?? '');
                  if (pastedThreads.has(id)) carried.add(id);
                }
              }
            }
            if (child.content.size) collect(child.content);
          });
        };
        collect(slice.content);
        if (carried.size === 0) return slice;

        const state = getCommentsState(view.state);
        // Fresh rename map PER PASTE: pasting the same copy twice
        // yields two independent duplicates (each paste = its own
        // comment, Word-style). The stash is not consumed.
        const rename = new Map<string, string>();
        for (const id of carried) {
          const stashed = pastedThreads.get(id)!;
          if (state.threads.has(id) || state.tombstone.has(id)) {
            // Thread already lives (or lived) here → the pasted copy
            // becomes a DUPLICATE under a fresh id.
            const newId = newCommentId();
            rename.set(id, newId);
            queueThreadAdd(cloneThreadUnder(stashed.thread, newId));
          } else {
            // First landing in this doc: restore under its own id.
            queueThreadAdd(JSON.parse(JSON.stringify(stashed.thread)) as Thread);
          }
        }
        if (rename.size === 0) return slice;
        return new Slice(
          renameMarksInFragment(slice.content, rename),
          slice.openStart,
          slice.openEnd,
        );
      },
    },
    appendTransaction(trs, _oldState, newState) {
      // Add each queued thread once its span is actually in the doc.
      // No positions, no uiEvent gating: the queue is only ever
      // populated by transformPasted (typing never goes through it),
      // and a queued thread is added iff a span referencing it exists
      // — so an aborted paste simply ages out of the queue. The
      // O(doc) scan runs only while the queue is non-empty, i.e. the
      // transaction right after a comment-bearing paste.
      if (queuedAdds.size === 0) return null;
      if (!trs.some((tr) => tr.docChanged)) return null;
      pruneQueue();
      if (queuedAdds.size === 0) return null;
      const inDoc = new Set<string>();
      newState.doc.descendants((node) => {
        if (node.isText) {
          for (const m of node.marks) {
            if (m.type.name === 'comment_range') inDoc.add(String(m.attrs['threadId'] ?? ''));
          }
        }
        return true;
      });
      const state = getCommentsState(newState);
      const toAdd: Thread[] = [];
      for (const [id, q] of queuedAdds) {
        if (!inDoc.has(id)) continue;
        queuedAdds.delete(id);
        if (!state.threads.has(id)) toAdd.push(q.thread);
      }
      if (toAdd.length === 0) return null;
      return newState.tr.setMeta(commentsKey, addThreadsMeta(toAdd));
    },
  });
}
