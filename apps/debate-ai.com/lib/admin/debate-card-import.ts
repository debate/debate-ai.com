/**
 * @fileoverview Server side of the debate-card Parquet import.
 *
 * Both importers — the `debate-cards-upload` CLI and the admin panel's
 * uploader — decode Parquet on the client and post batches of already
 * normalized cards here, because a 500MB shard cannot be uploaded to a
 * Worker and a Worker has no room to decode one. This module is what those
 * batches land in: it re-validates every row (a client is not trusted to
 * have normalized correctly), writes them, and keeps the per-shard tally the
 * admin panel reads back.
 *
 * @module lib/admin/debate-card-import
 */

import { inArray, sql } from "drizzle-orm";
import {
  buildParquetCardReuseEntry,
  normalizeDebateCardRows,
  parquetCardReuseId,
  type DebateCardRecord,
  type DebateCardRowFailure,
  type ParquetCardReuseEntry,
} from "debate-research-evidence";
import { debateCardImports, debateCards, evidenceReuseIndex } from "@/lib/database/schema";
import { getEnv } from "@/lib/env";
import { getAdminAccess } from "@/lib/auth/admin";

/** Columns written per row, matching {@link buildCardValues}. */
const CARD_INSERT_COLUMNS = 20;

/**
 * Rows per INSERT statement.
 *
 * D1 allows at most 100 bound parameters per statement, so a wider batch
 * fails at the driver with a message that says nothing about cards. Batching
 * happens above this either way — a posted batch is split into as many
 * statements as it needs.
 */
export const CARD_ROWS_PER_STATEMENT = Math.floor(100 / CARD_INSERT_COLUMNS);

/** Columns written per `evidence_reuse_index` row ({@link ParquetCardReuseEntry}). */
const REUSE_INSERT_COLUMNS = 7;

/** Reuse-index rows per INSERT, under the same 100-parameter ceiling. */
export const REUSE_ROWS_PER_STATEMENT = Math.floor(100 / REUSE_INSERT_COLUMNS);

/** Ids per `DELETE … WHERE id IN (…)`, under the same ceiling. */
const REUSE_IDS_PER_DELETE = 90;

/** Cards accepted in one request, mirroring the client's batch size ceiling. */
export const MAX_CARDS_PER_REQUEST = 1_000;

/** What one posted batch did, as returned to the importer. */
export interface CardBatchWriteResult {
  imported: number;
  skipped: number;
  failures: DebateCardRowFailure[];
  /** Cards whose citation named a source URL, now in the reuse index. */
  reuseIndexed: number;
}

/**
 * Compares two secrets without leaking their contents through timing.
 *
 * @param a - The value presented by the caller.
 * @param b - The configured secret.
 * @returns Whether they match.
 */
function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

/** Who is importing, and how they proved it. */
export interface CardImportAccess {
  allowed: boolean;
  /** Admin email for a session-authenticated import, or a token label. */
  actor: string;
  via: "session" | "token" | "none";
}

/**
 * Authorizes an import request.
 *
 * The admin panel arrives with the operator's session cookie; the CLI runs on
 * a laptop or in CI with no session, so it presents `CARD_IMPORT_TOKEN` as a
 * bearer token instead. The token path only exists when that secret is
 * configured — an unset secret must not become an unauthenticated write path.
 *
 * @param request - The incoming request.
 * @returns Whether the import may proceed, and on whose behalf.
 */
export async function authorizeCardImport(request: Request): Promise<CardImportAccess> {
  const configuredToken = getEnv("CARD_IMPORT_TOKEN")?.trim();
  const header = request.headers.get("authorization") ?? "";
  const presented = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (configuredToken && presented && timingSafeEquals(presented, configuredToken)) {
    return { allowed: true, actor: "card-import-token", via: "token" };
  }

  const { isAdmin, email } = await getAdminAccess();
  if (isAdmin) return { allowed: true, actor: email ?? "admin", via: "session" };

  return { allowed: false, actor: email ?? "", via: "none" };
}

/**
 * Card fields copied from the incoming row on an id conflict, as
 * `[drizzle field, SQL column]`.
 */
