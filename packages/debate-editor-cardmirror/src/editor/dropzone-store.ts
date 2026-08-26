/**
 * Dropzone shelf store — a small reactive store for the scratch-space items
 * that the dropzone bubble visualizes.
 *
 * Two backends, same surface:
 *   - **Electron**: state lives in main, mutations flow through IPC,
 *     `dropzone:changed` broadcasts keep every window's local cache in sync.
 *     Session-scoped (cleared on app quit).
 *   - **Web**: state lives in IndexedDB (large disk-fraction quota — the shelf
 *     can hold image-bearing cards that would blow past localStorage's ~5 MB),
 *     BroadcastChannel-synced across same-origin tabs. Kept SESSION-SCOPED like
 *     the Electron shelf: on the first tab of a fresh browser session (no other
 *     tab answers a presence ping) the stale shelf is cleared, so it doesn't
 *     survive a full close-and-reopen — but it IS shared across tabs open at the
 *     same time.
 *
 * Subscribers are notified on every state change. The renderer UI
 * (dropzone-ui.ts) is the only intended consumer.
 */

import type { Slice } from 'prosemirror-model';
import { collectCiteText } from './headings.js';
import { getElectronHost } from './host/index.js';
import { WebSharedStore } from './web-shared-store.js';

export interface DropzoneItem {
  id: string;
  label: string;
  /** Source schema-node type for the badge color. One of the
   *  values DragItem.type uses: pocket / hat / block / tag /
   *  analytic / card / analytic_unit, or `'text'` for an inline
   *  selection slice, or `''` when unknown. */
  type: string;
  /** Serialized PM Slice (via `Slice.toJSON()`). Stored opaquely
   *  here — only the UI / drag code parses it. */
  sliceJson: unknown;
  createdAt: number;
}

type Listener = (items: DropzoneItem[]) => void;

const webShelf = new WebSharedStore<DropzoneItem[]>(
  'dropzone-items',
  'pmd-dropzone-channel',
  'dropzone shelf',
);

// Per-tab marker: sessionStorage survives an in-tab RELOAD (the multi-pane
// toggle) but is cleared on tab close, so a present marker means this tab has
// already run this session — i.e. we're reloading, not starting fresh.
const SESSION_MARKER = 'pmd-dropzone-session';

// Presence channel — lets a newly-opened tab detect whether ANY other tab has
// the app open, so a fresh browser session (no peers) can clear the stale
// scratch shelf. Keeps the shelf cross-TAB but not cross-SESSION, matching the
// Electron dropzone (which clears on app quit).
const presenceChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('pmd-dropzone-presence')
    : null;
presenceChannel?.addEventListener('message', (e: MessageEvent) => {
  if (e.data === 'ping') presenceChannel?.postMessage('pong');
});

/** Resolve true if another tab answers a presence ping within a short window. */
function anyPeerTabOpen(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!presenceChannel) {
      resolve(false);
      return;
    }
    let settled = false;
    const onPong = (e: MessageEvent): void => {
      if (settled || e.data !== 'pong') return;
      settled = true;
      presenceChannel?.removeEventListener('message', onPong);
      resolve(true);
    };
    presenceChannel.addEventListener('message', onPong);
    presenceChannel.postMessage('ping');
    setTimeout(() => {
      if (settled) return;
      settled = true;
      presenceChannel?.removeEventListener('message', onPong);
      resolve(false);
    }, 200);
  });
}

class DropzoneStore {
  private items: DropzoneItem[] = [];
  private listeners: Set<Listener> = new Set();
  private hostUnsubscribe: (() => void) | null = null;
  private initialized = false;

