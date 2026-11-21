import { and, asc, desc, eq, gt, or, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { getDBFromContext } from "@/lib/database/context";
import { findToolRecordCollection } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import { documents, practiceVsAiDebates, savedDrillSets, savedFlows, savedJudgeDecisions, savedRounds, savedSpeechSendLog, savedToolRecords, savedWordCountRounds } from "../database/schema";

type AccountDB = Awaited<ReturnType<typeof getDBFromContext>>;

/** Kinds whose individual rows can be listed, opened and exported from Settings. */
export const ITEM_KINDS = ["docs", "flows", "rounds", "practiceRounds", "wordCountRounds", "drills", "judgeDecisions", "speeches"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const isItemKind = (value: string): value is ItemKind => (ITEM_KINDS as readonly string[]).includes(value);

/**
 * Kinds Settings may also delete one row at a time. Drill sets are left out:
 * `useDrillSets` pushes every local set the account lacks back up on the next
 * page load (`planDrillSetMerge`), so a delete from Settings would quietly
 * come back from any device that still holds the set. They are removed with
 * **Clear** in the Drill Sets tool, which clears the local copy and the row.
 * Word-count rounds are left out for the same reason: `useWordCountRounds`
 * re-pushes every local round the account lacks, so they are deleted in the
 * Word Count tool, which removes the local copy and the row together.
 * Judge decisions and sent speeches are left out too: `useJudgeDecisions` and
 * `useSpeechSendLogSync` re-push every local entry the account lacks, so they
 * are cleared on the AI Judge Decision and Speech Documents pages instead.
 */
export const DELETABLE_ITEM_KINDS = ["docs", "flows", "rounds", "practiceRounds"] as const satisfies readonly ItemKind[];
export type DeletableItemKind = (typeof DELETABLE_ITEM_KINDS)[number];

export const isDeletableItemKind = (kind: ItemKind): kind is DeletableItemKind => (DELETABLE_ITEM_KINDS as readonly string[]).includes(kind);

/** Rows per page of the Manage list; further pages are fetched with `offset`. */
export const MAX_ITEMS = 100;

/** Default rows per page in the Manage list. */
export const PAGE_SIZE = 25;

/** Rows per kind in the bulk export archive; the archive is a backup, so it reaches much further than the list. */
export const EXPORT_MAX_ITEMS = 1000;

export interface SavedItem {
  /** Row key to pass back to export/delete: `clientId` for flows/rounds, the row `id` for every other kind. */
  id: number;
  title: string;
  updatedAt: string;
  /** Where the item opens, when the app has a stable URL for it. */
  href: string | null;
}

/** Longest title search the Manage list accepts; longer input is rejected by the route. */
export const MAX_QUERY_LENGTH = 100;

/**
 * Case-insensitive "title contains" filter for the Manage list's search box.
 * `%`, `_` and `\` in the query are matched literally. Blank queries filter nothing.
 */
export function titleContains(column: AnySQLiteColumn, query: string): SQL | undefined {
  const q = query.trim();
  if (!q) return undefined;
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : new Date(0).toISOString());

/** The Word Count tool. */
export const WORD_COUNT_HREF = "/word-count";

/** Longest round id kept in a word-count title; longer ids are clipped with "…" (ids are typed freely, up to 200 characters). */
export const WORD_COUNT_TITLE_ROUND_ID_MAX = 60;

/**
 * Deep link to one word-count round by its `roundId` (`client_id`):
 * `/word-count?round=<id>`. Mirrors `buildWordCountRoundOpenHref` in
 * `@debate-ai/practice-rounds` (`state/savedWordCountRounds.ts`); the page
 * outlines and scrolls to that round. Falls back to the page when the id is blank.
 */
export function wordCountRoundHref(clientId: string | null | undefined): string {
  return clientId ? `${WORD_COUNT_HREF}?round=${encodeURIComponent(clientId)}` : WORD_COUNT_HREF;
}

/**
 * List title for a stored word-count round (`WordCountRoundRecord` in
 * `@debate-ai/round`): "Round 12 · 3 speeches" — the same "Round N" the
 * Word Count tool shows, so several rounds don't look alike in the Manage
 * list and a search for the round id finds it. The id comes from the stored
 * JSON's `roundId` (trimmed, clipped to {@link WORD_COUNT_TITLE_ROUND_ID_MAX}).
 * Without one the title starts "Word-count round"; malformed data still gets
 * a title.
 */
export function wordCountRoundTitle(rawData: string): string {
  let count: number | null = null;
  let roundId = "";
  try {
    const parsed = JSON.parse(rawData) as { roundId?: unknown; submittedSpeeches?: unknown } | null;
    if (parsed && Array.isArray(parsed.submittedSpeeches)) count = parsed.submittedSpeeches.length;
    if (parsed && typeof parsed.roundId === "string") roundId = parsed.roundId.replace(/\s+/g, " ").trim();
  } catch {
    count = null;
  }
  if (roundId.length > WORD_COUNT_TITLE_ROUND_ID_MAX) roundId = `${roundId.slice(0, WORD_COUNT_TITLE_ROUND_ID_MAX - 1).trimEnd()}…`;
  const label = roundId ? `Round ${roundId}` : "Word-count round";
  return count === null ? label : `${label} · ${count} ${count === 1 ? "speech" : "speeches"}`;
}

/** The Drill Sets page (redirects to the Practice Drills tab of `/practice/debates`). */
export const DRILL_SETS_HREF = "/practice/drills";

/**
 * Deep link to one drill set by its `roundId` (`client_id`):
 * `/practice/debates?section=drills&drillSet=<id>`. Points at the tab
 * directly because the `/practice/drills` redirect drops other query params.
 * Mirrors `buildDrillSetOpenHref` in `@debate-ai/practice-rounds`
 * (`state/savedDrillSets.ts`); the tab outlines and scrolls to that set.
 * Falls back to {@link DRILL_SETS_HREF} when the id is blank.
 */
export function drillSetHref(clientId: string | null | undefined): string {
  return clientId ? `/practice/debates?section=drills&drillSet=${encodeURIComponent(clientId)}` : DRILL_SETS_HREF;
}

/**
 * List title for a stored drill set: the round (flow) it was generated from
 * plus how many drills it holds — the same "Round N" the Drill Sets panel
 * shows. Reads only `drills.length` from the stored JSON; malformed data
 * still gets a title.
 */
export function drillSetTitle(roundId: string, rawData: string): string {
  let count: number | null = null;
  try {
    const parsed = JSON.parse(rawData) as { drills?: unknown } | null;
    if (parsed && Array.isArray(parsed.drills)) count = parsed.drills.length;
  } catch {
    count = null;
  }
  const round = roundId ? `Round ${roundId}` : "Drill set";
  return count === null ? round : `${round} · ${count} drill${count === 1 ? "" : "s"}`;
}

/** The AI Judge Decision page. */
export const JUDGE_DECISIONS_HREF = "/practice/judge-decision";

/**
 * Deep link to one judge decision by its own id (`client_id`):
 * `/practice/judge-decision?decision=<id>`. Mirrors `buildJudgeDecisionOpenHref`
 * in `@debate-ai/practice-rounds` (`state/judgeDecisions.ts`); the page outlines
 * and scrolls to that decision. Falls back to the page when the id is blank.
 */
export function judgeDecisionHref(clientId: string | null | undefined): string {
  return clientId ? `${JUDGE_DECISIONS_HREF}?decision=${encodeURIComponent(clientId)}` : JUDGE_DECISIONS_HREF;
}

/**
 * List title for a stored judge decision (`JudgeDecisionRecord` in
 * `@debate-ai/practice-rounds`): "Aff wins · Tabula Rasa". Falls back to
 * "First side" / "Second side" when a side has no name, and to "Judge decision"
 * when the JSON is malformed.
 */
export function judgeDecisionTitle(rawData: string): string {
  try {
    const parsed = JSON.parse(rawData) as { paradigmName?: unknown; sideNames?: Record<string, unknown>; result?: { winner?: unknown } } | null;
    const winner = parsed?.result?.winner;
    if (winner !== "primary" && winner !== "secondary") return "Judge decision";
    const named = parsed?.sideNames?.[winner];
    const side = typeof named === "string" && named.trim() ? named.trim() : winner === "primary" ? "First side" : "Second side";
    const paradigm = typeof parsed?.paradigmName === "string" ? parsed.paradigmName.trim() : "";
    return paradigm ? `${side} wins · ${paradigm}` : `${side} wins`;
  } catch {
    return "Judge decision";
  }
}

/** The Speech Documents page, where the send history is shown. */
export const SPEECHES_HREF = "/speech-documents";

/**
 * Deep link to one sent speech by its own id (`client_id`):
 * `/speech-documents?entry=<id>`. Mirrors `buildSpeechSendOpenHref` in
 * `@debate-ai/webview` (`lib/speech-send-log-client.ts`); the page outlines and
 * scrolls to that entry. Falls back to the page when the id is blank.
 */
export function speechSendHref(clientId: string | null | undefined): string {
  return clientId ? `${SPEECHES_HREF}?entry=${encodeURIComponent(clientId)}` : SPEECHES_HREF;
}

/** Longest list title for a sent speech; the stored preview is already ~160 characters. */
const SPEECH_TITLE_MAX = 80;

/**
 * List title for a stored speech-send-log entry (`SpeechSendLogEntry` in
 * `@debate-ai/editor/engine`): its one-line preview, clipped. Falls back to
 * "Sent speech" when the preview is blank or the JSON is malformed.
 */
export function speechSendTitle(rawData: string): string {
  try {
    const parsed = JSON.parse(rawData) as { preview?: unknown; text?: unknown } | null;
    const source = typeof parsed?.preview === "string" && parsed.preview.trim() ? parsed.preview : typeof parsed?.text === "string" ? parsed.text : "";
    const line = source.replace(/\s+/g, " ").trim();
    if (!line) return "Sent speech";
    return line.length > SPEECH_TITLE_MAX ? `${line.slice(0, SPEECH_TITLE_MAX - 1).trimEnd()}…` : line;
  } catch {
    return "Sent speech";
  }
}

/**
 * Newest-first page of rows whose title is derived from stored JSON. Without a
 * query the page comes from SQL; with one, the caller's rows are titled and
 * filtered in memory (titles aren't columns, and the list never sends `data`).
 */
function pageDerivedTitles<T extends { id: number; data: string; updatedAt: Date | null }>(rows: T[], title: (row: T) => string, href: (row: T) => string, query: string, limit: number, offset: number, paged: boolean): SavedItem[] {
  const q = query.trim().toLowerCase();
  const items = rows.map((r) => ({ id: r.id, title: title(r), updatedAt: iso(r.updatedAt), href: href(r) })).filter((item) => !q || item.title.toLowerCase().includes(q));
  return paged ? items : items.slice(offset, offset + limit);
}

/**
 * Newest-first list of one kind of the caller's saved work (titles only, never content), at most `limit` rows after skipping `offset`.
 * A non-blank `query` keeps only rows whose stored title contains it (practice debates: topic or opponent name).
 */
export async function listOwnSavedItems(db: AccountDB, userId: string, kind: ItemKind, limit = MAX_ITEMS, offset = 0, query = ""): Promise<SavedItem[]> {
  switch (kind) {
    case "docs": {
      const rows: Array<{ id: number; title: string; updatedAt: Date | null }> = await db
        .select({ id: documents.id, title: documents.title, updatedAt: documents.updatedAt })
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.isFolder, false), titleContains(documents.title, query)))
        .orderBy(desc(documents.updatedAt), desc(documents.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => ({ id: r.id, title: r.title || "Untitled", updatedAt: iso(r.updatedAt), href: `/reason-editor?doc=${r.id}` }));
    }
    case "flows": {
      const rows: Array<{ id: number; label: string; updatedAt: Date | null }> = await db
        .select({ id: savedFlows.clientId, label: savedFlows.label, updatedAt: savedFlows.updatedAt })
        .from(savedFlows)
        .where(and(eq(savedFlows.userId, userId), titleContains(savedFlows.label, query)))
        .orderBy(desc(savedFlows.updatedAt), desc(savedFlows.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => ({ id: r.id, title: r.label || "Untitled flow", updatedAt: iso(r.updatedAt), href: `/debate?flowId=${r.id}` /* mirrors buildFlowOpenHref in @debate-ai/round */ }));
    }
    case "rounds": {
      const rows: Array<{ id: number; label: string; data: string; updatedAt: Date | null }> = await db
        .select({ id: savedRounds.clientId, label: savedRounds.label, data: savedRounds.data, updatedAt: savedRounds.updatedAt })
        .from(savedRounds)
        .where(and(eq(savedRounds.userId, userId), titleContains(savedRounds.label, query)))
        .orderBy(desc(savedRounds.updatedAt), desc(savedRounds.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => ({ id: r.id, title: r.label || "Untitled round", updatedAt: iso(r.updatedAt), href: `/debate?roundId=${r.id}` /* mirrors buildRoundOpenHref in @debate-ai/round */ }));
    }
    case "practiceRounds": {
      const rows: Array<{ id: number; topic: string; botName: string; updatedAt: Date | null }> = await db
        .select({ id: practiceVsAiDebates.id, topic: practiceVsAiDebates.topic, botName: practiceVsAiDebates.botName, updatedAt: practiceVsAiDebates.updatedAt })
        .from(practiceVsAiDebates)
        .where(and(eq(practiceVsAiDebates.userId, userId), query.trim() ? or(titleContains(practiceVsAiDebates.topic, query), titleContains(practiceVsAiDebates.botName, query)) : undefined))
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
    case "wordCountRounds": {
      // Titles come from the stored JSON, so a search matches the derived title in memory
      // (rows per user are few; the list never sends `data` to the client).
      const rows: Array<{ id: number; clientId: string; data: string; updatedAt: Date | null }> = await db
        .select({ id: savedWordCountRounds.id, clientId: savedWordCountRounds.clientId, data: savedWordCountRounds.data, updatedAt: savedWordCountRounds.updatedAt })
        .from(savedWordCountRounds)
        .where(eq(savedWordCountRounds.userId, userId))
        .orderBy(desc(savedWordCountRounds.updatedAt), desc(savedWordCountRounds.id));
      const q = query.trim().toLowerCase();
      return rows
        .map((r) => ({ id: r.id, title: wordCountRoundTitle(r.data), updatedAt: iso(r.updatedAt), href: wordCountRoundHref(r.clientId) }))
        .filter((item) => !q || item.title.toLowerCase().includes(q))
        .slice(offset, offset + limit);
    }
    case "drills": {
      // Reads `data` only to count drills for the title; the content is never sent to the list.
      const rows: Array<{ id: number; roundId: string; data: string; updatedAt: Date | null }> = await db
        .select({ id: savedDrillSets.id, roundId: savedDrillSets.clientId, data: savedDrillSets.data, updatedAt: savedDrillSets.updatedAt })
        .from(savedDrillSets)
        .where(eq(savedDrillSets.userId, userId))
        .orderBy(desc(savedDrillSets.updatedAt), desc(savedDrillSets.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r) => ({ id: r.id, title: drillSetTitle(r.roundId, r.data), updatedAt: iso(r.updatedAt), href: drillSetHref(r.roundId) }));
    }
    case "judgeDecisions": {
      const paged = !query.trim();
      const base = db
        .select({ id: savedJudgeDecisions.id, clientId: savedJudgeDecisions.clientId, data: savedJudgeDecisions.data, updatedAt: savedJudgeDecisions.updatedAt })
        .from(savedJudgeDecisions)
        .where(eq(savedJudgeDecisions.userId, userId))
        .orderBy(desc(savedJudgeDecisions.updatedAt), desc(savedJudgeDecisions.id));
      const rows: Array<{ id: number; clientId: string | null; data: string; updatedAt: Date | null }> = paged ? await base.limit(limit).offset(offset) : await base;
      return pageDerivedTitles(rows, (r) => judgeDecisionTitle(r.data), (r) => judgeDecisionHref(r.clientId), query, limit, offset, paged);
    }
    case "speeches": {
      const paged = !query.trim();
      const base = db
        .select({ id: savedSpeechSendLog.id, clientId: savedSpeechSendLog.clientId, data: savedSpeechSendLog.data, updatedAt: savedSpeechSendLog.updatedAt })
        .from(savedSpeechSendLog)
        .where(eq(savedSpeechSendLog.userId, userId))
        .orderBy(desc(savedSpeechSendLog.updatedAt), desc(savedSpeechSendLog.id));
      const rows: Array<{ id: number; clientId: string | null; data: string; updatedAt: Date | null }> = paged ? await base.limit(limit).offset(offset) : await base;
      return pageDerivedTitles(rows, (r) => speechSendTitle(r.data), (r) => speechSendHref(r.clientId), query, limit, offset, paged);
    }
  }
}

export interface SavedItemsPage {
  items: SavedItem[];
  /** True when rows exist past this page, so the client should offer "Load more". */
  hasMore: boolean;
  /** False for kinds Settings must not delete (see {@link DELETABLE_ITEM_KINDS}); the client hides Delete. */
  deletable: boolean;
}

/** One page of `listOwnSavedItems` (optionally filtered by `query`); reads a spare row to learn whether another page follows. */
export async function listOwnSavedItemsPage(db: AccountDB, userId: string, kind: ItemKind, limit = MAX_ITEMS, offset = 0, query = ""): Promise<SavedItemsPage> {
  const rows = await listOwnSavedItems(db, userId, kind, limit + 1, offset, query);
  return { items: rows.slice(0, limit), hasMore: rows.length > limit, deletable: isDeletableItemKind(kind) };
}

/** Deletes one of the caller's own rows; returns false when it doesn't exist or isn't theirs. */
export async function deleteOwnSavedItem(db: AccountDB, userId: string, kind: DeletableItemKind, id: number): Promise<boolean> {
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
      // Named columns rather than `select()`, so a D1 still missing a newer
      // column (author, the size stats) can't fail the export.
      const rows = await db
        .select({
          id: documents.id,
          title: documents.title,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
          format: documents.format,
          content: documents.content,
        })
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.isFolder, false), id === undefined ? undefined : eq(documents.id, id)))
        .orderBy(desc(documents.updatedAt), desc(documents.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r: Pick<typeof documents.$inferSelect, "id" | "title" | "createdAt" | "updatedAt" | "format" | "content">) => base(r.id, r.title || "Untitled", r.createdAt, r.updatedAt, { format: r.format, content: r.content }));
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
    case "wordCountRounds": {
      const rows = await db
        .select()
        .from(savedWordCountRounds)
        .where(and(eq(savedWordCountRounds.userId, userId), id === undefined ? undefined : eq(savedWordCountRounds.id, id)))
        .orderBy(desc(savedWordCountRounds.updatedAt), desc(savedWordCountRounds.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r: typeof savedWordCountRounds.$inferSelect) =>
        base(r.id, wordCountRoundTitle(r.data), r.createdAt, r.updatedAt, { roundId: r.clientId, data: parseData(r.data) }),
      );
    }
    case "drills": {
      const rows = await db
        .select()
        .from(savedDrillSets)
        .where(and(eq(savedDrillSets.userId, userId), id === undefined ? undefined : eq(savedDrillSets.id, id)))
        .orderBy(desc(savedDrillSets.updatedAt), desc(savedDrillSets.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r: typeof savedDrillSets.$inferSelect) =>
        base(r.id, drillSetTitle(r.clientId, r.data), r.createdAt, r.updatedAt, { roundId: r.clientId, data: parseData(r.data) }),
      );
    }
    case "judgeDecisions": {
      const rows = await db
        .select()
        .from(savedJudgeDecisions)
        .where(and(eq(savedJudgeDecisions.userId, userId), id === undefined ? undefined : eq(savedJudgeDecisions.id, id)))
        .orderBy(desc(savedJudgeDecisions.updatedAt), desc(savedJudgeDecisions.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r: typeof savedJudgeDecisions.$inferSelect) =>
        base(r.id, judgeDecisionTitle(r.data), r.createdAt, r.updatedAt, { roundId: r.roundId, data: parseData(r.data) }),
      );
    }
    case "speeches": {
      const rows = await db
        .select()
        .from(savedSpeechSendLog)
        .where(and(eq(savedSpeechSendLog.userId, userId), id === undefined ? undefined : eq(savedSpeechSendLog.id, id)))
        .orderBy(desc(savedSpeechSendLog.updatedAt), desc(savedSpeechSendLog.id))
        .limit(limit)
        .offset(offset);
      return rows.map((r: typeof savedSpeechSendLog.$inferSelect) => base(r.id, speechSendTitle(r.data), r.createdAt, r.updatedAt, { data: parseData(r.data) }));
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
  /**
   * JSON document: `{ exportedAt, docs: [...], flows: [...], rounds: [...], practiceRounds: [...], wordCountRounds: [...], drills: [...], judgeDecisions: [...], speeches: [...], toolRecords: { <collection>: [...] }, ... }`.
   * `toolRecords` holds each synced tool's records exactly as the tool stored them.
   */
  body: string;
}

/** Most tool-data records (all collections together) one bulk export carries. */
export const EXPORT_MAX_TOOL_RECORDS = 5000;

/** Tool-data rows read per query; the records are small, so pages are larger than the work kinds'. */
export const TOOL_RECORD_EXPORT_PAGE_SIZE = 500;

/**
 * The caller's synced tool data (`saved_tool_records`) grouped by collection,
 * each record parsed back into the object its tool stored, oldest first — the
 * order `GET /api/tool-records/[collection]` returns. Rows under a key no
 * longer in `TOOL_RECORD_COLLECTIONS` are left out, as they are from the
 * Settings counts: nothing can read them back. Reads by row id in pages
 * (keyset, so a page costs one query however deep it is) and stops after
 * `max` records, saying whether more were left.
 */
export async function exportOwnToolRecords(
  db: AccountDB,
  userId: string,
  max = EXPORT_MAX_TOOL_RECORDS,
  collection?: string,
): Promise<{ toolRecords: Record<string, unknown[]>; truncated: boolean }> {
  const toolRecords: Record<string, unknown[]> = {};
  let exported = 0;
  let afterId = 0;
  for (;;) {
    const rows: Array<{ id: number; collection: string; data: string }> = await db
      .select({ id: savedToolRecords.id, collection: savedToolRecords.collection, data: savedToolRecords.data })
      .from(savedToolRecords)
      .where(
        and(
          eq(savedToolRecords.userId, userId),
          gt(savedToolRecords.id, afterId),
          collection === undefined ? undefined : eq(savedToolRecords.collection, collection),
        ),
      )
      .orderBy(asc(savedToolRecords.id))
      .limit(TOOL_RECORD_EXPORT_PAGE_SIZE);
    for (const row of rows) {
      afterId = row.id;
      if (!findToolRecordCollection(row.collection)) continue;
      if (exported >= max) return { toolRecords, truncated: true };
      (toolRecords[row.collection] ??= []).push(parseData(row.data));
      exported += 1;
    }
    if (rows.length < TOOL_RECORD_EXPORT_PAGE_SIZE) return { toolRecords, truncated: false };
  }
}

/**
 * One tool's synced data as a downloadable file, for the **Export** link on a
 * Settings → Tool data row. The file has the same shape as **Export all**
 * (`{ exportedAt, toolRecords: { <collection>: [...] }, toolRecordsTruncated }`)
 * with only that collection, so **Restore from export…** reads it back
 * unchanged. Returns `null` for a key not in `TOOL_RECORD_COLLECTIONS`, the
 * same rule that keeps retired keys out of the counts. A tool with no records
 * still gets a file, with an empty list.
 */
export async function exportOwnToolCollection(
  db: AccountDB,
  userId: string,
  collection: string,
  now = new Date(),
  max = EXPORT_MAX_TOOL_RECORDS,
): Promise<SavedDataArchive | null> {
  if (!findToolRecordCollection(collection)) return null;
  const { toolRecords, truncated } = await exportOwnToolRecords(db, userId, max, collection);
  const file = { exportedAt: now.toISOString(), toolRecords: { [collection]: toolRecords[collection] ?? [] }, toolRecordsTruncated: truncated };
  return { filename: `toolRecords-${slug(collection)}-${now.toISOString().slice(0, 10)}.json`, body: JSON.stringify(file, null, 2) };
}

/** Every row of every kind of the caller's work, with full content, plus their synced tool data, as one downloadable JSON archive (read a page at a time, up to `maxPerKind` rows per kind). */
export async function exportAllOwnSavedData(db: AccountDB, userId: string, now = new Date(), maxPerKind = EXPORT_MAX_ITEMS): Promise<SavedDataArchive> {
  const archive: Record<string, unknown> = { exportedAt: now.toISOString() };
  const truncated: ItemKind[] = [];
  for (const kind of ITEM_KINDS) {
    const docs: unknown[] = [];
    for (let offset = 0; offset < maxPerKind; offset += EXPORT_PAGE_SIZE) {
      const limit = Math.min(EXPORT_PAGE_SIZE, maxPerKind - offset);
      const page = await selectExportDocs(db, userId, kind, { limit, offset });
      docs.push(...page.map((p) => p.doc));
      if (page.length < limit) break;
    }
    if (docs.length >= maxPerKind && (await selectExportDocs(db, userId, kind, { limit: 1, offset: maxPerKind })).length > 0) truncated.push(kind);
    archive[kind] = docs;
  }
  archive.truncated = truncated;
  archive.limitPerKind = maxPerKind;
  const tools = await exportOwnToolRecords(db, userId);
  archive.toolRecords = tools.toolRecords;
  archive.toolRecordsTruncated = tools.truncated;
  return { filename: `debate-ai-saved-data-${now.toISOString().slice(0, 10)}.json`, body: JSON.stringify(archive, null, 2) };
}
