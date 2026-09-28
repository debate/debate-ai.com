/**
 * @fileoverview SQL dumps of the shared content tables — videos, debate cards
 * and the sync/import history — with nothing that belongs to a user account.
 *
 * The dump is plain SQLite: `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT
 * EXISTS` for each table as the live database declares it, then one
 * `INSERT OR REPLACE` per row. It restores with `sqlite3 local.db < dump.sql`
 * or `wrangler d1 execute debate-ai-db --remote --file=dump.sql` (which is why
 * it carries no `BEGIN`/`COMMIT` — D1 rejects them in an import file).
 *
 * "Without user-specific data" is enforced two ways:
 *
 * 1. **Allowlist, not denylist.** Only the tables in {@link BACKUP_TABLES} are
 *    read. Accounts, sessions, saved rounds, flows, notifications, contacts,
 *    comments, the browser-extension URL log, subscriptions, the Tabroom
 *    `person`/`student` rows… none of them are ever queried, so a table added
 *    later stays out of backups until someone decides it belongs in one.
 * 2. **Scrubbed columns.** The allowed tables still carry a few "who did this"
 *    columns — admin/reporter emails, a contributor id, the user id that asked
 *    for an AI analysis. Those are written as `NULL` (or `''` where the column
 *    is `NOT NULL`) instead of their value.
 *
 * Rows are read in `rowid` pages and yielded as SQL text chunks, so neither
 * the download route nor the R2 upload ever holds the whole dump in memory.
 * @module lib/admin/db-backup
 */

import { sql } from "drizzle-orm";

/** The groups an admin can tick on the backup panel. */
export const BACKUP_GROUPS = ["videos", "cards", "history"] as const;
export type BackupGroup = (typeof BACKUP_GROUPS)[number];

export const BACKUP_GROUP_LABELS: Record<BackupGroup, string> = {
  videos: "Videos",
  cards: "Debate cards",
  history: "Sync & import history",
};

export interface BackupTable {
  name: string;
  group: BackupGroup;
  /**
   * Columns whose value identifies a person. Each is dumped as the given
   * replacement literal — `null` for nullable columns, `""` for `NOT NULL`
   * text ones — so the row still inserts into the same schema.
   */
  scrub?: Record<string, null | string>;
  /** Rows per query. Lower for tables whose rows carry whole documents. */
  pageSize?: number;
}

/**
 * Every table a backup may read. Anything not listed here is never touched.
 */
export const BACKUP_TABLES: readonly BackupTable[] = [
  // Videos — the published library, its editorial documents and the YouTube
  // queue/channel list that feeds it.
  { name: "videos", group: "videos" },
  { name: "video_transcripts", group: "videos", pageSize: 50 },
  { name: "video_documents", group: "videos", pageSize: 50, scrub: { updated_by: null } },
  { name: "video_relations", group: "videos", scrub: { created_by: null } },
  { name: "video_issues", group: "videos", scrub: { reported_by: null, resolved_by: null } },
  { name: "youtube_round_videos", group: "videos" },
  { name: "youtube_channels", group: "videos", scrub: { added_by: null } },
  { name: "youtube_video_exclusions", group: "videos", scrub: { deleted_by: null } },

  // Debate cards — the card library, caselist documents and the shared
  // caches built from them.
  { name: "debate_cards", group: "cards", pageSize: 200 },
  { name: "caselist_documents", group: "cards", pageSize: 20 },
  { name: "evidence_reuse_index", group: "cards", scrub: { contributor_id: "" } },
  { name: "card_ai_analyses", group: "cards", pageSize: 100, scrub: { user_id: null } },
  { name: "topic_starter_items", group: "cards", pageSize: 100 },

  // History — the run logs of the YouTube sync and the card imports.
  { name: "youtube_sync_runs", group: "history", scrub: { triggered_by: null } },
  { name: "debate_card_imports", group: "history", scrub: { last_imported_by: "" } },
];

const DEFAULT_PAGE_SIZE = 500;

/** Parses `?groups=videos,cards` (or an array) into known groups; empty means all. */
export function parseBackupGroups(raw: string | string[] | null | undefined): BackupGroup[] {
  const parts = (Array.isArray(raw) ? raw : (raw ?? "").split(","))
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const picked = BACKUP_GROUPS.filter((group) => parts.includes(group));
  return picked.length > 0 ? picked : [...BACKUP_GROUPS];
}

export function tablesForGroups(groups: readonly BackupGroup[]): BackupTable[] {
  return BACKUP_TABLES.filter((table) => groups.includes(table.group));
}

