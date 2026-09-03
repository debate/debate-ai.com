/**
 * Comments plugin state.
 *
 * Thread data lives outside the document tree (the doc only carries
 * `comment_range` marks that reference thread IDs). The plugin owns
 * a `Map<threadId, Thread>` and exposes meta builders for the UI:
 * load (import time), add, reply, edit-text, delete-thread,
 * delete-comment, set-visible.
 *
 * Mutations always go through transactions with a `commentsKey` meta
 * payload so the undo history captures them. Threads whose mark has
 * disappeared from the doc (e.g. all marked text deleted) are
 * reconciled by `gcOrphanThreads`, which the host runs on idle.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';

export type CommentKind = 'human' | 'ai';

export interface Comment {
  /** OOXML-compatible numeric id. Allocated as a stringified integer
   *  on new comments; preserved verbatim when imported from docx. */
  id: string;
  /** Display name of the author. */
  author: string;
  /** Author initials (Word shows these in the margin badge). */
  initials: string;
  /** ISO 8601 timestamp. */
  date: string;
  /** Plain-text body for now. Rich-text bodies can come later. */
  text: string;
  /** Distinguishes the AI-explainer flow from regular user comments.
   *  Lost on docx export (Word has no concept); preserved within
   *  our own JSON serialization if we ship that later. */
  kind: CommentKind;
  /** `null` = root of the thread; otherwise the `id` of the comment
   *  this one replies to. Modern Word stores this via
   *  `word/commentsExtended.xml`'s paraId/paraIdParent linkage; we
   *  flatten that to a parent comment-id reference. */
  parentId: string | null;
  /** Thread resolved ("seen and acted on") — meaningful on the ROOT
   *  comment only; replies never carry it. Round-trips with Word as
   *  `w15:done` in commentsExtended.xml, the one comment primitive
   *  beyond replies the format durably supports. Optional so every
   *  existing save/export/collab payload stays valid. */
  resolved?: boolean;
}

export interface Thread {
  /** Same as the root comment's `id`. The `comment_range` mark
   *  references threads by this value. */
  id: string;
  /** Root comment first, then replies in chronological order. */
  comments: Comment[];
}

export interface CommentsState {
  threads: Map<string, Thread>;
  /** Threads the GC removed (their `comment_range` mark was gone) but
   *  kept around so an UNDO that restores the mark can resurrect the
   *  thread — the GC removal is non-undoable, so doc history alone can't
   *  bring the comment content back. Per-document (lives in plugin state,
   *  not a module global) so it can't leak across docs/panes; cleared on
   *  `load`. */
  tombstone: Map<string, Thread>;
  /** Mirrors `settings.commentsVisible` so the view can read this
   *  state directly without subscribing to the settings store. */
  visible: boolean;
}

export const commentsKey = new PluginKey<CommentsState>('comments');

/** Meta-payload shape for transactions that mutate the comments
 *  state. The plugin's `apply` reads these. */
export type CommentsMeta =
  | { type: 'load'; threads: Thread[] }
  | { type: 'add'; thread: Thread }
  | { type: 'add-batch'; threads: Thread[] }
  | { type: 'reply'; threadId: string; comment: Comment }
  | { type: 'edit-text'; threadId: string; commentId: string; text: string }
  | { type: 'delete-thread'; threadId: string }
  | { type: 'delete-comment'; threadId: string; commentId: string }
  | { type: 'set-resolved'; threadId: string; resolved: boolean }
  | { type: 'gc'; threads: Thread[]; tombstone: Thread[] }
  | { type: 'sync-load'; threads: Thread[] }
  | { type: 'set-visible'; visible: boolean };

