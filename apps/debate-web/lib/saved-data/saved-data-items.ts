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
      return rows.map((r) => ({ id: r.id, title: r.label || "Untitled flow", updatedAt: iso(r.updatedAt), href: null }));
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
  /** Suggested download name, without path characters. */
  filename: string;
  /** Pretty-printed JSON envelope: `{ kind, id, title, createdAt, updatedAt, data }`. */
  body: string;
}

const safeFilename = (title: string, kind: ItemKind, id: number) => {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${slug || kind}-${id}.json`;
};

/** Stored `data` columns are JSON text; fall back to the raw string if one isn't. */
const parseData = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

/** One of the caller's own rows with its full content, or null when it doesn't exist or isn't theirs. */
export async function exportOwnSavedItem(db: AccountDB, userId: string, kind: ItemKind, id: number): Promise<SavedItemExport | null> {
  let title: string;
  let createdAt: Date | null;
  let updatedAt: Date | null;
  let data: unknown;
  switch (kind) {
    case "docs": {
      const [row] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, userId), eq(documents.isFolder, false)))
        .limit(1);
      if (!row) return null;
      title = row.title || "Untitled";
      ({ createdAt, updatedAt } = row);
      data = { format: row.format, content: row.content };
      break;
    }
    case "flows": {
      const [row] = await db.select().from(savedFlows).where(and(eq(savedFlows.clientId, id), eq(savedFlows.userId, userId))).limit(1);
      if (!row) return null;
      title = row.label || "Untitled flow";
      ({ createdAt, updatedAt } = row);
      data = parseData(row.data);
      break;
    }
    case "rounds": {
      const [row] = await db.select().from(savedRounds).where(and(eq(savedRounds.clientId, id), eq(savedRounds.userId, userId))).limit(1);
      if (!row) return null;
      title = row.label || "Untitled round";
      ({ createdAt, updatedAt } = row);
      data = parseData(row.data);
      break;
    }
    case "practiceRounds": {
      const [row] = await db
        .select()
        .from(practiceVsAiDebates)
        .where(and(eq(practiceVsAiDebates.id, id), eq(practiceVsAiDebates.userId, userId)))
        .limit(1);
      if (!row) return null;
      title = row.topic || (row.botName ? `Debate vs ${row.botName}` : "Practice debate");
      ({ createdAt, updatedAt } = row);
      data = parseData(row.data);
      break;
    }
  }
  return {
    filename: safeFilename(title, kind, id),
    body: JSON.stringify({ kind, id, title, createdAt: iso(createdAt), updatedAt: iso(updatedAt), data }, null, 2),
  };
}
