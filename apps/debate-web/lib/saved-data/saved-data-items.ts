import { and, desc, eq } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";
import { documents, practiceVsAiDebates, savedFlows, savedRounds } from "../database/schema";

type AccountDB = Awaited<ReturnType<typeof getDBFromContext>>;

/** Kinds whose individual rows can be listed and removed from Settings. */
export const ITEM_KINDS = ["docs", "flows", "rounds", "practiceRounds"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const isItemKind = (value: string): value is ItemKind => (ITEM_KINDS as readonly string[]).includes(value);

/** Rows returned per kind; the list is a management view, not a browser. */
export const MAX_ITEMS = 100;

export interface SavedItem {
  /** Row key to pass back to delete: `id` for docs/practice, `clientId` for flows/rounds. */
  id: number;
  title: string;
  updatedAt: string;
  /** Where the item opens, when the app has a stable URL for it. */
  href: string | null;
}

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : new Date(0).toISOString());

/** Newest-first list of one kind of the caller's saved work (titles only, never content). */
export async function listOwnSavedItems(db: AccountDB, userId: string, kind: ItemKind): Promise<SavedItem[]> {
  switch (kind) {
    case "docs": {
      const rows: Array<{ id: number; title: string; updatedAt: Date | null }> = await db
        .select({ id: documents.id, title: documents.title, updatedAt: documents.updatedAt })
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.isFolder, false)))
        .orderBy(desc(documents.updatedAt), desc(documents.id))
        .limit(MAX_ITEMS);
      return rows.map((r) => ({ id: r.id, title: r.title || "Untitled", updatedAt: iso(r.updatedAt), href: `/reason-editor?doc=${r.id}` }));
    }
    case "flows": {
      const rows: Array<{ id: number; label: string; updatedAt: Date | null }> = await db
        .select({ id: savedFlows.clientId, label: savedFlows.label, updatedAt: savedFlows.updatedAt })
        .from(savedFlows)
        .where(eq(savedFlows.userId, userId))
        .orderBy(desc(savedFlows.updatedAt), desc(savedFlows.id))
        .limit(MAX_ITEMS);
      return rows.map((r) => ({ id: r.id, title: r.label || "Untitled flow", updatedAt: iso(r.updatedAt), href: `/debate?flowId=${r.id}` /* mirrors buildFlowOpenHref in @debate-ai/round */ }));
    }
    case "rounds": {
      const rows: Array<{ id: number; label: string; updatedAt: Date | null }> = await db
        .select({ id: savedRounds.clientId, label: savedRounds.label, updatedAt: savedRounds.updatedAt })
        .from(savedRounds)
        .where(eq(savedRounds.userId, userId))
        .orderBy(desc(savedRounds.updatedAt), desc(savedRounds.id))
        .limit(MAX_ITEMS);
      return rows.map((r) => ({ id: r.id, title: r.label || "Untitled round", updatedAt: iso(r.updatedAt), href: null }));
    }
    case "practiceRounds": {
      const rows: Array<{ id: number; topic: string; botName: string; updatedAt: Date | null }> = await db
        .select({ id: practiceVsAiDebates.id, topic: practiceVsAiDebates.topic, botName: practiceVsAiDebates.botName, updatedAt: practiceVsAiDebates.updatedAt })
        .from(practiceVsAiDebates)
        .where(eq(practiceVsAiDebates.userId, userId))
        .orderBy(desc(practiceVsAiDebates.updatedAt), desc(practiceVsAiDebates.id))
        .limit(MAX_ITEMS);
      return rows.map((r) => ({
        id: r.id,
        title: r.topic || (r.botName ? `Debate vs ${r.botName}` : "Practice debate"),
        updatedAt: iso(r.updatedAt),
        href: null,
      }));
    }
  }
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

type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];

/** Builds the JSON export for one stored row; shared by the single-item and bulk exports. */
const exportDoc = (row: Row<typeof documents>) => buildExport("docs", row.id, row.title || "Untitled", row.createdAt, row.updatedAt, { format: row.format, content: row.content });
const exportFlow = (row: Row<typeof savedFlows>) => buildExport("flows", row.clientId, row.label || "Untitled flow", row.createdAt, row.updatedAt, { data: parseData(row.data) });
const exportRound = (row: Row<typeof savedRounds>) => buildExport("rounds", row.clientId, row.label || "Untitled round", row.createdAt, row.updatedAt, { data: parseData(row.data) });
const exportPractice = (row: Row<typeof practiceVsAiDebates>) =>
  buildExport("practiceRounds", row.id, row.topic || "Practice debate", row.createdAt, row.updatedAt, { botName: row.botName, result: row.result, outcome: row.outcome, data: parseData(row.data) });