export const commentsPlugin: Plugin<CommentsState> = new Plugin<CommentsState>({
  key: commentsKey,
  state: {
    init() {
      return { threads: new Map(), tombstone: new Map(), visible: false };
    },
    apply(tr, prev) {
      const meta = tr.getMeta(commentsKey) as CommentsMeta | undefined;
      if (!meta) return prev;
      switch (meta.type) {
        case 'load': {
          const threads = new Map<string, Thread>();
          for (const t of meta.threads) threads.set(t.id, t);
          // Fresh document — drop any tombstones from the previous one.
          return { ...prev, threads, tombstone: new Map() };
        }
        case 'gc': {
          const threads = new Map<string, Thread>();
          for (const t of meta.threads) threads.set(t.id, t);
          const tombstone = new Map<string, Thread>();
          for (const t of meta.tombstone) tombstone.set(t.id, t);
          return { ...prev, threads, tombstone };
        }
        case 'add': {
          // Seed the id counter from EVERY thread that enters state,
          // not just loads: a clipboard restore lands its thread via
          // this path, and without the bump the NEXT newCommentId()
          // could re-mint that exact id — the first duplicate made
          // after a cross-doc paste into a fresh doc collided with
          // the restored thread and fused with it (field report
          // 2026-08-05; first-time-only because the failed attempt
          // advanced the counter).
          seedCommentIdCounter([meta.thread]);
          const threads = new Map(prev.threads);
          threads.set(meta.thread.id, meta.thread);
          return { ...prev, threads };
        }
        case 'add-batch': {
          // Multiple threads in one transaction (a paste restoring the
          // comments of a copied section) — the meta slot holds one
          // payload per tr, so batching lives in the payload. Counter
          // seeding: see 'add'.
          seedCommentIdCounter(meta.threads);
          const threads = new Map(prev.threads);
          for (const t of meta.threads) threads.set(t.id, t);
          return { ...prev, threads };
        }
        case 'reply': {
          const threads = new Map(prev.threads);
          const t = threads.get(meta.threadId);
          if (t) {
            threads.set(meta.threadId, {
              ...t,
              comments: [...t.comments, meta.comment],
            });
          }
          return { ...prev, threads };
        }
        case 'edit-text': {
          const threads = new Map(prev.threads);
          const t = threads.get(meta.threadId);
          if (t) {
            threads.set(meta.threadId, {
              ...t,
              comments: t.comments.map((c) =>
                c.id === meta.commentId ? { ...c, text: meta.text } : c,
              ),
            });
          }
          return { ...prev, threads };
        }
        case 'delete-thread': {
          const threads = new Map(prev.threads);
          threads.delete(meta.threadId);
          return { ...prev, threads };
        }
        case 'delete-comment': {
          const threads = new Map(prev.threads);
          const t = threads.get(meta.threadId);
          if (t) {
            const comments = t.comments.filter((c) => c.id !== meta.commentId);
            // If we just removed the root, drop the whole thread —
            // the `comment_range` mark gets stripped separately by
            // the caller (otherwise the mark would point at
            // nothing).
            if (comments.length === 0 || (t.comments[0]?.id === meta.commentId)) {
              threads.delete(meta.threadId);
            } else {
              threads.set(meta.threadId, { ...t, comments });
            }
          }
          return { ...prev, threads };
        }
        case 'sync-load': {
          // Collab-session refresh: the shared thread map is the source
          // of truth FOR LIVE THREADS — one absent from the map was
          // deleted remotely, and delete beats local state. Parking is
          // different: it is local-only by design (seedFromView shares
          // only live threads, and gc metas are never mirrored), so a
          // parked thread ABSENT from the map was most likely never
          // shared at all — dropping it killed the resurrection path for
          // every pre-session parked thread (audit find, 2026-07-10).
          // Seed the tombstone from prev so those survive; parked threads
          // that ARE in the map get their content refreshed (a later
          // undo-resurrect shows partner replies).
          const threads = new Map<string, Thread>();
          const tombstone = new Map<string, Thread>(prev.tombstone);
          for (const t of meta.threads) {
            if (prev.tombstone.has(t.id)) tombstone.set(t.id, t);
            else threads.set(t.id, t);
          }
          return { ...prev, threads, tombstone };
        }
        case 'set-resolved': {
          const threads = new Map(prev.threads);
          const t = threads.get(meta.threadId);
          const root = t?.comments[0];
          if (t && root) {
            threads.set(meta.threadId, {
              ...t,
              comments: [{ ...root, resolved: meta.resolved }, ...t.comments.slice(1)],
            });
          }
          return { ...prev, threads };
        }
        case 'set-visible':
          return { ...prev, visible: meta.visible };
      }
    },
  },
  // No appendTransaction GC here: the orphan walk is O(doc), too
  // costly per keystroke on big commented docs. Instead,
  // dispatchTransaction in editor/index.ts schedules `gcOrphanThreads`
  // via `scheduleHeavyUpdate` (200ms idle debounce), and Save As
  // flushes it synchronously before reading thread state so exports
  // don't include orphans even if the user saves mid-burst.
});

