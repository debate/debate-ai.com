/**
 * Pairing inbox — the cards other machines have sent you. Backs the
 * Receive pill. Mirrors `quick-cards-store.ts` (dual-backend, reactive,
 * cross-window) but holds RECEIVED cards plus their provenance.
 *
 * Two backends, same surface:
 *   - **Electron**: the canonical list lives in the main process (the
 *     background poller adds to it), persisted to
 *     `{userData}/pairing-inbox.json`; `pairing:inbox-changed` broadcasts
 *     keep every window in sync. Survives reloads (main stays alive) and
 *     restarts (disk).
 *   - **Web (deferred v1)**: `localStorage` + a `storage` listener so the
 *     module is safe to load on the web edition; the web-side poller that
 *     would feed it is a later addition.
 *
 * `read` tracks whether the user has opened the Receive pill since a card
 * arrived — drives the unread badge and the "keep flashing" behavior.
 */

import { getElectronHost } from '../host/index.js';
import { settings } from '../settings.js';

export interface InboxItem {
  /** Local id minted on receipt — stable identity within this machine. */
  id: string;
  label: string;
  /** Schema node kind (card/tag/block/…), used for the row's type chip. */
  type: string;
  /** `Slice.toJSON()` of the card — parsed only on insert. */
  sliceJson: unknown;
  /** Sender's self-declared display name (may be empty). */
  senderName: string;
  /** Sender's pairing code — used to upgrade the label to your local
   *  nickname when the sender is a known partner. */
  senderCode: string;
  /** Optional group label the sender fanned this out through. */
  via?: string;
  /** Epoch ms this card landed in the inbox. */
  receivedAt: number;
  /** Whether the user has seen it (opened the Receive pill since). */
  read: boolean;
}

type Listener = (items: InboxItem[]) => void;

const STORAGE_KEY = 'pmd-pairing-inbox';

class InboxStore {
  private items: InboxItem[] = [];
  private listeners: Set<Listener> = new Set();
  private hostUnsubscribe: (() => void) | null = null;
  private settingsUnsubscribe: (() => void) | null = null;
  private lastBlockedKey = '';
  private initialized = false;

  /** Eagerly load from whichever backend is active. Idempotent. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const electron = getElectronHost();
    if (electron?.pairingInboxList) {
      try {
        this.ingest(await electron.pairingInboxList());
      } catch {
        this.items = [];
      }
      this.hostUnsubscribe =
        electron.onPairingInboxChanged?.((items) => {
          this.ingest(items);
          this.fire();
        }) ?? null;
    } else {
      this.ingest(readLocal());
      window.addEventListener('storage', (e) => {
        if (e.key !== STORAGE_KEY) return;
        this.ingest(readLocal());
        this.fire();
      });
    }
    // Re-render the inbox view when the block list changes, so blocking or
    // unblocking a sender hides/reveals their cards immediately — without a
    // new card having to arrive. Guard on the actual value so unrelated
    // settings changes (fonts, zoom, …) don't churn the pill.
    this.lastBlockedKey = blockedKey();
    this.settingsUnsubscribe = settings.subscribe(() => {
      const key = blockedKey();
      if (key === this.lastBlockedKey) return;
      this.lastBlockedKey = key;
      this.fire();
    });
    this.fire();
  }

  /** Adopt a fresh backend snapshot and record its senders into the recent-
   *  senders ledger BEFORE they can be consumed — a collaboration invite is
   *  deleted from the inbox on Join, so this is the only chance to remember
   *  who sent it for the "block a recent sender" list. */
  private ingest(items: InboxItem[]): void {
    this.items = items;
    recordRecentSenders(items);
  }

  /** Drop items whose sender is blocked. Blocked cards stay in the raw
   *  persisted list (so unblocking restores them) but never surface in any
   *  view — list, unread count, or subscriber snapshots. */
  private visible(items: InboxItem[]): InboxItem[] {
    return filterBlockedItems(items, settings.get('pairingBlockedCodes'));
  }