/** Double-quoted SQLite identifier. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** One value as a SQLite literal. */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return String(Math.floor(value.getTime() / 1000));
  // Blobs: libSQL hands back an ArrayBuffer, D1 a plain array of byte values.
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) || Array.isArray(value)) {
    const bytes =
      value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : ArrayBuffer.isView(value)
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : Uint8Array.from(value as number[]);
    let hex = "";
    for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
    return `X'${hex}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** The slice of drizzle's SQLite database this module uses (D1 and libSQL both have it). */
export interface BackupDb {
  all(query: ReturnType<typeof sql.raw>): Promise<unknown[]>;
}

interface SchemaRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

/** Rows written per table, filled in while a dump is generated. */
export interface BackupStats {
  tables: Record<string, number>;
  /** Allowed tables the database does not have (e.g. a migration not yet run). */
  missing: string[];
  totalRows: number;
}

export function emptyBackupStats(): BackupStats {
  return { tables: {}, missing: [], totalRows: 0 };
}

/** Rewrites a `CREATE TABLE`/`CREATE INDEX` from sqlite_master to be re-runnable. */
function ifNotExists(statement: string): string {
  return statement
    .replace(/^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE TABLE IF NOT EXISTS ")
    .replace(/^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, (_m, unique) => `CREATE ${unique ?? ""}INDEX IF NOT EXISTS `);
}

const FK_ACTIONS = String.raw`(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:SET\s+NULL|SET\s+DEFAULT|CASCADE|RESTRICT|NO\s+ACTION))*`;
const IDENT = String.raw`[\x60"\[]?(\w+)[\x60"\]]?`;

/**
 * Drops foreign keys that point at a table the dump does not carry (e.g.
 * `card_ai_analyses.user_id` → `user`), so the dump restores into an empty
 * database. The referencing column itself is kept — and already scrubbed.
 */
export function stripForeignKeysOutside(createSql: string, kept: ReadonlySet<string>): string {
  const tableLevel = new RegExp(String.raw`,\s*(?:CONSTRAINT\s+\S+\s+)?FOREIGN\s+KEY\s*\([^)]*\)\s*REFERENCES\s+${IDENT}\s*\([^)]*\)${FK_ACTIONS}`, "gi");
  const inline = new RegExp(String.raw`\s+REFERENCES\s+${IDENT}\s*\([^)]*\)${FK_ACTIONS}`, "gi");
  return createSql
    .replace(tableLevel, (match, table: string) => (kept.has(table) ? match : ""))
    .replace(inline, (match, table: string) => (kept.has(table) ? match : ""));
}

/**
 * Generates the dump as a sequence of SQL text chunks.
 *
 * @param db - Any drizzle SQLite database (the D1 binding in production).
 * @param groups - Which table groups to include.
 * @param stats - Filled in with per-table row counts as the dump is produced.
 */
export async function* generateBackupSql(
  db: BackupDb,
  groups: readonly BackupGroup[] = BACKUP_GROUPS,
  stats: BackupStats = emptyBackupStats(),
  now: Date = new Date(),
): AsyncGenerator<string> {
  const tables = tablesForGroups(groups);
  const keptTables = new Set(tables.map((table) => table.name));
  const names = tables.map((table) => sqlLiteral(table.name)).join(", ");
  const schemaRows = (await db.all(
    sql.raw(
      `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name IN (${names}) AND sql IS NOT NULL ORDER BY type DESC, name`,
    ),
  )) as SchemaRow[];

  yield [
    "-- debate-ai content backup (no user account data)",
    `-- Generated: ${now.toISOString()}`,
    `-- Groups: ${groups.join(", ")}`,
    "-- Restore: sqlite3 local.db < this-file.sql",
    "--      or: wrangler d1 execute debate-ai-db --remote --file=this-file.sql",
    "PRAGMA defer_foreign_keys = true;",
    "",
    "",
  ].join("\n");

  for (const table of tables) {
    const create = schemaRows.find((row) => row.type === "table" && row.name === table.name);
    if (!create?.sql) {
      stats.missing.push(table.name);
      yield `-- Table ${table.name} does not exist in this database; skipped.\n\n`;
      continue;
    }

    const columns = ((await db.all(sql.raw(`PRAGMA table_info(${quoteIdent(table.name)})`))) as Array<{ name: string }>).map(
      (column) => column.name,
    );
    const indexes = schemaRows.filter((row) => row.type === "index" && row.tbl_name === table.name && row.sql);

    let out = `-- ${table.name}${table.scrub ? ` (scrubbed: ${Object.keys(table.scrub).join(", ")})` : ""}\n`;
    out += `${ifNotExists(stripForeignKeysOutside(create.sql, keptTables))};\n`;
    for (const index of indexes) out += `${ifNotExists(index.sql as string)};\n`;
    yield out;

    const insertPrefix = `INSERT OR REPLACE INTO ${quoteIdent(table.name)} (${columns.map(quoteIdent).join(", ")}) VALUES (`;
    const selectList = columns.map(quoteIdent).join(", ");
    const pageSize = table.pageSize ?? DEFAULT_PAGE_SIZE;
    let lastRowid: number | null = null;
    let count = 0;

    for (;;) {
      const where = lastRowid === null ? "" : `WHERE rowid > ${lastRowid} `;
      const rows = (await db.all(
        sql.raw(
          `SELECT rowid AS "__backup_rowid", ${selectList} FROM ${quoteIdent(table.name)} ${where}ORDER BY rowid LIMIT ${pageSize}`,
        ),
      )) as Array<Record<string, unknown>>;
      if (rows.length === 0) break;

      let chunk = "";
      for (const row of rows) {
        const values = columns.map((column) =>
          table.scrub && column in table.scrub ? sqlLiteral(table.scrub[column]) : sqlLiteral(row[column]),
        );
        chunk += `${insertPrefix}${values.join(", ")});\n`;
      }
      count += rows.length;
      yield chunk;

      lastRowid = Number(rows[rows.length - 1].__backup_rowid);
      if (rows.length < pageSize) break;
    }

    stats.tables[table.name] = count;
    stats.totalRows += count;
    yield `-- ${table.name}: ${count} rows\n\n`;
  }

  yield "-- End of backup\n";
}

/** A ReadableStream of the dump's UTF-8 bytes, for a download response. */
export function backupSqlStream(
  db: BackupDb,
  groups: readonly BackupGroup[],
  stats: BackupStats = emptyBackupStats(),
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = generateBackupSql(db, groups, stats);
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

/** `debate-ai-backup-2026-09-28T08-00-00Z.sql` */
export function backupFileName(now: Date = new Date(), extension = "sql"): string {
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
  return `debate-ai-backup-${stamp}.${extension}`;
}