  /** Eagerly load from whichever backend is active. Idempotent. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const electron = getElectronHost();
    if (electron) {
      // Pull the current main-process state, then subscribe so we
      // stay in sync as other windows mutate.
      try {
        this.items = await electron.dropzoneList();
      } catch {
        this.items = [];
      }
      this.hostUnsubscribe = electron.onDropzoneChanged((items) => {
        this.items = items;
        this.fire();
      });
    } else {
      // Web — IndexedDB + BroadcastChannel. Clear a shelf left over from a
      // PREVIOUS session: if no other tab is open, this is a fresh browser
      // session and the scratch shelf shouldn't survive it. When a peer IS open,
      // join the shared shelf.
      const loaded = sanitizeItems(await webShelf.load());
      let sameTabReload = false;
      try {
        sameTabReload = sessionStorage.getItem(SESSION_MARKER) === '1';
        sessionStorage.setItem(SESSION_MARKER, '1');
      } catch {
        /* sessionStorage unavailable — fall back to the presence check alone */
      }
      // Clear only when this is a genuinely fresh browser session: a brand-new
      // tab (not a reload) AND no other tab currently open. Reloads and
      // concurrent tabs keep the shared shelf.
      if (loaded.length > 0 && !sameTabReload && !(await anyPeerTabOpen())) {
        this.items = [];
        void webShelf.save(this.items);
      } else {
        this.items = loaded;
      }
      webShelf.onExternalChange(async () => {
        this.items = sanitizeItems(await webShelf.load());
        this.fire();
      });
    }
    this.fire();
  }

  /** Snapshot of current items, in insertion order (most-recent
   *  add is last). UI displays newest first by reversing. */
  list(): DropzoneItem[] {
    return this.items;
  }

  async add(item: DropzoneItem): Promise<void> {
    this.items = [...this.items.filter((x) => x.id !== item.id), item];
    const electron = getElectronHost();
    if (electron) {
      // Optimistic local update above — main will broadcast back too, but the
      // UI feels snappier when this returns instantly.
      await electron.dropzoneAdd(item);
    } else {
      void webShelf.save(this.items);
    }
    this.fire();
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((x) => x.id !== id);
    const electron = getElectronHost();
    if (electron) {
      await electron.dropzoneRemove(id);
    } else {
      void webShelf.save(this.items);
    }
    this.fire();
  }

  async clear(): Promise<void> {
    this.items = [];
    const electron = getElectronHost();
    if (electron) {
      await electron.dropzoneClear();
    } else {
      void webShelf.save(this.items);
    }
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

/** Tolerate malformed / partial persisted entries — keep the well-shaped ones. */
function sanitizeItems(raw: DropzoneItem[] | null): DropzoneItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is DropzoneItem =>
        !!e &&
        typeof e === 'object' &&
        typeof e.id === 'string' &&
        typeof e.label === 'string' &&
        typeof e.createdAt === 'number',
    )
    .map((e) => ({ ...e, type: typeof e.type === 'string' ? e.type : '' }));
}

export const dropzoneStore = new DropzoneStore();

/** Compose the human-readable label for a shelf item from its
 *  slice. Per schema node type:
 *    - `card`: tag text + cite-marked tokens (same processing as
 *      the nav pane's cite-preview, via `collectCiteText`).
 *    - `analytic_unit`: the analytic heading text only.
 *    - `pocket` / `hat` / `block` / `analytic`: the heading's own
 *      text, NOT the textContent of everything underneath it.
 *    - everything else: first chunk of the slice's text content,
 *      whitespace-collapsed.
 *  Result is clipped to ~120 characters with an ellipsis. */
export function deriveDropzoneLabel(slice: Slice, type: string): string {
  const first = slice.content.firstChild;
  if (first && (type === 'card' || first.type.name === 'card')) {
    const tagText = first.firstChild?.textContent?.trim() ?? '';
    const cite = collectCiteText(first).trim();
    if (tagText && cite) return clip(`${tagText} | ${cite}`);
    if (tagText) return clip(tagText);
    if (cite) return clip(cite);
    return clip(first.textContent ?? '(card)');
  }
  if (first && (type === 'analytic_unit' || first.type.name === 'analytic_unit')) {
    const analytic = first.firstChild?.textContent?.trim() ?? '';
    return clip(analytic || first.textContent || '(analytic)');
  }
  // Top-level outline headings carry a subtree of cards / sub-
  // headings when dragged from the nav pane. Label off the heading
  // node's own inline text, not the subtree's flattened text.
  const headingTypes = new Set(['pocket', 'hat', 'block', 'analytic']);
  if (first && (headingTypes.has(type) || headingTypes.has(first.type.name))) {
    const headingText = first.textContent?.trim() ?? '';
    return clip(headingText || `(${type || first.type.name})`);
  }
  const text = slice.content.textBetween(0, slice.content.size, ' ', ' ').trim();
  return text ? clip(text) : `(${type || 'item'})`;
}

function clip(s: string): string {
  return s.length > 120 ? s.slice(0, 118) + '…' : s;
}
