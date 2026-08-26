/**
 * Quick Cards store — a reactive, persistent, cross-window library of
 * reusable rich-text snippets ("quick cards"). See
 * `reference-docs/SPEC-quick-cards.md`.
 *
 * Two backends, same surface (mirrors `dropzone-store.ts`, but this
 * library PERSISTS across sessions):
 *   - **Electron**: the canonical list lives in main, persisted to
 *     `{userData}/quick-cards.json`. Mutations flow through IPC;
 *     `quick-cards:changed` broadcasts keep every window's cache in
 *     sync. Survives app restarts (disk) and renderer reloads (main
 *     stays alive).
 *   - **Web**: the list lives in IndexedDB (large disk-fraction quota — a card
 *     library grows unbounded, past localStorage's ~5 MB) with a
 *     BroadcastChannel that live-syncs other same-origin tabs. Migrated once
 *     from the old `localStorage` backend on first load.
 *
 * The card DEFINITION is the durable, shareable unit; per-user
 * scheduling/retrieval state isn't part of a quick card. Content is a
 * serialized ProseMirror `Slice` (`Slice.toJSON()`), stored opaquely —
 * only the insert path parses it.
 */

import { getElectronHost } from './host/index.js';
import { WebSharedStore } from './web-shared-store.js';

export interface QuickCard {
  /** UUID minted at creation — stable identity. */
  id: string;
  /** Shortcut/label (default: the smallest enclosing heading text). */
  name: string;
  /** Organizing tags (display casing; may be empty). */
  tags: string[];
  /** `Slice.toJSON()` of the captured content. */
  contentJson: unknown;
  // ── Denormalized search keys (rebuilt whenever name/tags/content
  //    change). Kept on the record so the matcher never has to walk
  //    the slice JSON per keystroke. ──
  nameLower: string;
  tagsLower: string[];
  textLower: string;
  /** Filename of the doc it was captured from at creation; '' if the
   *  source was unsaved. Provenance, not a live link. */
  sourceName: string;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
}

type Listener = (cards: QuickCard[]) => void;

const STORAGE_KEY = 'pmd-quick-cards';

/** Canonical tag form for matching / equality (display keeps original
 *  casing). */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Order-independent equality key for a set of normalized tags — used
 *  by the duplicate-name check (a name may repeat only if its tag-set
 *  differs). JSON-encodes the sorted set so distinct tag-sets can't collide:
 *  a plain separator would, because normalized tags keep their internal spaces
 *  (e.g. `["a b"]` and `["a", "b"]` must stay distinct). */
export function tagSetKey(tagsLower: string[]): string {
  return JSON.stringify([...new Set(tagsLower)].sort());
}

/** Distinct tags across a card list (display casing kept from first
 *  occurrence), sorted for stable suggestion order. */
