/**
 * @fileoverview D1 store for card text that readers suggest for a References
 * entry whose quote is missing (`POST /api/reference-quote-suggestions`), read
 * and resolved on the admin page's Reference text tab
 * (`/api/admin/reference-suggestions`).
 *
 * The table's schema is `referenceTextSuggestions` in `lib/database/schema.ts`
 * and its migration is `packages/debate-help-docs/migrations/0001_*.sql`.
 * Deploys do not always carry migrations, so — like the feedback store — the
 * table is also created here once per isolate, which makes the first request
 * after a deploy safe either way.
 *
 * Anyone may submit, so the abuse protection lives here: a sender (a salted
 * hash of their address, plus their account when signed in) may file
 * `SUGGESTION_RATE_LIMIT.perHour` suggestions an hour and `.perDay` a day, the
 * same text is never stored twice for one entry, and one entry holds at most
 * `MAX_PENDING_PER_REFERENCE` unreviewed suggestions.
 *
 * @module lib/reference-suggestions/store
 */
import { and, desc, eq, gt, or, sql, type SQL } from "drizzle-orm";
import {
  MAX_PENDING_PER_REFERENCE,
  SUGGESTION_RATE_LIMIT,
  type AdminReferenceSuggestion,
  type ReferenceSuggestionInput,
  type SuggestionStatus,
} from "@debate-ai/help-docs/lib/reference-suggestions";
import type { getDBFromContext } from "@/lib/database/context";
import { referenceTextSuggestions, user } from "@/lib/database/schema";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/** Newest suggestions the admin tab loads. */
export const MAX_ADMIN_SUGGESTION_ROWS = 500;

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

const DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "reference_text_suggestions" (
  "id" text PRIMARY KEY NOT NULL,
  "page" text NOT NULL,
  "ref_id" text NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "text" text NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "name" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "user_id" text,
  "ip_hash" text,
  "user_agent" text,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL,
  "resolved_by" text,
  "resolved_at" integer
)`,
  `CREATE INDEX IF NOT EXISTS "idx_reference_text_suggestions_ref" ON "reference_text_suggestions" ("page", "ref_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "idx_reference_text_suggestions_status" ON "reference_text_suggestions" ("status", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_reference_text_suggestions_ip" ON "reference_text_suggestions" ("ip_hash", "created_at")`,
];

let ensured: Promise<void> | null = null;

/** Creates the table once per isolate; a failure is forgotten and retried. */
export function ensureSuggestionsTable(db: Database): Promise<void> {
  ensured ??= (async () => {
    for (const statement of DDL) await db.run(sql.raw(statement));
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the table was already created. */
export function resetEnsuredSuggestionsTable(): void {
  ensured = null;
}

/** Salted SHA-256 of a client address, so raw IPs are never stored. */
export async function hashClientAddress(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const bytes = new TextEncoder().encode(`debate-ai-reference-suggestions:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface SuggestionSender {
  ipHash: string | null;
  userId: string | null;
  userAgent: string | null;
}

/**
 * Seconds until this sender may file another suggestion, or 0 when they may
 * now. Rows from the same address or the same account count; a sender with
 * neither (no address header, signed out) shares one bucket with the other
 * senders like it, which only tightens the limit.
 */
export async function suggestionWaitSeconds(
  db: Database,
  sender: SuggestionSender,
  now: number = Math.floor(Date.now() / 1000),
): Promise<number> {
  const senderMatch: SQL | undefined = or(
    sender.ipHash ? eq(referenceTextSuggestions.ipHash, sender.ipHash) : undefined,
    sender.userId ? eq(referenceTextSuggestions.userId, sender.userId) : undefined,
    !sender.ipHash && !sender.userId ? sql`${referenceTextSuggestions.ipHash} IS NULL AND ${referenceTextSuggestions.userId} IS NULL` : undefined,
  );
  const rows: { createdAt: Date }[] = await db
    .select({ createdAt: referenceTextSuggestions.createdAt })
    .from(referenceTextSuggestions)
    .where(and(senderMatch, gt(referenceTextSuggestions.createdAt, new Date((now - DAY_SECONDS) * 1000))))
    .orderBy(desc(referenceTextSuggestions.createdAt))
    .limit(SUGGESTION_RATE_LIMIT.perDay);
  const times = rows.map((row) => Math.floor(row.createdAt.getTime() / 1000));

  const waits: number[] = [];
  if (times.length >= SUGGESTION_RATE_LIMIT.perDay) {
    waits.push(times[SUGGESTION_RATE_LIMIT.perDay - 1]! + DAY_SECONDS - now);
  }
  const inHour = times.filter((t) => t > now - HOUR_SECONDS);
  if (inHour.length >= SUGGESTION_RATE_LIMIT.perHour) {
    waits.push(inHour[SUGGESTION_RATE_LIMIT.perHour - 1]! + HOUR_SECONDS - now);
  }
  return waits.length === 0 ? 0 : Math.max(1, ...waits);
}

/** What is already stored for one entry. */
export async function referenceSuggestionState(
  db: Database,
  page: string,
  refId: string,
  text: string,
): Promise<{ pending: number; duplicate: boolean }> {
  const [counts] = await db
    .select({ pending: sql<number>`count(*)` })
    .from(referenceTextSuggestions)
    .where(
      and(
        eq(referenceTextSuggestions.page, page),
        eq(referenceTextSuggestions.refId, refId),
        eq(referenceTextSuggestions.status, "pending"),
      ),
    );
  const [same] = await db
    .select({ id: referenceTextSuggestions.id })
    .from(referenceTextSuggestions)
    .where(
      and(
        eq(referenceTextSuggestions.page, page),
        eq(referenceTextSuggestions.refId, refId),
        eq(referenceTextSuggestions.text, text),
      ),
    )
    .limit(1);
  return { pending: Number(counts?.pending ?? 0), duplicate: !!same };
}

/** True when an entry is at its cap of unreviewed suggestions. */
export function isReferenceFull(pending: number): boolean {
  return pending >= MAX_PENDING_PER_REFERENCE;
}

/** Stores one suggestion and returns its id. */
export async function insertSuggestion(
  db: Database,
  suggestion: ReferenceSuggestionInput,
  sender: SuggestionSender,
  now: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(referenceTextSuggestions).values({
    id,
    ...suggestion,
    status: "pending",
    userId: sender.userId,
    ipHash: sender.ipHash,
    userAgent: sender.userAgent?.slice(0, 300) ?? null,
    createdAt: new Date(now * 1000),
  });
  return id;
}

/** Newest first, with the sender's account name when signed in. `status` omitted lists every status. */
export async function listSuggestions(db: Database, status?: SuggestionStatus): Promise<AdminReferenceSuggestion[]> {
  const rows: Array<Omit<AdminReferenceSuggestion, "createdAt" | "resolvedAt" | "status"> & {
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
  }> = await db
    .select({
      id: referenceTextSuggestions.id,
      page: referenceTextSuggestions.page,
      refId: referenceTextSuggestions.refId,
      title: referenceTextSuggestions.title,
      text: referenceTextSuggestions.text,
      status: referenceTextSuggestions.status,
      userId: referenceTextSuggestions.userId,
      userName: user.name,
      createdAt: referenceTextSuggestions.createdAt,
      resolvedAt: referenceTextSuggestions.resolvedAt,
      resolvedBy: referenceTextSuggestions.resolvedBy,
    })
    .from(referenceTextSuggestions)
    .leftJoin(user, eq(user.id, referenceTextSuggestions.userId))
    .where(status ? eq(referenceTextSuggestions.status, status) : undefined)
    .orderBy(desc(referenceTextSuggestions.createdAt), desc(referenceTextSuggestions.id))
    .limit(MAX_ADMIN_SUGGESTION_ROWS);
  return rows.map((row) => ({
    ...row,
    status: row.status as SuggestionStatus,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  }));
}

/** Counts per status, for the admin tab's filter chips. */
export async function countSuggestionsByStatus(db: Database): Promise<Record<SuggestionStatus, number>> {
  const rows = await db
    .select({ status: referenceTextSuggestions.status, n: sql<number>`count(*)` })
    .from(referenceTextSuggestions)
    .groupBy(referenceTextSuggestions.status);
  const counts: Record<SuggestionStatus, number> = { pending: 0, approved: 0, dismissed: 0 };
  for (const row of rows) if (row.status in counts) counts[row.status as SuggestionStatus] = Number(row.n);
  return counts;
}

/** Moves a suggestion to a status; `pending` clears who resolved it. Returns whether a row matched. */
export async function setSuggestionStatus(
  db: Database,
  id: string,
  status: SuggestionStatus,
  resolvedBy: string | null,
  now: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const rows = await db
    .update(referenceTextSuggestions)
    .set({
      status,
      resolvedBy: status === "pending" ? null : resolvedBy,
      resolvedAt: status === "pending" ? null : new Date(now * 1000),
    })
    .where(eq(referenceTextSuggestions.id, id))
    .returning({ id: referenceTextSuggestions.id });
  return rows.length > 0;
}

/** Deletes one suggestion. Returns whether a row matched. */
export async function deleteSuggestion(db: Database, id: string): Promise<boolean> {
  const rows = await db
    .delete(referenceTextSuggestions)
    .where(eq(referenceTextSuggestions.id, id))
    .returning({ id: referenceTextSuggestions.id });
  return rows.length > 0;
}
