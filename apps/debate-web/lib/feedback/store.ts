/**
 * @fileoverview D1 store for site feedback sent from the Settings footer's
 * Feedback dialog (`POST /api/feedback`) and read on the admin page's
 * Feedback tab (`/api/admin/feedback`).
 *
 * The app ships no migrations folder, so the table is created here once per
 * isolate. One submission an hour is allowed per client address (kept only as
 * a salted SHA-256 hash), per account and per email address, whichever of the
 * three matches first.
 *
 * @module lib/feedback/store
 */
import { sql } from "drizzle-orm";
import {
  FEEDBACK_COOLDOWN_SECONDS,
  type AdminFeedbackRow,
  type FeedbackSubmission,
} from "@debate-ai/webview/lib/feedback/feedback";
import type { getDBFromContext } from "@/lib/database/context";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/** Newest submissions the admin tab loads. */
export const MAX_ADMIN_FEEDBACK_ROWS = 500;

const DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "site_feedback" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "email" text NOT NULL,
  "message" text NOT NULL,
  "page" text,
  "user_id" text,
  "ip_hash" text,
  "user_agent" text,
  "created_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_site_feedback_created" ON "site_feedback" ("created_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_site_feedback_ip" ON "site_feedback" ("ip_hash", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_site_feedback_email" ON "site_feedback" ("email", "created_at")`,
];

let ensured: Promise<void> | null = null;

/** Creates the table once per isolate; a failure is forgotten and retried. */
export function ensureFeedbackTable(db: Database): Promise<void> {
  ensured ??= (async () => {
    for (const statement of DDL) await db.run(sql.raw(statement));
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Salted SHA-256 of a client address, so raw IPs are never stored. */
export async function hashClientAddress(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const bytes = new TextEncoder().encode(`debate-ai-feedback:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface FeedbackSender {
  ipHash: string | null;
  userId: string | null;
  userAgent: string | null;
}

/**
 * Seconds until this sender may submit again, or 0 when they may now. A match
 * on any of address, account or email counts.
 */
export async function feedbackWaitSeconds(
  db: Database,
  email: string,
  sender: FeedbackSender,
  now: number = Math.floor(Date.now() / 1000),
): Promise<number> {
  const since = now - FEEDBACK_COOLDOWN_SECONDS;
  const [row] = (await db.all(
    sql`SELECT MAX(created_at) AS last FROM site_feedback
        WHERE created_at > ${since}
          AND (email = ${email}
               OR (${sender.ipHash} IS NOT NULL AND ip_hash = ${sender.ipHash})
               OR (${sender.userId} IS NOT NULL AND user_id = ${sender.userId}))`,
  )) as { last: number | null }[];
  const last = row?.last == null ? null : Number(row.last);
  return last == null ? 0 : Math.max(1, last + FEEDBACK_COOLDOWN_SECONDS - now);
}

/** Stores one submission. */
export async function insertFeedback(
  db: Database,
  submission: FeedbackSubmission,
  sender: FeedbackSender,
  now: number = Math.floor(Date.now() / 1000),
): Promise<void> {
  await db.run(
    sql`INSERT INTO site_feedback (email, message, page, user_id, ip_hash, user_agent, created_at)
        VALUES (${submission.email}, ${submission.message}, ${submission.page}, ${sender.userId},
                ${sender.ipHash}, ${sender.userAgent?.slice(0, 300) ?? null}, ${now})`,
  );
}

/** Newest submissions first, with the sender's account name when signed in. */
export async function listFeedback(db: Database): Promise<AdminFeedbackRow[]> {
  const rows = (await db.all(
    sql`SELECT f.id AS id, f.email AS email, f.message AS message, f.page AS page,
               f.user_id AS userId, u.name AS userName, f.created_at AS createdAt
        FROM site_feedback f LEFT JOIN "user" u ON u.id = f.user_id
        ORDER BY f.created_at DESC, f.id DESC
        LIMIT ${MAX_ADMIN_FEEDBACK_ROWS}`,
  )) as { id: number; email: string; message: string; page: string | null; userId: string | null; userName: string | null; createdAt: number }[];
  return rows.map((row) => ({
    id: Number(row.id),
    email: row.email,
    message: row.message,
    page: row.page,
    userId: row.userId,
    userName: row.userName,
    createdAt: new Date(Number(row.createdAt) * 1000).toISOString(),
  }));
}

/** Deletes one submission by id. */
export async function deleteFeedback(db: Database, id: number): Promise<void> {
  await db.run(sql`DELETE FROM site_feedback WHERE id = ${id}`);
}

/** Test-only: forget that the table was already created. */
export function resetEnsuredFeedbackTable(): void {
  ensured = null;
}