export function distinctTags(cards: QuickCard[]): string[] {
  const seen = new Map<string, string>(); // normalized -> display
  for (const c of cards) {
    for (const t of c.tags) {
      const n = normalizeTag(t);
      if (n && !seen.has(n)) seen.set(n, t);
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

/** Find an existing card with the same name AND identical tag-set —
 *  the duplicate the (name, tag-set) uniqueness rule forbids.
 *  `excludeId` skips a card being edited in place. */
export function findDuplicate(
  cards: QuickCard[],
  name: string,
  tags: string[],
  excludeId?: string,
): QuickCard | undefined {
  const nameLower = name.trim().toLowerCase();
  const key = tagSetKey(tags.map(normalizeTag));
  return cards.find(
    (c) =>
      c.id !== excludeId &&
      c.nameLower === nameLower &&
      tagSetKey(c.tagsLower) === key,
  );
}

/** Assemble a QuickCard, computing denormalized search keys +
 *  timestamps. Pass `id` + `createdAt` to update a card in place
 *  (manage edit); omit them for a brand-new card. */
export function buildQuickCard(input: {
  id?: string;
  name: string;
  tags: string[];
  contentJson: unknown;
  /** Plain-text of the content (for the search key). */
  plainText: string;
  sourceName: string;
  createdAt?: number;
}): QuickCard {
  const now = Date.now();
  // De-dup tags by normalized form, keeping first display casing.
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const t of input.tags) {
    const n = normalizeTag(t);
    if (n && !seen.has(n)) {
      seen.add(n);
      tags.push(t.trim());
    }
  }
  const name = input.name.trim();
  return {
    id: input.id ?? crypto.randomUUID(),
    name,
    tags,
    contentJson: input.contentJson,
    nameLower: name.toLowerCase(),
    tagsLower: tags.map(normalizeTag),
    textLower: input.plainText.toLowerCase(),
    sourceName: input.sourceName,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

class QuickCardsStore {
  private cards: QuickCard[] = [];
  private listeners: Set<Listener> = new Set();
  private hostUnsubscribe: (() => void) | null = null;
  private initialized = false;

  /** Eagerly load from whichever backend is active. Idempotent.
   *  Call once during renderer boot — every surface (add / search /
   *  manage / home) reads through this single cache. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const electron = getElectronHost();
    if (electron) {
      try {
        this.cards = await electron.quickCardsList();
      } catch {
        this.cards = [];
      }
      this.hostUnsubscribe = electron.onQuickCardsChanged((cards) => {
        this.cards = cards;
        this.fire();
      });
    } else {
      this.cards = await loadWebCards();
      webLibrary.onExternalChange(async () => {
        this.cards = sanitizeCards(await webLibrary.load());
        this.fire();
      });
    }
    this.fire();
  }

  /** Snapshot of the full library (unfiltered, unsorted — insertion
   *  order on web; main's order on Electron). Consumers sort/scope. */
  list(): QuickCard[] {
    return this.cards;
  }

  byId(id: string): QuickCard | undefined {
    return this.cards.find((c) => c.id === id);
  }

  /** Add-or-replace by id. Used by both Add (new card) and the manage
   *  surface's edit (existing card). */
  async upsert(card: QuickCard): Promise<void> {
    this.cards = [...this.cards.filter((c) => c.id !== card.id), card];
    const electron = getElectronHost();
    if (electron) {
      await electron.quickCardsUpsert(card);
    } else {
      void webLibrary.save(this.cards);
    }
    this.fire();
  }

  /** Bulk add-or-replace (import). One write / one broadcast. */
  async importMany(cards: QuickCard[]): Promise<void> {
    const incoming = new Map(cards.map((c) => [c.id, c]));
    this.cards = [...this.cards.filter((c) => !incoming.has(c.id)), ...cards];
    const electron = getElectronHost();
    if (electron) {
      await electron.quickCardsBulkUpsert(cards);
    } else {
      void webLibrary.save(this.cards);
    }
    this.fire();
  }

  async remove(id: string): Promise<void> {
    this.cards = this.cards.filter((c) => c.id !== id);
    const electron = getElectronHost();
    if (electron) {
      await electron.quickCardsRemove(id);
    } else {
      void webLibrary.save(this.cards);
    }
    this.fire();
  }

  async clear(): Promise<void> {
    this.cards = [];
    const electron = getElectronHost();
    if (electron) {
      await electron.quickCardsClear();
    } else {
      void webLibrary.save(this.cards);
    }
    this.fire();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private fire(): void {
    const snapshot = this.cards;
    for (const fn of this.listeners) fn(snapshot);
  }
}

const webLibrary = new WebSharedStore<QuickCard[]>(
  'quick-cards',
  'pmd-quick-cards-channel',
  'quick-cards library',
);

function sanitizeCards(raw: QuickCard[] | null): QuickCard[] {
  return Array.isArray(raw) ? raw.filter(isQuickCard) : [];
}

/** Web load: IndexedDB, migrating once from the old localStorage backend while
 *  IndexedDB is still empty, so existing libraries carry over on the upgrade. */
async function loadWebCards(): Promise<QuickCard[]> {
  const stored = sanitizeCards(await webLibrary.load());
  if (stored.length > 0) return stored;
  const legacy = readLegacyLocalCards();
  if (legacy.length > 0) {
    void webLibrary.save(legacy); // persist into IndexedDB from here on
    // localStorage is left intact as a safe fallback.
  }
  return legacy;
}

/** Legacy localStorage backend — read only for migration, never written. */
function readLegacyLocalCards(): QuickCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isQuickCard) : [];
  } catch {
    return [];
  }
}

/** Shape guard for tolerating malformed persisted entries. */
function isQuickCard(e: unknown): e is QuickCard {
  if (!e || typeof e !== 'object') return false;
  const c = e as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    Array.isArray(c.tags) &&
    typeof c.nameLower === 'string' &&
    Array.isArray(c.tagsLower) &&
    typeof c.textLower === 'string' &&
    typeof c.sourceName === 'string' &&
    typeof c.createdAt === 'number' &&
    typeof c.updatedAt === 'number'
  );
}

export const quickCardsStore = new QuickCardsStore();
