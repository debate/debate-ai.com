/**
 * @fileoverview Shared files — pure validation/derivation helpers for the
 * user-facing shared-file library (`/library`'s "Shared Files" tab and the
 * Reason Editor's "Shared Files" sidebar panel) and its D1-backed
 * `/api/shared-files` routes in `apps/debate-ai.com`. The library is the
 * same `topic_starter_items` table that the admin-curated "Topic Starter"
 * evidence packs live in: an admin pack has no owner, a user-shared file
 * carries the sharing account's `ownerId`. See docs/features/shared-files.md.
 *
 * Kept framework/fetch-free, mirroring `state/savedFlows.ts`, so both the
 * routes and the UI agree on what a valid shared-file payload is without
 * duplicating logic, and so this can be unit-tested here —
 * `apps/debate-ai.com` has no vitest project of its own (see the root
 * `vitest.config.ts`'s `projects` list).
 *
 * @module state/sharedFiles
 */

/** One row of the shared-file library as `/api/shared-files` returns it. */
export interface SharedFileItem {
  id: number;
  title: string;
  content: string;
  parentId: number | null;
  isFolder: boolean;
  /** JSON-encoded string array, exactly as stored. Use {@link parseSharedFileTags}. */
  tags: string;
  published: boolean;
  /** `null` for an admin-curated Topic Starter pack; the sharing user's id otherwise. */
  ownerId: string | null;
  sourceDocumentId: number | null;
  updatedAt: string | number;
}

/** Hard cap on one shared file's HTML content, matching the Reason Editor's own document sizes comfortably while staying well under D1's row limit. */
export const MAX_SHARED_FILE_BYTES = 1_000_000;

/** Longest title accepted for a shared file or folder. */
export const MAX_SHARED_FILE_TITLE_LENGTH = 200;

/** Most tags one shared file can carry, and the longest each may be. */
export const MAX_SHARED_FILE_TAGS = 20;
export const MAX_SHARED_FILE_TAG_LENGTH = 40;

/** The fields a caller may send when creating or updating a shared file. */
export interface SharedFilePayload {
  title?: string;
  content?: string;
  tags?: string[];
  published?: boolean;
  parentId?: number | null;
  isFolder?: boolean;
}

/**
 * Parses the JSON-encoded `tags` column, tolerating malformed or non-array
 * values (which yield `[]`) so one bad row never breaks a list view.
 */
export function parseSharedFileTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Normalizes a free-form list of tags: trims, lowercases, drops empties
 * and duplicates, and caps count/length so a payload can't smuggle an
 * unbounded blob through the `tags` column.
 */
export function normalizeSharedFileTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().slice(0, MAX_SHARED_FILE_TAG_LENGTH);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= MAX_SHARED_FILE_TAGS) break;
  }
  return result;
}

/** Trims a title and falls back to a placeholder so a shared row is never blank. */
export function normalizeSharedFileTitle(title: string | undefined, isFolder = false): string {
  const trimmed = (title ?? "").trim().slice(0, MAX_SHARED_FILE_TITLE_LENGTH);
  return trimmed || (isFolder ? "New Folder" : "Untitled");
}

export type SharedFilePayloadValidation =
  | { ok: true; payload: SharedFilePayload }
  | { ok: false; error: string };

/**
 * Structural validator for an untrusted (parsed request-body) value
 * claiming to be a {@link SharedFilePayload}. Every field is optional —
 * `PUT` sends only what changed — but each present field must have the
 * right shape and stay within the size caps. Returns a normalized copy on
 * success (trimmed title, normalized tags) rather than mutating the input.
 */
export function validateSharedFilePayload(value: unknown): SharedFilePayloadValidation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const input = value as Record<string, unknown>;
  const payload: SharedFilePayload = {};

  if (input.title !== undefined) {
    if (typeof input.title !== "string") return { ok: false, error: "\"title\" must be a string." };
    payload.title = input.title;
  }
  if (input.content !== undefined) {
    if (typeof input.content !== "string") return { ok: false, error: "\"content\" must be a string." };
    if (input.content.length > MAX_SHARED_FILE_BYTES) {
      return { ok: false, error: "This file is too large to share." };
    }
    payload.content = input.content;
  }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || !input.tags.every((tag) => typeof tag === "string")) {
      return { ok: false, error: "\"tags\" must be an array of strings." };
    }
    payload.tags = normalizeSharedFileTags(input.tags as string[]);
  }
  if (input.published !== undefined) {
    if (typeof input.published !== "boolean") return { ok: false, error: "\"published\" must be a boolean." };
    payload.published = input.published;
  }
  if (input.parentId !== undefined) {
    if (input.parentId !== null && !Number.isInteger(input.parentId)) {
      return { ok: false, error: "\"parentId\" must be an integer or null." };
    }
    payload.parentId = input.parentId as number | null;
  }
  if (input.isFolder !== undefined) {
    if (typeof input.isFolder !== "boolean") return { ok: false, error: "\"isFolder\" must be a boolean." };
    payload.isFolder = input.isFolder;
  }
  return { ok: true, payload };
}