const UPSERT_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["tag", "tag"],
  ["cite", "cite"],
  ["fullcite", "fullcite"],
  ["summary", "summary"],
  ["spoken", "spoken"],
  ["fulltext", "fulltext"],
  ["textLength", "text_length"],
  ["markup", "markup"],
  ["pocket", "pocket"],
  ["hat", "hat"],
  ["block", "block"],
  ["bucketId", "bucket_id"],
  ["duplicateCount", "duplicate_count"],
  ["side", "side"],
  ["caselistDisplayName", "caselist_display_name"],
  ["year", "year"],
  ["event", "event"],
  ["level", "level"],
  ["sourceFile", "source_file"],
];

/**
 * Builds the `SET` clause that replays an incoming row over the stored one.
 *
 * Re-importing a shard has to be a safe, idempotent correction rather than a
 * duplicate corpus, so a conflicting id takes the new row's values wholesale
 * and re-stamps `imported_at`.
 *
 * @returns The drizzle `set` object for `onConflictDoUpdate`.
 */
function buildUpsertSet(): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const [field, column] of UPSERT_COLUMNS) {
    set[field] = sql.raw(`excluded.${column}`);
  }
  set.importedAt = sql`(unixepoch())`;
  return set;
}

/** Maps a normalized card onto the row the table stores. */
function buildCardValues(card: DebateCardRecord, sourceFile: string) {
  return {
    id: card.id,
    tag: card.tag,
    cite: card.cite,
    fullcite: card.fullcite,
    summary: card.summary,
    spoken: card.spoken,
    fulltext: card.fulltext,
    textLength: card.textLength,
    markup: card.markup,
    pocket: card.pocket,
    hat: card.hat,
    block: card.block,
    bucketId: card.bucketId,
    duplicateCount: card.duplicateCount,
    side: card.side,
    caselistDisplayName: card.caselistDisplayName,
    year: card.year,
    event: card.event,
    level: card.level,
    sourceFile,
  };
}

/**
 * Validates and writes one posted batch of cards.
 *
 * The payload is re-normalized rather than trusted: the same rules the CLI
 * applied locally decide what lands here, so a hand-rolled client cannot
 * write a card with no id, no text, or a megabyte of HTML in one cell.
 *
 * @param db - Drizzle database handle.
 * @param rawCards - Cards as posted.
 * @param sourceFile - Shard the batch came from.
 * @returns Rows written, rows refused, and why.
 */
export async function writeDebateCardBatch(
  db: any,
  rawCards: readonly unknown[],
  sourceFile: string,
): Promise<CardBatchWriteResult> {
  const { cards, failures } = normalizeDebateCardRows(rawCards);
  if (cards.length === 0) {
    return { imported: 0, skipped: failures.length, failures, reuseIndexed: 0 };
  }

  // A batch that names the same id twice makes SQLite reject the whole
  // statement ("ON CONFLICT DO UPDATE command does not affect row a second
  // time"), so collapse repeats here — last write wins, as it would across
  // two batches.
  const byId = new Map<number, DebateCardRecord>();
  for (const card of cards) byId.set(card.id, card);
  const unique = [...byId.values()];

  const set = buildUpsertSet();
  const statements = [];
  for (let start = 0; start < unique.length; start += CARD_ROWS_PER_STATEMENT) {
    const slice = unique.slice(start, start + CARD_ROWS_PER_STATEMENT);
    statements.push(
      db
        .insert(debateCards)
        .values(slice.map((card) => buildCardValues(card, sourceFile)))
        .onConflictDoUpdate({ target: debateCards.id, set }),
    );
  }
  const reuse = buildReuseIndexStatements(db, unique);
  statements.push(...reuse.statements);

  // The parameter ceiling turns one posted batch into ~50 statements, and
  // awaiting them one at a time is ~50 D1 round trips inside a single
  // request — the slowest part of a shard that arrives in thousands of
  // batches. `batch()` sends them together, and applies them as one
  // transaction, so a batch either lands whole or not at all.
  if (typeof db.batch === "function") {
    await db.batch(statements);
  } else {
    for (const statement of statements) await statement;
  }

  return { imported: unique.length, skipped: failures.length, failures, reuseIndexed: reuse.indexed };
}