/**
 * Reconcile plugin state with the doc's live `comment_range` marks:
 * threads whose mark is gone are parked in the tombstone map, and
 * tombstoned threads whose mark reappeared (undo/redo/paste) are
 * resurrected — dispatched as one `gc` meta. No-op when nothing
 * changed. Exported so editor/index.ts can trigger it from a
 * debounced idle callback (and from the Save As flow to flush
 * before export).
 */
export function gcOrphanThreads(view: { state: EditorState; dispatch: (tr: Transaction) => void }): void {
  const state = commentsKey.getState(view.state);
  if (!state) return;
  const tombstone = state.tombstone ?? new Map<string, Thread>();
  // Nothing tracked and nothing parked → nothing to reconcile (skips the
  // O(doc) walk on docs with no comments).
  if (state.threads.size === 0 && tombstone.size === 0) return;

  const liveIds = collectLiveThreadIds(view.state.doc);
  const nextThreads = new Map(state.threads);
  const nextTombstone = new Map(tombstone);
  let changed = false;

  // Resurrect: a tombstoned thread whose `comment_range` mark is live
  // again — i.e. an undo/redo/paste brought the anchor back.
  for (const id of liveIds) {
    if (!nextThreads.has(id)) {
      const parked = nextTombstone.get(id);
      if (parked) {
        nextThreads.set(id, parked);
        nextTombstone.delete(id);
        changed = true;
      }
    }
  }
  // Tombstone-and-drop: a tracked thread whose mark is gone. Park it (not
  // discard) so a later undo can resurrect it.
  for (const [id, thread] of state.threads) {
    if (!liveIds.has(id)) {
      nextThreads.delete(id);
      nextTombstone.set(id, thread);
      changed = true;
    }
  }
  if (!changed) return;

  const tr = view.state.tr.setMeta(commentsKey, {
    type: 'gc',
    threads: [...nextThreads.values()],
    tombstone: [...nextTombstone.values()],
  });
  tr.setMeta('addToHistory', false);
  view.dispatch(tr);
}

function collectLiveThreadIds(doc: PMNode): Set<string> {
  const ids = new Set<string>();
  doc.descendants((node) => {
    // Text carries comment marks on its chars; images (inline atoms)
    // carry them on the node itself.
    if (!node.isText && node.type.name !== 'image') return;
    for (const mark of node.marks) {
      if (mark.type.name === 'comment_range') {
        const id = String(mark.attrs['threadId'] ?? '');
        if (id) ids.add(id);
      }
    }
  });
  return ids;
}

// ----------------------- helpers / commands ----------------------

/** Generate a fresh comment id. Stringified integers keep round-trip with
 *  Word's `w:id` (a non-negative 32-bit integer) trivial — the counter
 *  starts small and is advanced past any loaded ids (see
 *  `seedCommentIdCounter`) rather than seeded from `Date.now()`, whose
 *  ~1.7e12 values overflow int32 into ids Word can't represent. */
let commentIdCounter = 0;
const issuedSessionIds = new Set<string>();

/** Per-doc session-scope resolver, set by the editor host. When it returns true
 *  for the doc a comment is being created in, `newCommentId` allocates a random
 *  id instead of an incremented one: two peers advancing the same small-integer
 *  counter WILL collide on concurrent new comments (same map key → one thread
 *  clobbers the other on merge). Random ids stay in Word's int32 `w:id` range
 *  (capped below int32 max, with headroom to keep incrementing afterwards).
 *
 *  Per-doc (not a window-global flag): a NON-co-edited doc open alongside a
 *  co-edited one in a multi-pane window still gets clean sequential ids. Comment
 *  creation always targets the active doc, so the resolver tests THAT doc. */
