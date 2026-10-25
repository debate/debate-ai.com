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

type ExportRow = { id: number; title: string; createdAt: Date | null; updatedAt: Date | null; extra: Record<string, unknown> };

const toFile = (kind: ItemKind, row: ExportRow): SavedItemExport => ({
  filename: `${kind}-${row.id}-${slug(row.title)}.json`,
  body: JSON.stringify({ kind, id: row.id, title: row.title, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), ...row.extra }, null, 2),
});

/** Full rows of one kind for the caller: a single row when `id` is given, otherwise the newest `limit`. */
async function selectExportRows(db: AccountDB, userId: string, kind: ItemKind, id: number | null, limit: number): Promise<ExportRow[]> {
  switch (kind) {
    case "docs": {
      const rows: Array<typeof documents.$inferSelect> = await db
        .select()
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.isFolder, false), ...(id === null ? [] : [eq(documents.id, id)])))
        .orderBy(desc(documents.updatedAt), desc(documents.id))
        .limit(limit);
      return rows.map((r) => ({ id: r.id, title: r.title || "Untitled", createdAt: r.createdAt, updatedAt: r.updatedAt, extra: { format: r.format, content: r.content } }));
    }
    case "flows": {
      const rows: Array<typeof savedFlows.$inferSelect> = await db
        .select()
        .from(savedFlows)
        .where(and(eq(savedFlows.userId, userId), ...(id === null ? [] : [eq(savedFlows.clientId, id)])))
        .orderBy(desc(savedFlows.updatedAt), desc(savedFlows.id))
        .limit(limit);
      return rows.map((r) => ({ id: r.clientId, title: r.label || "Untitled flow", createdAt: r.createdAt, updatedAt: r.updatedAt, extra: { data: parseData(r.data) } }));
    }
    case "rounds": {
      const rows: Array<typeof savedRounds.$inferSelect> = await db
        .select()
        .from(savedRounds)
        .where(and(eq(savedRounds.userId, userId), ...(id === null ? [] : [eq(savedRounds.clientId, id)])))
        .orderBy(desc(savedRounds.updatedAt), desc(savedRounds.id))
        .limit(limit);
      return rows.map((r) => ({ id: r.clientId, title: r.label || "Untitled round", createdAt: r.createdAt, updatedAt: r.updatedAt, extra: { data: parseData(r.data) } }));
    }
    case "practiceRounds": {
      const rows: Array<typeof practiceVsAiDebates.$inferSelect> = await db
        .select()
        .from(practiceVsAiDebates)
        .where(and(eq(practiceVsAiDebates.userId, userId), ...(id === null ? [] : [eq(practiceVsAiDebates.id, id)])))
        .orderBy(desc(practiceVsAiDebates.updatedAt), desc(practiceVsAiDebates.id))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        title: r.topic || "Practice debate",
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        extra: { botName: r.botName, result: r.result, outcome: r.outcome, data: parseData(r.data) },
      }));
    }
  }
}

/** Full content of one of the caller's own rows as a downloadable JSON file; null if it doesn't exist or isn't theirs. */
export async function exportOwnSavedItem(db: AccountDB, userId: string, kind: ItemKind, id: number): Promise<SavedItemExport | null> {
  const [row] = await selectExportRows(db, userId, kind, id, 1);
  return row ? toFile(kind, row) : null;
}

export interface SavedDataArchive {
  filename: string;
  /** JSON document: `{ exportedAt, limitPerKind, truncated, docs: [...], flows: [...], rounds: [...], practiceRounds: [...] }`. */
  body: string;
}

/** Safety bound per kind for bulk export, well above the 100-row management list. */
export const MAX_EXPORT_ITEMS = 5000;

/** Each kind's newest `MAX_EXPORT_ITEMS` rows of the caller's work, with full content, as one downloadable JSON archive. */
export async function exportAllOwnSavedData(db: AccountDB, userId: string, now = new Date(), limit = MAX_EXPORT_ITEMS): Promise<SavedDataArchive> {
  const archive: Record<string, unknown> = { exportedAt: now.toISOString(), limitPerKind: limit, truncated: [] as ItemKind[] };
  for (const kind of ITEM_KINDS) {
    // One extra row tells us whether the kind was cut off without a separate COUNT query.
    const rows = await selectExportRows(db, userId, kind, null, limit + 1);
    if (rows.length > limit) (archive.truncated as ItemKind[]).push(kind);
    archive[kind] = rows.slice(0, limit).map((row) => JSON.parse(toFile(kind, row).body) as unknown);
  }
  return { filename: `debate-ai-saved-data-${now.toISOString().slice(0, 10)}.json`, body: JSON.stringify(archive, null, 2) };
}
