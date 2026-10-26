import { and, desc, eq } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";
import { documents, practiceVsAiDebates, savedFlows, savedRounds } from "../database/schema";

type AccountDB = Awaited<ReturnType<typeof getDBFromContext>>;

/** Kinds whose individual rows can be listed and removed from Settings. */
export const ITEM_KINDS = ["docs", "flows", "rounds", "practiceRounds"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const isItemKind = (value: string): value is ItemKind => (ITEM_KINDS as readonly string[]).includes(value);

/** Rows per page of the Manage list; further pages are fetched with `offset`. */
export const MAX_ITEMS = 100;

/** Rows per kind in the bulk export archive; the archive is a backup, so it reaches much further than the list. */
export const EXPORT_MAX_ITEMS = 1000;

export interface SavedItem {
  /** Row key to pass back to delete: `id` for docs/practice, `clientId` for flows/rounds. */
  id: number;
  title: string;
  updatedAt: string;
  /** Where the item opens, when the app has a stable URL for it. */
  href: string | null;
}

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : new Date(0).toISOString());

/** Newest-first list of one kind of the caller's saved work (titles only, never content), at most `limit` rows after skipping `offset`. */
export async function listOwnSavedItems(db: AccountDB, userId: string, kind: ItemKind, limit = MAX_ITEMS, offset = 0): Promise<SavedItem[]> {
  switch (kind) {
    case "docs": {
      const rows: Array<{ id: number; title: string; updatedAt: Date | null }> = await db
        .select({ id: documents.id, title: documents.title, updatedAt: documents.updatedAt })
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.isFolder, false)))
        .orderBy(desc(documents.updatedAt), desc(documents.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => ({ id: r.id, title: r.title || "Untitled", updatedAt: iso(r.updatedAt), href: `/reason-editor?doc=${r.id}` }));
    }
    case "flows": {
      const rows: Array<{ id: number; label: string; updatedAt: Date | null }> = await db
        .select({ id: savedFlows.clientId, label: savedFlows.label, updatedAt: savedFlows.updatedAt })
        .from(savedFlows)
        .where(eq(savedFlows.userId, userId))
        .orderBy(desc(savedFlows.updatedAt), desc(savedFlows.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => ({ id: r.id, title: r.label || "Untitled flow", updatedAt: iso(r.updatedAt), href: `/debate?flowId=${r.id}` /* mirrors buildFlowOpenHref in @debate-ai/round */ }));
    }
    case "rounds": {
      const rows: Array<{ id: number; label: string; updatedAt: Date | null }> = await db
        .select({ id: savedRounds.clientId, label: savedRounds.label, updatedAt: savedRounds.updatedAt })
        .from(savedRounds)
        .where(eq(savedRounds.userId, userId))
        .orderBy(desc(savedRounds.updatedAt), desc(savedRounds.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => ({ id: r.id, title: r.label || "Untitled round", updatedAt: iso(r.updatedAt), href: null }));
    }
    case "practiceRounds": {
      const rows: Array<{ id: number; topic: string; botName: string; updatedAt: Date | null }> = await db
        .select({ id: practiceVsAiDebates.id, topic: practiceVsAiDebates.topic, botName: practiceVsAiDebates.botName, updatedAt: practiceVsAiDebates.updatedAt })
        .from(practiceVsAiDebates)
        .where(eq(practiceVsAiDebates.userId, userId))
        .orderBy(desc(practiceVsAiDebates.updatedAt), desc(practiceVsAiDebates.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => ({
        id: r.id,
        title: r.topic || (r.botName ? `Debate vs ${r.botName}` : "Practice debate"),
        updatedAt: iso(r.updatedAt),
        href: `/practice/versus-ai?debate=${r.id}` /* mirrors buildDebateHistoryHref in @debate-ai/practice-vs-ai */,
      }));
    }
  }
}

export interface SavedItemsPage {
  items: SavedItem[];
  /** True when rows exist past this page, so the client should offer "Load more". */
  hasMore: boolean;
}

/** One page of `listOwnSavedItems`; reads a spare row to learn whether another page follows. */
export async function listOwnSavedItemsPage(db: AccountDB, userId: string, kind: ItemKind, limit = MAX_ITEMS, offset = 0): Promise<SavedItemsPage> {
  const rows = await listOwnSavedItems(db, userId, kind, limit + 1, offset);
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** Deletes one of the caller's own rows; returns false when it doesn't exist or isn't theirs. */
export async function deleteOwnSavedItem(db: AccountDB, userId: string, kind: ItemKind, id: number): Promise<boolean> {
  switch (kind) {
    case "docs":
      return (await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId), eq(documents.isFolder, false))).returning({ id: documents.id })).length > 0;
    case "flows":
      return (await db.delete(savedFlows).where(and(eq(savedFlows.clientId, id), eq(savedFlows.userId, userId))).returning({ id: savedFlows.id })).length > 0;
    case "rounds":
      return (await db.delete(savedRounds).where(and(eq(savedRounds.clientId, id), eq(savedRounds.userId, userId))).returning({ id: savedRounds.id })).length > 0;
    case "practiceRounds":
      return (await db.delete(practiceVsAiDebates).where(and(eq(practiceVsAiDebates.id, id), eq(practiceVsAiDebates.userId, userId))).returning({ id: practiceVsAiDebates.id })).length > 0;
  }
}

