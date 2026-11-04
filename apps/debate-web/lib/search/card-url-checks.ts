/**
 * @fileoverview Stores and reads the result of rechecking each card's source
 * URL, so the card search can show whether a card's source page still opens.
 *
 * The admin "Validate debate card URLs" run HEAD-requests every stored
 * `debate_cards.source_url` and saves one row per card here
 * ({@link saveCardUrlChecks}). The search route then looks the rows up for
 * the page of cards it returns ({@link attachCardUrlChecks}) and the result
 * list and card reader draw a status icon from them.
 *
 * The table lives beside `debate_cards` rather than in it so the search's
 * `select()` over that table never names a column a live D1 lacks. There is
 * no tracked migrations folder, so the table is created here at runtime
 * ({@link ensureCardUrlCheckTable}) — by the admin run, never by a search,
 * which only reads and treats a missing table as "not checked yet".
 *
 * @module lib/search/card-url-checks
 */

import { inArray, sql } from "drizzle-orm";
import { debateCardUrlChecks } from "@/lib/database/schema";

/** Outcome of one HEAD request against a card's source URL. */
export type CardUrlStatus = "valid" | "invalid" | "error";

/** What the search attaches to a card whose source URL has been checked. */
export interface CardUrlCheck {
  status: CardUrlStatus;
  /** HTTP status code, when the server answered at all. */
  statusCode?: number;
  /** Why the check failed — `HTTP 404`, `Timeout after 8000ms`, … */
  error?: string;
  /** Unix seconds of the check. */
  checkedAt: number;
}

/** One check to save, as the validate route produces it. */
export interface CardUrlCheckInput {
  cardId: number;
  url: string;
  status: CardUrlStatus;
  statusCode?: number;
  error?: string;
}

/** Idempotent DDL matching `debateCardUrlChecks` in lib/database/schema.ts. */
export const CARD_URL_CHECK_DDL = `CREATE TABLE IF NOT EXISTS "debate_card_url_checks" (
  "card_id" integer PRIMARY KEY NOT NULL,
  "url" text NOT NULL,
  "status" text NOT NULL,
  "status_code" integer,
  "error" text,
  "checked_at" integer NOT NULL
)`;

/** 6 bound values per row — kept under D1's 100-parameter ceiling. */
const ROWS_PER_UPSERT = 16;
/** Card ids per lookup `IN (…)`. */
const IDS_PER_LOOKUP = 90;

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

let ensured: Promise<void> | null = null;

/** Creates the URL-check table once per isolate; a failure is forgotten and retried. */
export function ensureCardUrlCheckTable(db: unknown): Promise<void> {
  ensured ??= (db as RawDB).run(sql.raw(CARD_URL_CHECK_DDL)).then(() => undefined);
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the table was already created. */
export function resetEnsuredCardUrlCheckTable(): void {
  ensured = null;
}

/**
 * Upserts one page of URL checks, replacing each card's previous result.
 *
 * @param db - Drizzle database handle.
 * @param checks - The checks the validate route just ran.
 * @param now - Unix seconds to stamp them with.
 */
export async function saveCardUrlChecks(
  db: any,
  checks: readonly CardUrlCheckInput[],
  now: number = Math.floor(Date.now() / 1000),
): Promise<void> {
  if (checks.length === 0) return;
  await ensureCardUrlCheckTable(db);
  const statements: unknown[] = [];
  for (let start = 0; start < checks.length; start += ROWS_PER_UPSERT) {
    const rows = checks.slice(start, start + ROWS_PER_UPSERT).map((check) => ({
      cardId: check.cardId,
      url: check.url,
      status: check.status,
      statusCode: check.statusCode ?? null,
      error: check.error ?? null,
      checkedAt: now,
    }));
    statements.push(
      db
        .insert(debateCardUrlChecks)
        .values(rows)
        .onConflictDoUpdate({
          target: debateCardUrlChecks.cardId,
          set: {
            url: sql.raw("excluded.url"),
            status: sql.raw("excluded.status"),
            statusCode: sql.raw("excluded.status_code"),
            error: sql.raw("excluded.error"),
            checkedAt: sql.raw("excluded.checked_at"),
          },
        }),
    );
  }
  if (typeof db.batch === "function") await db.batch(statements);
  else for (const statement of statements) await statement;
}

/**
 * Reads the saved checks for a page of cards.
 *
 * A check only counts while it is for the URL the card stores now — a card
 * whose URL was re-extracted since is "not checked" until the next run.
 * Never throws: a database that has no check table yet (the admin run has
 * never been started) simply has no checks.
 *
 * @param db - Drizzle database handle.
 * @param cards - The cards' ids and stored source URLs.
 * @returns Each checked card's result, by id.
 */
export async function readCardUrlChecks(
  db: any,
  cards: readonly { id: number; sourceUrl?: string | null }[],
): Promise<Map<number, CardUrlCheck>> {
  const checks = new Map<number, CardUrlCheck>();
  const urls = new Map<number, string>();
  for (const card of cards) if (card.sourceUrl) urls.set(card.id, card.sourceUrl);
  if (urls.size === 0) return checks;

  const ids = [...urls.keys()];
  try {
    for (let start = 0; start < ids.length; start += IDS_PER_LOOKUP) {
      const rows = await db
        .select()
        .from(debateCardUrlChecks)
        .where(inArray(debateCardUrlChecks.cardId, ids.slice(start, start + IDS_PER_LOOKUP)));
      for (const row of rows) {
        if (urls.get(row.cardId) !== row.url) continue;
        checks.set(row.cardId, {
          status: row.status as CardUrlStatus,
          ...(row.statusCode != null ? { statusCode: row.statusCode } : {}),
          ...(row.error ? { error: row.error } : {}),
          checkedAt: row.checkedAt,
        });
      }
    }
  } catch {
    // No check table yet, or a transient read failure: show no status rather
    // than failing the search.
  }
  return checks;
}

/**
 * Adds `urlCheck` to each card that has a current saved check.
 *
 * @param db - Drizzle database handle.
 * @param cards - Card rows about to be mapped into search results.
 * @returns The same rows, with `urlCheck` set where one exists.
 */
export async function attachCardUrlChecks<T extends { id: number; sourceUrl?: string | null }>(
  db: any,
  cards: T[],
): Promise<(T & { urlCheck?: CardUrlCheck })[]> {
  const checks = await readCardUrlChecks(db, cards);
  if (checks.size === 0) return cards;
  return cards.map((card) => {
    const urlCheck = checks.get(card.id);
    return urlCheck ? { ...card, urlCheck } : card;
  });
}
