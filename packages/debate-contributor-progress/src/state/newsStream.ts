/**
 * @fileoverview News Stream feed assembly + per-viewer read/like state.
 *
 * `buildNewsFeed` merges the caller's `extraItems` (new rounds, new caselist
 * files, forum activity and followed teams — all fetched by the app layer,
 * which can reach the APIs this package can't) with the one source this
 * package owns: Argument Library cards, posted as one digest per day.
 *
 * Read/like state is stored under its own `newsStreamViewerState` key,
 * per browser, and merged with the account copy by `mergeRemoteViewerState`.
 *
 * @module state/newsStream
 */

import { cleanArgBlockLabel, sortNewsFeed, type NewsItem } from "../lib/news-stream";
import { isEntryLive, listEvidenceLibraryEntries } from "@debate-ai/research-evidence/src/state/evidenceLibraryEntries";
import type { EvidenceLibraryEntry } from "@debate-ai/research-evidence/src/lib/shared-evidence-library";

/** Most days of Argument Library digests the feed shows. */
export const MAX_ARGUMENT_LIBRARY_DAYS = 3;

/** Most card labels one day's digest lists before "and N more". */
export const MAX_DIGEST_LABELS = 3;

/** Longest card-text preview a single-card digest shows. */
const PREVIEW_LENGTH = 160;

