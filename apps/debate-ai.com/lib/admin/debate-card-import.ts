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

import { sql } from "drizzle-orm";
import {
  normalizeDebateCardRows,
  type DebateCardRecord,
  type DebateCardRowFailure,
} from "debate-research-evidence";
import { debateCardImports, debateCards } from "@/lib/database/schema";
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

/** Cards accepted in one request, mirroring the client's batch size ceiling. */
export const MAX_CARDS_PER_REQUEST = 1_000;

/** What one posted batch did, as returned to the importer. */
export interface CardBatchWriteResult {
  imported: number;
  skipped: number;
  failures: DebateCardRowFailure[];
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
    return { imported: 0, skipped: failures.length, failures };
  }

  // A batch that names the same id twice makes SQLite reject the whole
  // statement ("ON CONFLICT DO UPDATE command does not affect row a second
  // time"), so collapse repeats here — last write wins, as it would across
  // two batches.
  const byId = new Map<number, DebateCardRecord>();
  for (const card of cards) byId.set(card.id, card);
  const unique = [...byId.values()];

  const set = buildUpsertSet();
  let imported = 0;
  for (let start = 0; start < unique.length; start += CARD_ROWS_PER_STATEMENT) {
    const slice = unique.slice(start, start + CARD_ROWS_PER_STATEMENT);
    await db
      .insert(debateCards)
      .values(slice.map((card) => buildCardValues(card, sourceFile)))
      .onConflictDoUpdate({ target: debateCards.id, set });
    imported += slice.length;
  }

  return { imported, skipped: failures.length, failures };
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
