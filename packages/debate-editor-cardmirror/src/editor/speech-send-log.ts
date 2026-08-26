/**
 * Speech-send log — a listable HISTORY of what has actually landed in the
 * designated speech doc via `sendToSpeech` (see `speech-doc-send.ts`).
 *
 * CardMirror's speech-doc feature is a *pane-designation* model, not a
 * named-document registry: `speech-doc-registry.ts` marks one open editor
 * pane as "the speech doc," and `insertSpeechSlice` drops a live ProseMirror
 * slice straight into that pane's document. That model has no natural
 * concept of "list every speech document" — the speech doc IS just an open
 * Reason document. What it's missing is a durable, glanceable record of
 * *what got sent there*, independent of whichever pane happens to be
 * mounted right now. This module is that record.
 *
 * `insertSpeechSlice` is the single call point shared by an in-window send,
 * a cross-tab receive, and (were Electron wired up) a cross-window receive
 * — so logging once there, right after a successful dispatch, captures
 * every path without double-counting.
 *
 * Deliberately plain-text only (not the live doc / a serialized slice):
 * this is a lightweight audit trail for the `/speech-documents` page, not
 * a second copy of the document. No ProseMirror types appear in this file,
 * so it's safe to import from a plain page component without pulling in
 * the editor bundle.
 *
 * Persistence mirrors `dropzone-store.ts`'s web backend (IndexedDB via
 * `WebSharedStore`, BroadcastChannel-synced across tabs) with one
 * difference: this log is a durable history, not a scratch shelf, so
 * unlike the dropzone it is never cleared on a fresh session — only by an
 * explicit `clear()`. Web only, matching `speech-doc-registry.ts`'s own
 * `installSpeechDocResolver` precedent: this build is web-only, so there's
 * no Electron IPC backend here either.
 */

import { WebSharedStore } from './web-shared-store.js';

export interface SpeechSendLogEntry {
  id: string;
  /** Full plain text of what was inserted, trimmed. */
  text: string;
  /** Whitespace-collapsed, ~160-char preview of `text` for list display. */
  preview: string;
  /** Whether the send landed at the doc's end vs. at the cursor. */
  atEnd: boolean;
  sentAt: number;
}

export const MAX_SPEECH_SEND_LOG_ENTRIES = 200;
const PREVIEW_MAX_CHARS = 160;

/** Whitespace-collapsed, clipped one-line preview of `text`. Pure. */
export function buildSpeechSendPreview(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > PREVIEW_MAX_CHARS
    ? collapsed.slice(0, PREVIEW_MAX_CHARS - 1) + '…'
    : collapsed;
}

/** Build a log entry from the text that was actually inserted. Returns
 *  `null` for blank text (nothing meaningful to record) — mirrors the
 *  legacy `speechDocuments.ts`'s "null for blank text" block-build
 *  convention. `id` and `sentAt` are caller-supplied so this stays pure
 *  and deterministic for tests. */
export function buildSpeechSendLogEntry(
  text: string,
  atEnd: boolean,
  id: string,
  sentAt: number,
): SpeechSendLogEntry | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return { id, text: trimmed, preview: buildSpeechSendPreview(trimmed), atEnd, sentAt };
}

/** Append `entry`, evicting the oldest entries beyond `max`. Pure —
 *  no I/O. Order is insertion order (oldest first); callers display
 *  newest-first by reversing. */
export function appendSpeechSendLogEntry(
  log: SpeechSendLogEntry[],
  entry: SpeechSendLogEntry,
  max: number = MAX_SPEECH_SEND_LOG_ENTRIES,
): SpeechSendLogEntry[] {
  const next = [...log, entry];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Remove the entry with `id`, if present. Pure; no-op (same array
 *  contents, new reference) when `id` isn't found. */
export function removeSpeechSendLogEntry(
  log: SpeechSendLogEntry[],
  id: string,
): SpeechSendLogEntry[] {
  return log.filter((e) => e.id !== id);
}

/** Tolerate malformed / partial persisted entries — keep the well-shaped
 *  ones, same convention as `dropzone-store.ts`'s `sanitizeItems`. */
export function sanitizeSpeechSendLog(raw: unknown): SpeechSendLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is SpeechSendLogEntry =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as SpeechSendLogEntry).id === 'string' &&
      typeof (e as SpeechSendLogEntry).text === 'string' &&
      typeof (e as SpeechSendLogEntry).preview === 'string' &&
      typeof (e as SpeechSendLogEntry).atEnd === 'boolean' &&
      typeof (e as SpeechSendLogEntry).sentAt === 'number',
  );
}

type Listener = (entries: SpeechSendLogEntry[]) => void;

const webLog = new WebSharedStore<SpeechSendLogEntry[]>(
  'speech-send-log',
  'pmd-speech-send-log-channel',
  'speech-document history',
);

class SpeechSendLogStore {
  private items: SpeechSendLogEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private initPromise: Promise<void> | null = null;

  /** Load from IndexedDB and subscribe to cross-tab changes. Idempotent
   *  and safe to call repeatedly / concurrently — every caller shares
   *  the same in-flight promise, so the change subscription is only
   *  installed once. `add`/`remove`/`clear` all await this first, so a
   *  caller never needs to init() before mutating. */
  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.items = sanitizeSpeechSendLog(await webLog.load());
        webLog.onExternalChange(async () => {
          this.items = sanitizeSpeechSendLog(await webLog.load());
          this.fire();
        });
        this.fire();
      })();
    }
    return this.initPromise;
  }

  /** Snapshot of current entries, oldest first. UI displays newest
   *  first by reversing. */
  list(): SpeechSendLogEntry[] {
    return this.items;
  }

  async add(entry: SpeechSendLogEntry): Promise<void> {
    await this.init();
    this.items = appendSpeechSendLogEntry(this.items, entry);
    void webLog.save(this.items);
    this.fire();
  }

  async remove(id: string): Promise<void> {
    await this.init();
    this.items = removeSpeechSendLogEntry(this.items, id);
    void webLog.save(this.items);
    this.fire();
  }

  async clear(): Promise<void> {
    await this.init();
    this.items = [];
    void webLog.save(this.items);
    this.fire();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private fire(): void {
    for (const fn of this.listeners) fn(this.items);
  }
}

export const speechSendLogStore = new SpeechSendLogStore();