let sessionIdResolver: (() => boolean) | null = null;
export function setCommentIdSessionResolver(fn: (() => boolean) | null): void {
  sessionIdResolver = fn;
}

/** Drop the issued-random-id dedup set — called when the last session ends so
 *  it doesn't grow across the app's lifetime. */
export function resetSessionCommentIds(): void {
  issuedSessionIds.clear();
}

export function newCommentId(): string {
  if (sessionIdResolver?.()) {
    for (;;) {
      const id = String(1_000_000 + Math.floor(Math.random() * 1_999_000_000));
      if (!issuedSessionIds.has(id)) {
        issuedSessionIds.add(id);
        // Deliberately NOT bumping the sequential counter: the random range
        // starts at 1,000,000 precisely so the two ranges can't collide, and
        // bumping pushed every later sequential id (in EVERY doc — the
        // counter is window-global) past a billion (audit find, 2026-07-10).
        return id;
      }
    }
  }
  commentIdCounter += 1;
  return String(commentIdCounter);
}

/** Advance the id counter past every id already in `threads` so a
 *  freshly-created comment never collides with an imported/loaded one.
 *  Called whenever threads are loaded into a view. */
function seedCommentIdCounter(threads: Thread[]): void {
  for (const t of threads) {
    bumpCommentIdCounter(t.id);
    for (const c of t.comments) bumpCommentIdCounter(c.id);
  }
}
function bumpCommentIdCounter(id: string): void {
  const n = Number.parseInt(id, 10);
  if (Number.isFinite(n) && n > commentIdCounter) commentIdCounter = n;
}

/** Apply a `load` transaction. Used right after importing a docx to
 *  populate plugin state with the parsed threads. */
export function loadThreads(state: EditorState, threads: Thread[]): Transaction {
  seedCommentIdCounter(threads);
  return state.tr.setMeta(commentsKey, { type: 'load', threads }).setMeta('addToHistory', false);
}

/** Apply a `sync-load` transaction — collab refresh from the shared
 *  thread map. Keeps tombstones (see the apply case); still seeds the
 *  id counter so counter-mode allocation after the session ends can't
 *  collide with partner-created ids. */
export function syncLoadThreads(state: EditorState, threads: Thread[]): Transaction {
  seedCommentIdCounter(threads);
  return state.tr
    .setMeta(commentsKey, { type: 'sync-load', threads })
    .setMeta('addToHistory', false);
}

/** Read-only accessor — the side column UI calls this to render. */
export function getCommentsState(state: EditorState): CommentsState {
  return (
    commentsKey.getState(state) ?? { threads: new Map(), tombstone: new Map(), visible: false }
  );
}

/** Build a `meta` payload to add a new thread. Caller is responsible
 *  for also applying the `comment_range` mark to the selected text. */
export function addThreadsMeta(threads: Thread[]): CommentsMeta {
  return { type: 'add-batch', threads };
}

export function addThreadMeta(thread: Thread): CommentsMeta {
  return { type: 'add', thread };
}

export function addReplyMeta(threadId: string, comment: Comment): CommentsMeta {
  return { type: 'reply', threadId, comment };
}

export function editCommentTextMeta(
  threadId: string,
  commentId: string,
  text: string,
): CommentsMeta {
  return { type: 'edit-text', threadId, commentId, text };
}

export function setResolvedMeta(threadId: string, resolved: boolean): CommentsMeta {
  return { type: 'set-resolved', threadId, resolved };
}

export function deleteThreadMeta(threadId: string): CommentsMeta {
  return { type: 'delete-thread', threadId };
}

export function deleteCommentMeta(threadId: string, commentId: string): CommentsMeta {
  return { type: 'delete-comment', threadId, commentId };
}

export function setCommentsVisibleMeta(visible: boolean): CommentsMeta {
  return { type: 'set-visible', visible };
}