function buildExport(kind: ItemKind, id: number, title: string, createdAt: Date | null, updatedAt: Date | null, extra: Record<string, unknown>): SavedItemExport {
  return {
    filename: `${kind}-${id}-${slug(title)}.json`,
    body: JSON.stringify({ kind, id, title, createdAt: iso(createdAt), updatedAt: iso(updatedAt), ...extra }, null, 2),
  };
}

/** Full content of one of the caller's own rows as a downloadable JSON file; null if it doesn't exist or isn't theirs. */
export async function exportOwnSavedItem(db: AccountDB, userId: string, kind: ItemKind, id: number): Promise<SavedItemExport | null> {
  switch (kind) {
    case "docs": {
      const [row] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, userId), eq(documents.isFolder, false)))
        .limit(1);
      return row ? exportDoc(row) : null;
    }
    case "flows": {
      const [row] = await db.select().from(savedFlows).where(and(eq(savedFlows.clientId, id), eq(savedFlows.userId, userId))).limit(1);
      return row ? exportFlow(row) : null;
    }
    case "rounds": {
      const [row] = await db.select().from(savedRounds).where(and(eq(savedRounds.clientId, id), eq(savedRounds.userId, userId))).limit(1);
      return row ? exportRound(row) : null;
    }
    case "practiceRounds": {
      const [row] = await db
        .select()
        .from(practiceVsAiDebates)
        .where(and(eq(practiceVsAiDebates.id, id), eq(practiceVsAiDebates.userId, userId)))
        .limit(1);
      return row ? exportPractice(row) : null;
    }
  }
}

/** Newest-first full rows of one kind, `limit` at a time starting at `offset`, exported as JSON files. */
async function exportPage(db: AccountDB, userId: string, kind: ItemKind, limit: number, offset: number): Promise<SavedItemExport[]> {
  switch (kind) {
    case "docs":
      return (await db.select().from(documents).where(and(eq(documents.userId, userId), eq(documents.isFolder, false))).orderBy(desc(documents.updatedAt), desc(documents.id)).limit(limit).offset(offset)).map(exportDoc);
    case "flows":
      return (await db.select().from(savedFlows).where(eq(savedFlows.userId, userId)).orderBy(desc(savedFlows.updatedAt), desc(savedFlows.id)).limit(limit).offset(offset)).map(exportFlow);
    case "rounds":
      return (await db.select().from(savedRounds).where(eq(savedRounds.userId, userId)).orderBy(desc(savedRounds.updatedAt), desc(savedRounds.id)).limit(limit).offset(offset)).map(exportRound);
    case "practiceRounds":
      return (await db.select().from(practiceVsAiDebates).where(eq(practiceVsAiDebates.userId, userId)).orderBy(desc(practiceVsAiDebates.updatedAt), desc(practiceVsAiDebates.id)).limit(limit).offset(offset)).map(exportPractice);
  }
}

/** Bulk export ceiling per kind; keeps the archive within a Worker's memory. Past it, `truncated` says so. */
export const MAX_EXPORT_ITEMS = 1000;
const EXPORT_PAGE_SIZE = 100;

export interface SavedDataArchive {
  filename: string;
  /** JSON document: `{ exportedAt, limitPerKind, truncated: { <kind>: boolean }, docs: [...], flows: [...], rounds: [...], practiceRounds: [...] }`. */
  body: string;
}

/** Every kind of the caller's work, newest first up to `MAX_EXPORT_ITEMS` each, with full content, as one downloadable JSON archive. */
export async function exportAllOwnSavedData(db: AccountDB, userId: string, now = new Date()): Promise<SavedDataArchive> {
  const archive: Record<string, unknown> = { exportedAt: now.toISOString(), limitPerKind: MAX_EXPORT_ITEMS };
  const truncated: Record<string, boolean> = {};
  archive.truncated = truncated;
  for (const kind of ITEM_KINDS) {
    const files: SavedItemExport[] = [];
    // Ask for one row past the ceiling so a user with exactly the ceiling isn't flagged as truncated.
    for (;;) {
      const want = Math.min(EXPORT_PAGE_SIZE, MAX_EXPORT_ITEMS + 1 - files.length);
      if (want <= 0) break;
      const page = await exportPage(db, userId, kind, want, files.length);
      files.push(...page);
      if (page.length < want) break;
    }
    truncated[kind] = files.length > MAX_EXPORT_ITEMS;
    archive[kind] = files.slice(0, MAX_EXPORT_ITEMS).map((file) => JSON.parse(file.body) as unknown);
  }
  return { filename: `debate-ai-saved-data-${now.toISOString().slice(0, 10)}.json`, body: JSON.stringify(archive, null, 2) };
}