/** A shared-file row with its children attached, for tree rendering. */
export interface SharedFileNode<T extends Pick<SharedFileItem, "id" | "parentId" | "isFolder" | "title"> = SharedFileItem> {
  item: T;
  children: SharedFileNode<T>[];
}

/**
 * Builds a folder tree from a flat row list: folders first, then files,
 * each group alphabetized. A row whose `parentId` isn't in the list (e.g.
 * an unpublished parent folder the viewer can't see) is promoted to the
 * root so it never silently disappears.
 */
export function buildSharedFileTree<T extends Pick<SharedFileItem, "id" | "parentId" | "isFolder" | "title">>(
  items: readonly T[],
): SharedFileNode<T>[] {
  const ids = new Set(items.map((item) => item.id));
  const children = new Map<number | null, T[]>();
  for (const item of items) {
    const parent = item.parentId !== null && ids.has(item.parentId) ? item.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), item]);
  }
  const sortRows = (rows: T[]) =>
    [...rows].sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.title.localeCompare(b.title));
  const make = (parentId: number | null, seen: Set<number>): SharedFileNode<T>[] =>
    sortRows(children.get(parentId) ?? [])
      .filter((item) => !seen.has(item.id))
      .map((item) => {
        const next = new Set(seen).add(item.id);
        return { item, children: item.isFolder ? make(item.id, next) : [] };
      });
  return make(null, new Set());
}

/**
 * Every id under (and including) `rootId`, depth-first — what a delete of a
 * folder must remove, since the table has no self-referential cascade.
 * Cycles (a folder whose parent chain loops back on itself) terminate.
 */
export function collectSharedFileDescendantIds<T extends Pick<SharedFileItem, "id" | "parentId">>(
  items: readonly T[],
  rootId: number,
): number[] {
  const byParent = new Map<number, number[]>();
  for (const item of items) {
    if (item.parentId === null) continue;
    byParent.set(item.parentId, [...(byParent.get(item.parentId) ?? []), item.id]);
  }
  const result: number[] = [];
  const seen = new Set<number>();
  const visit = (id: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push(id);
    for (const child of byParent.get(id) ?? []) visit(child);
  };
  visit(rootId);
  return result;
}

/** The slash-joined folder path above a row (empty for a root-level row). */
export function sharedFilePath<T extends Pick<SharedFileItem, "id" | "parentId" | "title">>(
  items: readonly T[],
  id: number,
): string {
  const byId = new Map(items.map((item) => [item.id, item]));
  const segments: string[] = [];
  const seen = new Set<number>();
  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const parent = byId.get(current);
    if (!parent) break;
    segments.unshift(parent.title);
    current = parent.parentId;
  }
  return segments.join("/");
}

/**
 * Case-insensitive search over title, tags, and the folder path. An empty
 * query matches everything. Folders match when any descendant matches, so
 * a filtered tree keeps the path to each hit.
 */
export function filterSharedFiles<T extends Pick<SharedFileItem, "id" | "parentId" | "isFolder" | "title" | "tags">>(
  items: readonly T[],
  query: string,
): T[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...items];
  const byId = new Map(items.map((item) => [item.id, item]));
  const matches = new Set<number>();
  for (const item of items) {
    const haystack = `${item.title} ${parseSharedFileTags(item.tags).join(" ")} ${sharedFilePath(items, item.id)}`.toLowerCase();
    if (!haystack.includes(term)) continue;
    let current: T | undefined = item;
    const seen = new Set<number>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      matches.add(current.id);
      current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
  }
  return items.filter((item) => matches.has(item.id));
}

/** Whether `userId` may edit/unpublish/delete this row — only its owner can. */
export function canManageSharedFile(item: Pick<SharedFileItem, "ownerId">, userId: string | null): boolean {
  return Boolean(userId) && item.ownerId === userId;
}

/** Whether `userId` may read this row: published rows are public, unpublished ones are owner-only. */
export function canViewSharedFile(item: Pick<SharedFileItem, "ownerId" | "published">, userId: string | null): boolean {
  return item.published || canManageSharedFile(item, userId);
}

/** Splits a library listing into the viewer's own rows and everyone else's published rows. */
export function partitionSharedFiles<T extends Pick<SharedFileItem, "ownerId" | "published">>(
  items: readonly T[],
  userId: string | null,
): { mine: T[]; community: T[] } {
  const mine: T[] = [];
  const community: T[] = [];
  for (const item of items) {
    if (canManageSharedFile(item, userId)) mine.push(item);
    else if (item.published) community.push(item);
  }
  return { mine, community };
}