export interface SavedItemExport {
  /** Suggested download name, already safe for a `Content-Disposition` header. */
  filename: string;
  /** JSON document: `{ kind, id, title, createdAt, updatedAt, ... }` plus the stored content. */
  body: string;
}

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";

/** Stored `data` columns are JSON text; hand back the parsed value, or the raw string if it isn't JSON. */
const parseData = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

/** Rows fetched per query when paging through everything a user has saved. */
export const EXPORT_PAGE_SIZE = 100;

interface ExportWindow {
  /** Restrict to one row key; omit to page through every row of the kind. */
  id?: number;
  limit: number;
  offset?: number;
}

/** Full content of the caller's own rows of one kind as parsed export documents, newest first. */
async function selectExportDocs(db: AccountDB, userId: string, kind: ItemKind, { id, limit, offset = 0 }: ExportWindow): Promise<Array<{ id: number; title: string; doc: Record<string, unknown> }>> {
  const base = (rowId: number, title: string, createdAt: Date | null, updatedAt: Date | null, extra: Record<string, unknown>) => ({
    id: rowId,
    title,
    doc: { kind, id: rowId, title, createdAt: iso(createdAt), updatedAt: iso(updatedAt), ...extra },
  });
  switch (kind) {
    case "docs": {
      const rows = await db
        .select()
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.isFolder, false), id === undefined ? undefined : eq(documents.id, id)))
        .orderBy(desc(documents.updatedAt), desc(documents.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r: typeof documents.$inferSelect) => base(r.id, r.title || "Untitled", r.createdAt, r.updatedAt, { format: r.format, content: r.content }));
    }
    case "flows": {
      const rows = await db
        .select()
        .from(savedFlows)
        .where(and(eq(savedFlows.userId, userId), id === undefined ? undefined : eq(savedFlows.clientId, id)))
        .orderBy(desc(savedFlows.updatedAt), desc(savedFlows.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r: typeof savedFlows.$inferSelect) => base(r.clientId, r.label || "Untitled flow", r.createdAt, r.updatedAt, { data: parseData(r.data) }));
    }
    case "rounds": {
      const rows = await db
        .select()
        .from(savedRounds)
        .where(and(eq(savedRounds.userId, userId), id === undefined ? undefined : eq(savedRounds.clientId, id)))
        .orderBy(desc(savedRounds.updatedAt), desc(savedRounds.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r: typeof savedRounds.$inferSelect) => base(r.clientId, r.label || "Untitled round", r.createdAt, r.updatedAt, { data: parseData(r.data) }));
    }
    case "practiceRounds": {
      const rows = await db
        .select()
        .from(practiceVsAiDebates)
        .where(and(eq(practiceVsAiDebates.userId, userId), id === undefined ? undefined : eq(practiceVsAiDebates.id, id)))
        .orderBy(desc(practiceVsAiDebates.updatedAt), desc(practiceVsAiDebates.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r: typeof practiceVsAiDebates.$inferSelect) =>
        base(r.id, r.topic || "Practice debate", r.createdAt, r.updatedAt, { botName: r.botName, result: r.result, outcome: r.outcome, data: parseData(r.data) }),
      );
    }
  }
}

/** Full content of one of the caller's own rows as a downloadable JSON file; null if it doesn't exist or isn't theirs. */
export async function exportOwnSavedItem(db: AccountDB, userId: string, kind: ItemKind, id: number): Promise<SavedItemExport | null> {
  const [found] = await selectExportDocs(db, userId, kind, { id, limit: 1 });
  return found ? { filename: `${kind}-${id}-${slug(found.title)}.json`, body: JSON.stringify(found.doc, null, 2) } : null;
}

export interface SavedDataArchive {
  filename: string;
  /** JSON document: `{ exportedAt, docs: [...], flows: [...], rounds: [...], practiceRounds: [...] }`. */
  body: string;
}

/** Every row of every kind of the caller's work, with full content, as one downloadable JSON archive (read a page at a time). */
export async function exportAllOwnSavedData(db: AccountDB, userId: string, now = new Date()): Promise<SavedDataArchive> {
  const archive: Record<string, unknown> = { exportedAt: now.toISOString() };
  for (const kind of ITEM_KINDS) {
    const docs: unknown[] = [];
    for (let offset = 0; ; offset += EXPORT_PAGE_SIZE) {
      const page = await selectExportDocs(db, userId, kind, { limit: EXPORT_PAGE_SIZE, offset });
      docs.push(...page.map((p) => p.doc));
      if (page.length < EXPORT_PAGE_SIZE) break;
    }
    archive[kind] = docs;
  }
  return { filename: `debate-ai-saved-data-${now.toISOString().slice(0, 10)}.json`, body: JSON.stringify(archive, null, 2) };
}
