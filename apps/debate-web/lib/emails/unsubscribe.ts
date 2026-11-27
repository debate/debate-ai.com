/**
 * @fileoverview Opt-out of all Debate AI emails: signed footer tokens, the
 * `email_unsubscribes` table, and helpers senders use before Resend.
 *
 * Every transactional template's footer links here via
 * {@link UNSUBSCRIBE_URL_PLACEHOLDER}, which senders replace with a
 * per-recipient token URL ({@link unsubscribeUrlFor}). Auth magic-link mail
 * skips the check so people can still sign in after unsubscribing.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { emailUnsubscribes } from "@/lib/database/schema";
import type { getDBFromContext } from "@/lib/database/context";
import { getEnv } from "@/lib/env";
import { siteUrl, UNSUBSCRIBE_URL_PLACEHOLDER } from "@debate-ai/emails";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

export { UNSUBSCRIBE_URL_PLACEHOLDER };

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "email_unsubscribes" (
  "email" text PRIMARY KEY NOT NULL,
  "unsubscribed_at" integer DEFAULT (unixepoch()) NOT NULL,
  "source" text DEFAULT 'link' NOT NULL
)`;

let tableReady: Promise<void> | null = null;

function ensureTable(db: Database): Promise<void> {
  tableReady ??= Promise.resolve(db.run(sql.raw(CREATE_TABLE_SQL))).then(
    () => undefined,
    (error) => {
      tableReady = null;
      throw error;
    },
  );
  return tableReady;
}

/** Lowercase trimmed address, or `null` when it is not an email. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function signingSecret(): string {
  return getEnv("BETTER_AUTH_SECRET") || getEnv("AUTH_SECRET") || "dev-secret-change-in-production";
}

/** Compact signed token: `base64url(email).exp.sig` (exp is unix seconds, ~90 days). */
export function signUnsubscribeToken(email: string, now = Date.now()): string {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Not an email address.");
  const exp = Math.floor(now / 1000) + 90 * 24 * 60 * 60;
  const encoded = Buffer.from(normalized, "utf8").toString("base64url");
  const payload = `${encoded}.${exp}`;
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** The email a token names, or `null` when it is missing, expired or forged. */
export function verifyUnsubscribeToken(token: string, now = Date.now()): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encoded, expRaw, sig] = parts;
  if (!encoded || !expRaw || !sig) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < now) return null;
  const payload = `${encoded}.${expRaw}`;
  const expected = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return normalizeEmail(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Absolute unsubscribe page URL with a signed token for `email`. */
export function unsubscribeUrlFor(email: string, baseUrl?: string): string {
  const token = signUnsubscribeToken(email);
  const url = new URL(siteUrl(baseUrl, "/unsubscribe"));
  url.searchParams.set("t", token);
  return url.toString();
}

/** Swap the footer placeholder for a real (tokenized) unsubscribe URL. */
export function applyUnsubscribeUrl(content: string, url: string): string {
  return content.split(UNSUBSCRIBE_URL_PLACEHOLDER).join(url);
}

/** True when this address has opted out of all emails. */
export async function isEmailUnsubscribed(db: Database, email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  await ensureTable(db);
  const [row] = await db
    .select({ email: emailUnsubscribes.email })
    .from(emailUnsubscribes)
    .where(eq(emailUnsubscribes.email, normalized))
    .limit(1);
  return Boolean(row);
}

/** Record an opt-out. Idempotent. */
export async function unsubscribeEmail(
  db: Database,
  email: string,
  source: "link" | "settings" = "link",
): Promise<{ email: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Not an email address.");
  await ensureTable(db);
  await db
    .insert(emailUnsubscribes)
    .values({ email: normalized, unsubscribedAt: new Date(), source })
    .onConflictDoUpdate({
      target: emailUnsubscribes.email,
      set: { unsubscribedAt: new Date(), source },
    });
  return { email: normalized };
}

/** Remove an opt-out so the address can receive mail again. */
export async function resubscribeEmail(db: Database, email: string): Promise<{ email: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Not an email address.");
  await ensureTable(db);
  await db.delete(emailUnsubscribes).where(eq(emailUnsubscribes.email, normalized));
  return { email: normalized };
}

/** Every address that has opted out, normalized, for bulk exclusion without a query per address. */
export async function listUnsubscribedEmails(db: Database): Promise<Set<string>> {
  await ensureTable(db);
  const rows = await db.select({ email: emailUnsubscribes.email }).from(emailUnsubscribes);
  const out = new Set<string>();
  for (const { email } of rows) {
    const normalized = normalizeEmail(email);
    if (normalized) out.add(normalized);
  }
  return out;
}

/** Drop addresses that have unsubscribed; keeps original order otherwise. */
export async function filterSubscribedEmails(db: Database, emails: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  for (const email of emails) {
    if (!(await isEmailUnsubscribed(db, email))) out.push(email);
  }
  return out;
}