/**
 * Builds the statements that keep the on-page reuse check in step with the
 * cards being written.
 *
 * Each card goes through `debate-card-parser` for the URL its citation names;
 * one that has a URL is upserted into `evidence_reuse_index` as `card:<id>`,
 * and one that no longer has a URL (a re-import that corrected its cite) has
 * any earlier entry removed, so a page never reads as cut by a card that was
 * not cut from it.
 *
 * @param db - Drizzle database handle.
 * @param cards - The cards being written, one per id.
 * @returns The statements to run alongside the card upserts, and how many
 *   cards were indexed.
 */
export function buildReuseIndexStatements(
  db: any,
  cards: readonly Pick<DebateCardRecord, "id" | "tag" | "cite" | "fullcite" | "caselistDisplayName">[],
): { statements: unknown[]; indexed: number } {
  const entries: ParquetCardReuseEntry[] = [];
  const unindexedIds: string[] = [];
  for (const card of cards) {
    const entry = buildParquetCardReuseEntry(card);
    if (entry) entries.push(entry);
    else unindexedIds.push(parquetCardReuseId(card.id));
  }

  const reuseSet = {
    sourceUrl: sql.raw("excluded.source_url"),
    normalizedUrl: sql.raw("excluded.normalized_url"),
    cite: sql.raw("excluded.cite"),
    argBlock: sql.raw("excluded.arg_block"),
    topic: sql.raw("excluded.topic"),
  };
  const statements: unknown[] = [];
  for (let start = 0; start < entries.length; start += REUSE_ROWS_PER_STATEMENT) {
    statements.push(
      db
        .insert(evidenceReuseIndex)
        .values(entries.slice(start, start + REUSE_ROWS_PER_STATEMENT))
        .onConflictDoUpdate({ target: evidenceReuseIndex.id, set: reuseSet }),
    );
  }
  for (let start = 0; start < unindexedIds.length; start += REUSE_IDS_PER_DELETE) {
    statements.push(
      db
        .delete(evidenceReuseIndex)
        .where(inArray(evidenceReuseIndex.id, unindexedIds.slice(start, start + REUSE_IDS_PER_DELETE))),
    );
  }
  return { statements, indexed: entries.length };
}

/**
 * Records what one shard's import has done so far.
 *
 * Called once per batch, so the counters accumulate over the thousands of
 * requests a single shard arrives in — that running total is what the admin
 * panel shows for an import still in flight, and what distinguishes a
 * finished import from one that stopped halfway.
 *
 * @param db - Drizzle database handle.
 * @param entry - The shard, the batch's counts, and who sent it.
 */
export async function recordCardImportBatch(
  db: any,
  entry: {
    fileName: string;
    imported: number;
    skipped: number;
    importId: string;
    actor: string;
  },
): Promise<void> {
  await db
    .insert(debateCardImports)
    .values({
      fileName: entry.fileName,
      rowsImported: entry.imported,
      rowsSkipped: entry.skipped,
      lastImportId: entry.importId,
      lastImportedBy: entry.actor,
    })
    .onConflictDoUpdate({
      target: debateCardImports.fileName,
      set: {
        // Batches of the same run accumulate; a new run id means the shard is
        // being re-imported, and its counters start over rather than showing
        // twice the rows the file actually holds.
        rowsImported: sql`CASE WHEN ${debateCardImports.lastImportId} = ${entry.importId} THEN ${debateCardImports.rowsImported} + ${entry.imported} ELSE ${entry.imported} END`,
        rowsSkipped: sql`CASE WHEN ${debateCardImports.lastImportId} = ${entry.importId} THEN ${debateCardImports.rowsSkipped} + ${entry.skipped} ELSE ${entry.skipped} END`,
        lastImportId: entry.importId,
        lastImportedBy: entry.actor,
        lastImportedAt: sql`(unixepoch())`,
      },
    });
}