function preview(text: string): string {
  const flat = text.replace(/<<<[^>]*>>>/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…` : flat;
}

/** UTC `YYYY-MM-DD` of an epoch-ms timestamp. */
function dayKeyOf(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * One item per day new cards or analytic blocks went live in the Argument
 * Library, for the {@link MAX_ARGUMENT_LIBRARY_DAYS} most recent such days.
 * A busy import used to post every card on its own, burying everything else.
 */
export function argumentLibraryNews(): NewsItem[] {
  const live = listEvidenceLibraryEntries().filter(
    (entry): entry is EvidenceLibraryEntry & { createdAt: number } => entry.createdAt !== undefined && isEntryLive(entry.id),
  );
  const byDay = new Map<string, (EvidenceLibraryEntry & { createdAt: number })[]>();
  for (const entry of live) {
    const day = dayKeyOf(entry.createdAt);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, MAX_ARGUMENT_LIBRARY_DAYS)
    .map(([day, entries]) => {
      const newest = [...entries].sort((a, b) => b.createdAt - a.createdAt);
      const labels = [...new Set(newest.map((entry) => cleanArgBlockLabel(entry.argBlock)))];
      const shown = labels.slice(0, MAX_DIGEST_LABELS);
      const more = labels.length - shown.length;
      const count = entries.length;
      return {
        id: `argument-library-day-${day}`,
        category: "files" as const,
        title:
          count === 1
            ? `New in the Argument Library: ${shown[0]}`
            : `${count} new cards and blocks in the Argument Library`,
        body: count === 1 ? preview(newest[0].text) : shown.join("\n") + (more > 0 ? `\nand ${more} more` : ""),
        timestamp: newest[0].createdAt,
        href: "/research/cards/argument-library",
      };
    });
}

/**
 * Builds the News Stream feed: the caller's `extraItems` plus the Argument
 * Library digests, newest first. Safe during SSR — the library store returns
 * an empty list without `localStorage`.
 */
export function buildNewsFeed(extraItems: NewsItem[] = []): NewsItem[] {
  return sortNewsFeed([...extraItems, ...argumentLibraryNews()]);
}

const VIEWER_STATE_KEY = "newsStreamViewerState";

interface ViewerState {
  read: Record<string, true>;
  liked: Record<string, true>;
  /**
   * The `liked` id list the account row reported as of the last successful
   * {@link mergeRemoteViewerState} call — not shown in the UI, kept only so
   * that call can tell "another device unliked this since we last synced"
   * (present here, absent from the new remote fetch — safe to clear locally
   * too) apart from "this browser liked it and hasn't pushed yet" (never
   * part of a synced snapshot — must survive the merge). See
   * `mergeRemoteViewerState`'s docstring.
   */
  lastSyncedRemoteLiked?: string[];
}

function readViewerState(): ViewerState {
  if (typeof localStorage === "undefined") return { read: {}, liked: {} };
  try {
    const raw = localStorage.getItem(VIEWER_STATE_KEY);
    if (!raw) return { read: {}, liked: {} };
    const parsed = JSON.parse(raw);
    return {
      read: parsed && typeof parsed === "object" && parsed.read ? parsed.read : {},
      liked: parsed && typeof parsed === "object" && parsed.liked ? parsed.liked : {},
      lastSyncedRemoteLiked:
        parsed && typeof parsed === "object" && Array.isArray(parsed.lastSyncedRemoteLiked)
          ? parsed.lastSyncedRemoteLiked
          : undefined,
    };
  } catch {
    return { read: {}, liked: {} };
  }
}

function writeViewerState(state: ViewerState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(VIEWER_STATE_KEY, JSON.stringify(state));
}

/** Whether the viewer has marked this news item read. */
export function isNewsItemRead(id: string): boolean {
  return !!readViewerState().read[id];
}

/** Marks a news item read (idempotent). */
export function markNewsItemRead(id: string): void {
  const state = readViewerState();
  if (state.read[id]) return;
  state.read[id] = true;
  writeViewerState(state);
}

/** Whether the viewer has liked this news item. */
export function isNewsItemLiked(id: string): boolean {
  return !!readViewerState().liked[id];
}

/** Toggles the viewer's like on a news item, returning the new liked state. */
export function toggleNewsItemLiked(id: string): boolean {
  const state = readViewerState();
  if (state.liked[id]) {
    delete state.liked[id];
  } else {
    state.liked[id] = true;
  }
  writeViewerState(state);
  return !!state.liked[id];
}

/** Count of feed items the viewer hasn't marked read yet. */
export function countUnreadNewsItems(items: NewsItem[]): number {
  const state = readViewerState();
  return items.filter((item) => !state.read[item.id]).length;
}

/** The full list of item ids the viewer has read, for pushing to the account sync route (`lib/news-stream-sync.ts`'s `newsRead`). */
export function listReadIds(): string[] {
  return Object.keys(readViewerState().read);
}

/** The full list of item ids the viewer has liked, for pushing to the account sync route (`lib/news-stream-sync.ts`'s `newsLiked`). */
export function listLikedIds(): string[] {
  return Object.keys(readViewerState().liked);
}

/**
 * Merges a signed-in user's account-synced read/liked ids into this
 * browser's local viewer state — run on every hydrate (see
 * `NewsStreamPanel`'s optional `syncRemote.hydrate`, called once per mount,
 * i.e. once per page load/reload), not a full replacement: `read` ids are
 * still a pure union with local state, so an item already read in this
 * browser stays read even if the account row hasn't caught up yet.
 *
 * `liked` ids used to be union-only too, which meant unliking on one device
 * never cleared a like already merged onto another until that other
 * device's own next toggle overwrote the account row — the Known gap
 * `packages/debate-help-docs/content/docs/features/news-stream.mdx` used to
 * document. Fixed by tracking `lastSyncedRemoteLiked` (this browser's own
 * account row as of its last successful hydrate) alongside the local liked
 * set: an id that was part of that last-known-synced snapshot but is
 * missing from this fetch was confirmed liked before and confirmed unliked
 * since — safe to clear locally, since it can only mean another device's
 * unlike has landed server-side. An id liked locally that was *never* part
 * of a synced snapshot is a like this browser hasn't pushed yet (or whose
 * push failed) — reconciliation leaves it untouched, so it still survives a
 * merge exactly like an unconfirmed local `read` does.
 *
 * @returns Whether the *visible* read/liked state actually changed (so a
 *   caller can skip a redundant re-render when the merge only updated the
 *   internal sync snapshot, or was a no-op altogether).
 */
export function mergeRemoteViewerState(remote: { read?: string[]; liked?: string[] }): boolean {
  const state = readViewerState();
  let uiChanged = false;
  let needsWrite = false;

  for (const id of remote.read ?? []) {
    if (!state.read[id]) {
      state.read[id] = true;
      uiChanged = true;
      needsWrite = true;
    }
  }

  if (remote.liked !== undefined) {
    const remoteLiked = new Set(remote.liked);
    const previouslySynced = state.lastSyncedRemoteLiked ?? [];

    for (const id of remoteLiked) {
      if (!state.liked[id]) {
        state.liked[id] = true;
        uiChanged = true;
      }
    }
    for (const id of previouslySynced) {
      if (!remoteLiked.has(id) && state.liked[id]) {
        delete state.liked[id];
        uiChanged = true;
      }
    }

    const nextSynced = [...remoteLiked].sort();
    if (nextSynced.join("\u0000") !== [...previouslySynced].sort().join("\u0000")) {
      state.lastSyncedRemoteLiked = nextSynced;
      needsWrite = true;
    }
  }

  if (uiChanged || needsWrite) writeViewerState(state);
  return uiChanged;
}