  /** Snapshot, newest-last (main/storage order), blocked senders removed.
   *  The UI reverses. */
  list(): InboxItem[] {
    return this.visible(this.items);
  }

  /** Count of visible cards the user hasn't seen yet (blocked excluded). */
  unreadCount(): number {
    let n = 0;
    for (const it of this.visible(this.items)) if (!it.read) n++;
    return n;
  }

  /** WEB receive path (web-mailbox): add freshly delivered cards. The
   *  desktop path never calls this — main owns ingest there and pushes
   *  via onPairingInboxChanged. Dedupe by id (a failed relay DELETE
   *  redelivers on the next poll). */
  addIncoming(fresh: InboxItem[]): void {
    const additions = fresh.filter((f) => !this.items.some((it) => it.id === f.id));
    if (additions.length === 0) return;
    this.items = [...additions, ...this.items];
    writeLocal(this.items);
    this.fire();
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((it) => it.id !== id);
    const electron = getElectronHost();
    if (electron?.pairingInboxRemove) {
      await electron.pairingInboxRemove(id);
    } else {
      writeLocal(this.items);
    }
    this.fire();
  }

  async clear(): Promise<void> {
    this.items = [];
    const electron = getElectronHost();
    if (electron?.pairingInboxClear) {
      await electron.pairingInboxClear();
    } else {
      writeLocal(this.items);
    }
    this.fire();
  }

