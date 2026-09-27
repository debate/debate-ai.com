/**
 * @fileoverview Builds the SQL that loads caselist documents into the
 * `caselist_documents` table.
 *
 * Shared by the caselist sync CLI (which writes a `.sql` file for local
 * SQLite and Cloudflare D1) and any admin endpoint that runs the statements
 * against the D1 binding. Values are escaped here so both callers produce
 * identical statements.
 * @module caselist/caselist-document-sql
 */

import type { CaselistDocument } from "./caselist-archive";
import type { Caselist } from "./caselist-config";

/** Column order used by every generated `INSERT`. */
export const CASELIST_DOCUMENT_COLUMNS = [
  "id",
  "path_hash",
  "caselist_slug",
  "caselist_label",
  "school",
  "team",
  "side",
  "file_name",
  "archive_path",
  "html",
  "card_count",
  "ingested_at",
  "archive_date",
] as const;

/** Rows per multi-row `INSERT`. */
export const DEFAULT_ROWS_PER_STATEMENT = 50;

/** Byte ceiling for one generated statement. */
export const DEFAULT_MAX_STATEMENT_BYTES = 50_000;

/** Options for {@link buildCaselistDocumentSeedStatements}. */
export interface CaselistDocumentSeedOptions {
  /** Hard cap on rows per statement. */
  maxRows?: number;
  /** Approximate byte cap on one statement's `VALUES` list. */
  maxBytes?: number;
}

/**
 * Renders a value as a SQLite literal, doubling quotes in text.
 *
 * @param value - Column value.
 * @returns The literal, or `NULL`.
 */
export function sqlLiteral(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Computes a stable 64-bit integer ID from a path hash string.
 * Uses the same FNV-1a algorithm as `caselistCardId` but without the floor.
 */
export function caselistDocumentId(pathHash: string): number {
  let high = 0x811c9dc5;
  let low = 0x01000193;
  for (let index = 0; index < pathHash.length; index++) {
    const code = pathHash.charCodeAt(index);
    high = Math.imul(high ^ code, 0x01000193) >>> 0;
    low = Math.imul(low ^ (code + index), 0x5bd1e995) >>> 0;
  }
  // Combine into a 64-bit integer (within Number.MAX_SAFE_INTEGER)
  return (high & 0x7fffffff) * 2 ** 32 + low;
}

/**
 * Builds the path hash used for deduplication.
 */
export function buildPathHash(caselistSlug: string, archivePath: string): string {
  return `${caselistSlug}|${archivePath}`;
}

/**
 * Projects a caselist document onto {@link CASELIST_DOCUMENT_COLUMNS}, in order.
 *
 * @param document - The document from `loadCaselistArchive`.
 * @param caselist - The caselist the archive belongs to.
 * @param archiveDate - The archive date (YYYY-MM-DD) if available.
 * @returns Column values, positionally matching the column list.
 */
export function caselistDocumentSeedValues(
  document: CaselistDocument,
  caselist: Caselist,
  archiveDate?: string,
): (string | number | boolean | null)[] {
  const pathHash = buildPathHash(caselist.slug, document.path);
  const id = caselistDocumentId(pathHash);
  const cardCount = document.cards?.length ?? 0;

  return [
    id,
    pathHash,
    caselist.slug,
    caselist.label,
    document.school ?? "",
    document.team ?? "",
    document.side ?? "",
    document.fileName,
    document.path,
    document.html,
    cardCount,
    Math.floor(Date.now() / 1000),
    archiveDate ?? "",
  ];
}

/**
 * Builds the seed statements: upsert every document, then prune anything the
 * current ingest no longer carries.
 *
 * Batches are bounded by both row count and byte size.
 *
 * @param documents - Documents from `loadCaselistArchive` with `parseCards` on.
 * @param caselist - The caselist the archive belongs to.
 * @param archiveDate - The archive date (YYYY-MM-DD) if available.
 * @param seededAt - Unix seconds captured before the upserts; the prune threshold.
 * @param options - Batching limits. See {@link CaselistDocumentSeedOptions}.
 * @returns One SQL statement per array entry, without trailing semicolons.
 */
export function buildCaselistDocumentSeedStatements(
  documents: CaselistDocument[],
  caselist: Caselist,
  archiveDate: string | undefined,
  seededAt: number,
  options: CaselistDocumentSeedOptions = {},
): string[] {
  const maxRows = Math.max(1, options.maxRows ?? DEFAULT_ROWS_PER_STATEMENT);
  const maxBytes = Math.max(1, options.maxBytes ?? DEFAULT_MAX_STATEMENT_BYTES);

  const statements: string[] = [];
  const columnList = CASELIST_DOCUMENT_COLUMNS.map((c) => `"${c}"`).join(", ");
  const updateList = CASELIST_DOCUMENT_COLUMNS.filter((c) => c !== "id")
    .map((c) => `"${c}" = excluded."${c}"`)
    .join(", ");

  let batch: string[] = [];
  let bytes = 0;

  const flush = () => {
    if (batch.length === 0) return;
    statements.push(
      `INSERT INTO "caselist_documents" (${columnList}) VALUES\n  ${batch.join(",\n  ")}\n` +
        `ON CONFLICT("id") DO UPDATE SET ${updateList}, "ingested_at" = unixepoch()`,
    );
    batch = [];
    bytes = 0;
  };

  for (const document of documents) {
    const values = `(${caselistDocumentSeedValues(document, caselist, archiveDate).map(sqlLiteral).join(", ")})`;
    if (batch.length > 0 && (batch.length >= maxRows || bytes + values.length > maxBytes)) {
      flush();
    }
    batch.push(values);
    bytes += values.length + 4;
  }
  flush();

  // Prune documents that weren't in this ingest but have an older ingested_at
  // (only for this caselist to avoid deleting other caselists' documents)
  statements.push(
    `DELETE FROM "caselist_documents" WHERE "caselist_slug" = ${sqlLiteral(caselist.slug)} AND "ingested_at" < ${seededAt}`,
  );

  return statements;
}