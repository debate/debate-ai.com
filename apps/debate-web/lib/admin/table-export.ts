/**
 * @fileoverview Admin export of single tables: the videos, teams and schools,
 * historical tournament records and judge paradigms, as CSV or JSON.
 *
 * Unlike the SQL backup (lib/admin/db-backup.ts) this is for opening a table in
 * a spreadsheet or script, one file per table. Two rules keep it to the
 * smaller, shareable tables:
 *
 * 1. **Allowlist.** Only {@link EXPORT_TABLES} can be exported. The evidence
 *    tables (`debate_cards`, `caselist_documents`, the reuse index and card
 *    analyses) are deliberately absent — they are the large ones and already
 *    have the SQL backup — and so is every account table (users, sessions,
 *    saved work, the Tabroom `person` rows).
 * 2. **Live discovery.** {@link listExportTables} reports only the allowed
 *    tables this database actually has, with their row counts, so a table from
 *    a migration that has not run yet simply does not show.
 *
 * Exports are **uncapped**: every row is read, in `rowid` pages sized by
 * {@link PAGE_BYTE_BUDGET} (the same budget as the SQL backup), and streamed
 * out a chunk at a time, so the Worker never holds more than one page.
 * @module lib/admin/table-export
 */

import { sql } from "drizzle-orm";
import { pageEnd, PAGE_BYTE_BUDGET, quoteIdent, sqlLiteral, type BackupDb } from "./db-backup";

/** The sections of the export panel. */
export const EXPORT_GROUPS = ["videos", "teams", "records", "judges"] as const;
export type ExportGroup = (typeof EXPORT_GROUPS)[number];

export const EXPORT_GROUP_LABELS: Record<ExportGroup, string> = {
  videos: "Videos",
  teams: "Teams, schools & rankings",
  records: "Tournament records & results",
  judges: "Judges",
};

export interface ExportTable {
  name: string;
  group: ExportGroup;
  /** Rows per query. Lower for tables whose rows carry whole documents. */
  pageSize?: number;
}

/** Every table the export may read. Anything not listed here is never touched. */
export const EXPORT_TABLES: readonly ExportTable[] = [
  // Videos — the published library and the YouTube queue/channel list.
  { name: "videos", group: "videos" },
  { name: "video_relations", group: "videos" },
  { name: "video_issues", group: "videos" },
  { name: "video_durations", group: "videos" },
  { name: "video_documents", group: "videos", pageSize: 50 },
  { name: "video_transcripts", group: "videos", pageSize: 50 },
  { name: "video_ai_results", group: "videos", pageSize: 100 },
  { name: "youtube_round_videos", group: "videos" },
  { name: "youtube_channels", group: "videos" },
  { name: "youtube_video_exclusions", group: "videos" },
  { name: "youtube_sync_runs", group: "videos" },

  // Teams, schools and the stored past-season rankings.
  { name: "school_profiles", group: "teams" },
  { name: "extinction_season_files", group: "teams", pageSize: 20 },
  { name: "topic_area_rankings", group: "teams" },

  // Tournament records — the Tabroom tables (debate-tournaments): tournaments,
  // divisions, entries, rounds, ballots and published results.
  { name: "tourn", group: "records" },
  { name: "event", group: "records" },
  { name: "school", group: "records" },
  { name: "chapter", group: "records" },
  { name: "circuit", group: "records" },
  { name: "entry", group: "records" },
  { name: "round", group: "records" },
  { name: "panel", group: "records" },
  { name: "ballot", group: "records" },
  { name: "score", group: "records" },
  { name: "result_set", group: "records" },
  { name: "result", group: "records" },
  { name: "result_key", group: "records" },
  { name: "result_value", group: "records" },

  // Judges — scraped paradigms and the Tabroom judge rows.
  { name: "judge_paradigms", group: "judges", pageSize: 100 },
  { name: "judge", group: "judges" },
];

export const EXPORT_FORMATS = ["csv", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: string | null | undefined): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value ?? "");
}

const DEFAULT_PAGE_SIZE = 500;
/** Small rows are batched into chunks of about this many characters. */
const CHUNK_CHARS = 1024 * 1024;

export function findExportTable(name: string): ExportTable | undefined {
  return EXPORT_TABLES.find((table) => table.name === name);
}

/** Parses `?tables=videos,school_profiles` into allowed tables (in catalog order); unknown names are dropped. */
export function parseExportTables(raw: string | string[] | null | undefined): ExportTable[] {
  const parts = new Set(
    (Array.isArray(raw) ? raw : (raw ?? "").split(","))
      .map((part) => part.trim())
      .filter(Boolean),
  );
  return EXPORT_TABLES.filter((table) => parts.has(table.name));
}

export interface ExportTableInfo {
  name: string;
  group: ExportGroup;
  rows: number;
}

