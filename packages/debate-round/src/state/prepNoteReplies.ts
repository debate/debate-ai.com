/**
 * @fileoverview A threaded-reply comment thread on each `PrepNote` — closes
 * the "🔄 Strategy Sync Notes" bullet's "threaded replies on a note instead
 * of flat status" follow-up in TODO.md. Local-first persistence, mirroring
 * `debate-card-search`'s `state/dailyBestCardComments.ts` convention: a
 * reply is keyed by its own generated `id` (many replies can share a
 * `noteId`, one per `PrepNote`), so `listRepliesForNote` filters and sorts
 * oldest-first for a chronological thread.
 *
 * Unlike `dailyBestCardComments.ts`, this store has no account-sync
 * counterpart yet — `state/prepNotes.ts` itself isn't account-synced (see
 * `docs/features/prep-notes.md`'s Known gaps), so there's no `/api/`-backed
 * D1 table for this slice to sync replies into either.
 *
 * @module state/prepNoteReplies
 */

const STORAGE_KEY = "prepNoteReplies";

/** Hard cap on a single reply's rendered text length, enforced before it's ever stored. */
export const MAX_PREP_NOTE_REPLY_TEXT_LENGTH = 1000;

/** One reply posted to a `PrepNote`'s thread. */
export interface PrepNoteReply {
  id: string;
  /** The `PrepNote.id` this reply is attached to. */
  noteId: string;
  authorId: string;
  text: string;
  /** Post time, as epoch milliseconds. */
  postedAt: number;
}

function readAll(): PrepNoteReply[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrepNoteReply[]) : [];
  } catch {
    return [];
  }
}

function writeAll(replies: PrepNoteReply[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(replies));
}

function generateReplyId(): string {
  return `prep-note-reply-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Lists every persisted reply across every note, oldest first. */
export function listAllPrepNoteReplies(): PrepNoteReply[] {
  return [...readAll()].sort((a, b) => a.postedAt - b.postedAt);
}

/** Lists one note's reply thread, oldest first. */
export function listRepliesForNote(noteId: string): PrepNoteReply[] {
  return listAllPrepNoteReplies().filter((reply) => reply.noteId === noteId);
}

/** The number of replies posted to a note, for a "Replies (N)" toggle label. */
export function countRepliesForNote(noteId: string): number {
  return readAll().filter((reply) => reply.noteId === noteId).length;
}

/**
 * Posts a new reply to a note's thread, trimming `authorId`/`text` and
 * capping `text` at `MAX_PREP_NOTE_REPLY_TEXT_LENGTH`. Callers
 * (`panels/PrepNotesPanel.tsx`) are expected to reject blank text before
 * calling this — mirrors `state/dailyBestCardComments.ts#postDailyBestCardComment`'s
 * "trust the caller already validated" convention.
 */
export function postPrepNoteReply(input: { noteId: string; authorId: string; text: string }): PrepNoteReply {
  const reply: PrepNoteReply = {
    id: generateReplyId(),
    noteId: input.noteId,
    authorId: input.authorId.trim() || "Anonymous",
    text: input.text.trim().slice(0, MAX_PREP_NOTE_REPLY_TEXT_LENGTH),
    postedAt: Date.now(),
  };
  writeAll([...readAll(), reply]);
  return reply;
}

/** Deletes a persisted reply by id; a no-op if it isn't stored. */
export function deletePrepNoteReply(id: string): void {
  writeAll(readAll().filter((reply) => reply.id !== id));
}

/** Deletes every reply attached to a note — used when the note itself is deleted. */
export function deleteRepliesForNote(noteId: string): void {
  writeAll(readAll().filter((reply) => reply.noteId !== noteId));
}
