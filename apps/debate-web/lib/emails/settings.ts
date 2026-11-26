/**
 * @fileoverview The Resend API key an admin saves under Admin → Emails.
 *
 * Stored in D1 encrypted (`./secret-crypto.ts`, the same scheme as the admin
 * service logins), with only its last four characters kept readable so the
 * panel can say "saved, ends in …". The key is never sent to the browser.
 * With no saved key, the `RESEND_API_KEY` (or `AUTH_RESEND_KEY`) env secret is
 * used.
 *
 * The app ships no migrations folder, so the table is created here once per
 * isolate.
 */

import { sql } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import { isValidResendKey, keyTail } from "./bulk";
import { decryptSecret, emailSecret, encryptSecret } from "./secret-crypto";
import { type Database, ensureEmailTables } from "./tables";

const RESEND_KEY = "resend_api_key";

/** What the admin panel shows. Never holds the key. */
export interface ResendKeyStatus {
  /** A key is saved in the admin UI and can be read with the current server secret. */
  saved: boolean;
  /** Its last four characters (empty when none is saved). */
  endsIn: string;
  /** The saved key can't be decrypted (the server secret changed); enter it again. */
  unreadable: boolean;
  /** An env secret is set, used when no key is saved. */
  envFallback: boolean;
  /** Which key sends will use. */
  source: "saved" | "env" | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

interface Row {
  valueEnc: string;
  hint: string | null;
  updatedAt: number;
  updatedBy: string | null;
}

async function readRow(db: Database): Promise<Row | null> {
  await ensureEmailTables(db);
  const [row] = (await db.all(
    sql`SELECT value_enc AS valueEnc, hint, updated_at AS updatedAt, updated_by AS updatedBy
        FROM email_settings WHERE key = ${RESEND_KEY} LIMIT 1`,
  )) as Record<string, unknown>[];
  if (!row) return null;
  return {
    valueEnc: String(row.valueEnc),
    hint: (row.hint as string | null) ?? null,
    updatedAt: Number(row.updatedAt ?? 0),
    updatedBy: (row.updatedBy as string | null) ?? null,
  };
}

function envKey(): string | null {
  return getEnv("RESEND_API_KEY")?.trim() || getEnv("AUTH_RESEND_KEY")?.trim() || null;
}

export async function saveResendKey(db: Database, key: string, updatedBy: string | null, now = Date.now()): Promise<void> {
  const trimmed = key.trim();
  if (!isValidResendKey(trimmed)) throw new Error("That does not look like a Resend API key (it starts with re_).");
  await ensureEmailTables(db);
  const valueEnc = await encryptSecret(trimmed, emailSecret());
  await db.run(
    sql`INSERT INTO email_settings (key, value_enc, hint, updated_at, updated_by)
        VALUES (${RESEND_KEY}, ${valueEnc}, ${keyTail(trimmed)}, ${now}, ${updatedBy})
        ON CONFLICT (key) DO UPDATE SET value_enc = excluded.value_enc, hint = excluded.hint,
          updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  );
}

export async function deleteResendKey(db: Database): Promise<void> {
  await ensureEmailTables(db);
  await db.run(sql`DELETE FROM email_settings WHERE key = ${RESEND_KEY}`);
}

export async function resendKeyStatus(db: Database): Promise<ResendKeyStatus> {
  const row = await readRow(db).catch(() => null);
  const key = row ? await decryptSecret(row.valueEnc, emailSecret()) : null;
  const envFallback = Boolean(envKey());
  return {
    saved: Boolean(key),
    endsIn: key ? (row?.hint ?? keyTail(key)) : "",
    unreadable: Boolean(row && !key),
    envFallback,
    source: key ? "saved" : envFallback ? "env" : null,
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

/** The key to send with: the saved one, else the env secret. A database error falls back to env. */
export async function resolveResendKey(
  db?: Database | null,
): Promise<{ key: string; source: "saved" | "env" } | null> {
  if (db) {
    try {
      const row = await readRow(db);
      const saved = row ? await decryptSecret(row.valueEnc, emailSecret()) : null;
      if (saved) return { key: saved, source: "saved" };
    } catch {
      // Unreadable storage must not stop mail the env secret could send.
    }
  }
  const fromEnv = envKey();
  return fromEnv ? { key: fromEnv, source: "env" } : null;
}