  /** Mark every card seen — called when the Receive pill opens. Zeroes
   *  the unread count (and stops a "keep flashing" loop). No-op when
   *  nothing is unread, so opening an all-read pill doesn't churn IPC. */
  async markAllRead(): Promise<void> {
    if (this.unreadCount() === 0) return;
    this.items = this.items.map((it) => (it.read ? it : { ...it, read: true }));
    const electron = getElectronHost();
    if (electron?.pairingInboxMarkAllRead) {
      await electron.pairingInboxMarkAllRead();
    } else {
      writeLocal(this.items);
    }
    this.fire();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private fire(): void {
    const snapshot = this.visible(this.items);
    for (const fn of this.listeners) fn(snapshot);
  }
}

/** Normalize a code the way settings sanitize does (trim + strip all
 *  internal whitespace) so a blocked entry matches the `senderCode` stamped
 *  on an inbox item regardless of stray spaces. */
function normalizeCode(c: string): string {
  return c.trim().replace(/\s+/g, '');
}

/** Drop items whose sender code is blocked (compared after normalization).
 *  Type-agnostic, so it covers both received cards and room invites — both
 *  are inbox items carrying a `senderCode`. Returns the same array reference
 *  when nothing is blocked, so the common case allocates nothing. Exported
 *  for unit testing; the store calls it via `visible()`. */
export function filterBlockedItems(items: InboxItem[], blockedCodes: string[]): InboxItem[] {
  // Drop empty entries: an unsigned item (senderCode '') must never be
  // matched by a stray blank in the block list.
  const blocked = new Set(blockedCodes.map(normalizeCode).filter((c) => c.length > 0));
  if (blocked.size === 0) return items;
  return items.filter((it) => {
    const code = normalizeCode(it.senderCode);
    return code.length === 0 || !blocked.has(code);
  });
}

/** Stable key for the block list, used to detect real changes and skip
 *  re-firing on unrelated settings updates. */
function blockedKey(): string {
  return settings.get('pairingBlockedCodes').join('\n');
}

// ── Recent-senders ledger ────────────────────────────────────────────
// A persistent record of who has recently sent you a card OR a
// collaboration invite. Backs the "block a recent sender" list in
// Settings → Collaboration. It exists because the live inbox isn't enough:
// a collaboration invite is CONSUMED (removed) on Join, so by the time you
// go to block that person, the item — and its sender — is gone from the
// inbox. Recording the sender the moment the item arrives keeps them
// blockable afterward, and across restarts.

const RECENT_SENDERS_KEY = 'pmd-pairing-recent-senders';
const RECENT_SENDERS_CAP = 10;

export interface RecentSender {
  /** Sender's pairing code, as received. */
  code: string;
  /** Latest self-declared name seen for this code (may be ''). */
  name: string;
  /** Newest receivedAt seen for this code (epoch ms). */
  at: number;
}

/** Fold the senders of `items` into the ledger: deduped by normalized code
 *  (newest name + timestamp win), newest-first, capped. Items with no sender
 *  code are ignored — there's nothing to block. Pure; exported for tests. */
export function mergeRecentSenders(
  existing: RecentSender[],
  items: InboxItem[],
  cap = RECENT_SENDERS_CAP,
): RecentSender[] {
  const byCode = new Map<string, RecentSender>();
  for (const r of existing) {
    const code = normalizeCode(r?.code ?? '');
    if (code) byCode.set(code, { code: r.code, name: r.name ?? '', at: typeof r.at === 'number' ? r.at : 0 });
  }
  for (const it of items) {
    const code = normalizeCode(it.senderCode);
    if (!code) continue;
    const at = typeof it.receivedAt === 'number' ? it.receivedAt : 0;
    const incomingName = (it.senderName || '').trim();
    const prev = byCode.get(code);
    const name = incomingName && at >= (prev?.at ?? -1) ? incomingName : prev?.name || incomingName;
    byCode.set(code, { code: it.senderCode, name, at: Math.max(at, prev?.at ?? 0) });
  }
  return [...byCode.values()].sort((a, b) => b.at - a.at).slice(0, cap);
}

function readRecentSenders(): RecentSender[] {
  try {
    const raw = localStorage.getItem(RECENT_SENDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((r): r is RecentSender => !!r && typeof r.code === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Record the senders of freshly-loaded inbox items into the ledger. */
function recordRecentSenders(items: InboxItem[]): void {
  if (items.length === 0) return;
  try {
    localStorage.setItem(
      RECENT_SENDERS_KEY,
      JSON.stringify(mergeRecentSenders(readRecentSenders(), items)),
    );
  } catch {
    /* no localStorage / quota — the live inbox still covers current items */
  }
}

/** People who've recently sent you a card or a collaboration invite,
 *  newest-first — survives item removal and app restarts. */
/** Outline rank per node type — smaller = higher in the hierarchy.
 *  Mirrors the doc's flat sibling structure: a dragged block ships as
 *  [block, card, card…], all top-level in the slice. */
const HEADING_RANK: Record<string, number> = {
  pocket: 1,
  hat: 2,
  block: 3,
  card: 4,
  analytic_unit: 4,
};

/** How many THINGS an inbox item carries, for the ×N badge: the count
 *  of top-level nodes at the HIGHEST outline level present. A single
 *  block arrives as [block, card, card…] — that is ×1 block, not ×3;
 *  two blocks count 2 (their cards don't); three hats count the hats,
 *  not their blocks. A slice with no heading nodes at all (loose
 *  paragraphs bundled together) counts its nodes directly. Derived
 *  from the raw JSON — no schema parse, no wire field, so any sender
 *  version yields the right badge. */
export function inboxItemCardCount(item: Pick<InboxItem, 'sliceJson'>): number {
  const content = (item.sliceJson as { content?: unknown } | null)?.content;
  if (!Array.isArray(content) || content.length < 2) return 1;
  const ranks = content.map(
    (n) => HEADING_RANK[String((n as { type?: unknown } | null)?.type ?? '')] ?? 99,
  );
  const top = Math.min(...ranks);
  if (top === 99) return content.length; // no headings: plain nodes count
  return ranks.filter((r) => r === top).length;
}

export function recentSenders(): RecentSender[] {
  return readRecentSenders();
}

function readLocal(): InboxItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isInboxItem);
  } catch {
    return [];
  }
}

function writeLocal(items: InboxItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota / disabled — in-window cache still works */
  }
}

function isInboxItem(e: unknown): e is InboxItem {
  if (!e || typeof e !== 'object') return false;
  const c = e as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.label === 'string' &&
    typeof c.type === 'string' &&
    typeof c.senderCode === 'string' &&
    typeof c.receivedAt === 'number'
  );
}

export const inboxStore = new InboxStore();
