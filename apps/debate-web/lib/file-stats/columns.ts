/**
 * @fileoverview The size-stat columns (quotes, blocks, pages, characters)
 * every write of a stored Debate Editor file fills in, and the guard that
 * adds `documents`' newer columns to an older D1. See `./backfill.ts` for
 * rows written before the columns existed.
 *
 * @module lib/file-stats/columns
 */

import { computeStoredFileStats, type FileStats } from "@debate-ai/reason-docs/lib/file-stats/file-stats";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { documents } from "@/lib/database/schema";

/** Adds `documents`' newer columns (author, stats) to a D1 made before them.
 *  Call before any `select()` or insert on the table. */
export function ensureDocumentColumns(db: unknown): Promise<void> {
  return ensureTableColumns(db, documents);
}

/** The stat columns for a row about to be written with `content`. */
export async function fileStatColumns(content: string | null | undefined, format: string | null | undefined): Promise<FileStats> {
  return computeStoredFileStats({ content: content ?? "", format: format ?? null });
}
