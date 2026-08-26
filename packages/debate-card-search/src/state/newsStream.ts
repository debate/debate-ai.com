/**
 * @fileoverview Persisted "read" state for the News Stream feature
 * (`lib/news-stream.ts`), mirroring the existing `contributions.ts`/
 * `sprintNotes.ts` localStorage-store convention: read ids are stored as a
 * plain string array, defaulting to empty (nothing read yet, so every
 * seeded item starts unread) and tolerating malformed/missing storage.
 *
 * @module state/newsStream
 */

import { NEWS_ITEMS, countUnreadNewsItems, type NewsItem } from "../lib/news-stream";

const STORAGE_KEY = "newsStreamReadIds";

function readAll(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeAll(ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/** The set of news item ids this browser has already marked read. */
export function getReadNewsItemIds(): Set<string> {
  return new Set(readAll());
}

/** Marks one news item read. Idempotent. */
export function markNewsItemRead(id: string): void {
  const ids = readAll();
  if (ids.includes(id)) return;
  writeAll([...ids, id]);
}

/** Marks every currently-seeded news item read. */
export function markAllNewsItemsRead(): void {
  writeAll(NEWS_ITEMS.map((item) => item.id));
}

/** Count of seeded items this browser hasn't read yet — for a badge. */
export function getUnreadNewsCount(): number {
  return countUnreadNewsItems(NEWS_ITEMS, getReadNewsItemIds());
}

export type { NewsItem };