/** The allowed tables this database has, each with its row count. */
export async function listExportTables(db: BackupDb): Promise<ExportTableInfo[]> {
  const names = EXPORT_TABLES.map((table) => sqlLiteral(table.name)).join(", ");
  const present = new Set(
    ((await db.all(sql.raw(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${names})`))) as Array<{ name: string }>).map(
      (row) => row.name,
    ),
  );
  const out: ExportTableInfo[] = [];
  for (const table of EXPORT_TABLES) {
    if (!present.has(table.name)) continue;
    const [row] = (await db.all(sql.raw(`SELECT COUNT(*) AS "n" FROM ${quoteIdent(table.name)}`))) as Array<{ n: unknown }>;
    out.push({ name: table.name, group: table.group, rows: Number(row?.n) || 0 });
  }
  return out;
}

/** True when the database has this table. */
export async function exportTableExists(db: BackupDb, name: string): Promise<boolean> {
  const rows = (await db.all(sql.raw(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${sqlLiteral(name)}`))) as unknown[];
  return rows.length > 0;
}

/** Blobs (an ArrayBuffer from libSQL, a byte array from D1) as hex; everything else as-is. */
function plainValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    let hex = "";
    for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
    return hex;
  }
  return value;
}

/** One CSV field (RFC 4180): quoted when it holds a comma, quote or line break. */
export function csvField(value: unknown): string {
  const plain = plainValue(value);
  if (plain === null) return "";
  const text = typeof plain === "object" ? JSON.stringify(plain) : String(plain);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Every row of `table`, in `rowid` order, one page at a time.
 * Pages hold at most `pageSize` rows and about {@link PAGE_BYTE_BUDGET} bytes.
 */
async function* tablePages(db: BackupDb, table: ExportTable, columns: string[]): AsyncGenerator<Array<Record<string, unknown>>> {
  const selectList = columns.map(quoteIdent).join(", ");
  const byteExpr = columns.map((column) => `ifnull(length(${quoteIdent(column)}), 0)`).join(" + ") || "0";
  const pageSize = table.pageSize ?? DEFAULT_PAGE_SIZE;
  let lastRowid: number | null = null;

  for (;;) {
    const after = lastRowid === null ? "" : `WHERE rowid > ${lastRowid} `;
    const sizes = (await db.all(
      sql.raw(`SELECT rowid AS "__export_rowid", ${byteExpr} AS "__export_bytes" FROM ${quoteIdent(table.name)} ${after}ORDER BY rowid LIMIT ${pageSize}`),
    )) as Array<{ __export_rowid: unknown; __export_bytes: unknown }>;
    if (sizes.length === 0) return;
    const lastInPage = pageEnd(sizes.map((row) => Number(row.__export_bytes) || 0), PAGE_BYTE_BUDGET);
    const upTo = Number(sizes[lastInPage].__export_rowid);
    const range = lastRowid === null ? `WHERE rowid <= ${upTo} ` : `WHERE rowid > ${lastRowid} AND rowid <= ${upTo} `;
    yield (await db.all(sql.raw(`SELECT ${selectList} FROM ${quoteIdent(table.name)} ${range}ORDER BY rowid`))) as Array<Record<string, unknown>>;
    lastRowid = upTo;
    if (sizes.length < pageSize && lastInPage === sizes.length - 1) return;
  }
}

/**
 * The whole table as text chunks: CSV with a header row, or a JSON array of
 * row objects. Reads every row — there is no cap.
 */
export async function* generateTableExport(db: BackupDb, table: ExportTable, format: ExportFormat): AsyncGenerator<string> {
  const columns = ((await db.all(sql.raw(`PRAGMA table_info(${quoteIdent(table.name)})`))) as Array<{ name: string }>).map((column) => column.name);

  let chunk = format === "csv" ? `${columns.map(csvField).join(",")}\r\n` : "[";
  let first = true;
  for await (const rows of tablePages(db, table, columns)) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (format === "csv") {
        chunk += `${columns.map((column) => csvField(row[column])).join(",")}\r\n`;
      } else {
        const record: Record<string, unknown> = {};
        for (const column of columns) record[column] = plainValue(row[column]);
        chunk += `${first ? "\n" : ",\n"}${JSON.stringify(record)}`;
        first = false;
      }
      rows[i] = undefined as unknown as Record<string, unknown>;
      if (chunk.length >= CHUNK_CHARS) {
        yield chunk;
        chunk = "";
      }
    }
  }
  if (format === "json") chunk += first ? "]\n" : "\n]\n";
  if (chunk) yield chunk;
}

/** A ReadableStream of the export's UTF-8 bytes, for a download response or a zip entry. */
export function tableExportStream(db: BackupDb, table: ExportTable, format: ExportFormat): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = generateTableExport(db, table, format);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
}

/** `videos-2026-11-04.csv`, or `debate-ai-tables-2026-11-04.zip` for several. */
export function tableExportFileName(name: string, extension: string, now: Date = new Date()): string {
  return `${name}-${now.toISOString().slice(0, 10)}.${extension}`;
}
