/**
 * @fileoverview D1 storage for the service logins the admin page saves
 * (Admin → Service logins): one row per service with the username, the
 * password and the current session token. The password and token are
 * AES-GCM encrypted (`./crypto.ts`); the username is kept readable so the
 * panel can show which account is signed in.
 *
 * The app ships no migrations folder, so the table is created here once per
 * isolate.
 *
 * @module lib/service-logins/store
 */

import { sql } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";
import { decryptSecret, encryptSecret } from "./crypto";
import type { ServiceId } from "./providers";
import type { ServiceLoginStore, StoredServiceLogin } from "./session";

export type Database = Awaited<ReturnType<typeof getDBFromContext>>;

const DDL = `CREATE TABLE IF NOT EXISTS "service_logins" (
  "service" text PRIMARY KEY NOT NULL,
  "username" text,
  "password_enc" text,
  "token_enc" text,
  "token_expires_at" integer,
  "last_login_at" integer,
  "last_failure_at" integer,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "updated_at" integer NOT NULL,
  "updated_by" text
)`;

let ensured: Promise<void> | null = null;

/** Creates the table once per isolate; a failure is forgotten and retried. */
export function ensureServiceLoginsTable(db: Database): Promise<void> {
  const pending = (ensured ??= db.run(sql.raw(DDL)).then(() => undefined));
  pending.catch(() => {
    if (ensured === pending) ensured = null;
  });
  return pending;
}

/** Forgets that the table was created (tests, which swap databases). */
export function resetServiceLoginsTable(): void {
  ensured = null;
}

/** A stored row as read, secrets still sealed. */
export interface ServiceLoginRow {
  service: string;
  username: string | null;
  passwordEnc: string | null;
  tokenEnc: string | null;
  tokenExpiresAt: number | null;
  lastLoginAt: number | null;
  lastFailureAt: number | null;
  failureCount: number;
  lastError: string | null;
  updatedAt: number;
  updatedBy: string | null;
}

const num = (value: unknown) => (value == null ? null : Number(value));

export async function readServiceLoginRow(db: Database, service: ServiceId): Promise<ServiceLoginRow | null> {
  await ensureServiceLoginsTable(db);
  const [row] = (await db.all(
    sql`SELECT service, username, password_enc AS passwordEnc, token_enc AS tokenEnc,
               token_expires_at AS tokenExpiresAt, last_login_at AS lastLoginAt,
               last_failure_at AS lastFailureAt, failure_count AS failureCount,
               last_error AS lastError, updated_at AS updatedAt, updated_by AS updatedBy
        FROM service_logins WHERE service = ${service} LIMIT 1`,
  )) as Record<string, unknown>[];
  if (!row) return null;
  return {
    service: String(row.service),
    username: (row.username as string | null) ?? null,
    passwordEnc: (row.passwordEnc as string | null) ?? null,
    tokenEnc: (row.tokenEnc as string | null) ?? null,
    tokenExpiresAt: num(row.tokenExpiresAt),
    lastLoginAt: num(row.lastLoginAt),
    lastFailureAt: num(row.lastFailureAt),
    failureCount: Number(row.failureCount ?? 0),
    lastError: (row.lastError as string | null) ?? null,
    updatedAt: Number(row.updatedAt ?? 0),
    updatedBy: (row.updatedBy as string | null) ?? null,
  };
}

/** Saves a new username and password, dropping the old session and failure count. */
export async function saveServiceCredentials(
  db: Database,
  service: ServiceId,
  credentials: { username: string; password: string },
  secret: string,
  updatedBy: string | null,
  now = Date.now(),
): Promise<void> {
  await ensureServiceLoginsTable(db);
  const passwordEnc = await encryptSecret(credentials.password, secret);
  await db.run(
    sql`INSERT INTO service_logins (service, username, password_enc, token_enc, token_expires_at, last_login_at,
                                    last_failure_at, failure_count, last_error, updated_at, updated_by)
        VALUES (${service}, ${credentials.username}, ${passwordEnc}, NULL, NULL, NULL, NULL, 0, NULL, ${now}, ${updatedBy})
        ON CONFLICT (service) DO UPDATE SET
          username = excluded.username, password_enc = excluded.password_enc, token_enc = NULL,
          token_expires_at = NULL, last_login_at = NULL, last_failure_at = NULL, failure_count = 0,
          last_error = NULL, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  );
}

export async function deleteServiceLogin(db: Database, service: ServiceId): Promise<void> {
  await ensureServiceLoginsTable(db);
  await db.run(sql`DELETE FROM service_logins WHERE service = ${service}`);
}

/** The session manager's view of one service's row, decrypting as it reads. */
export function d1LoginStore(service: ServiceId, getDb: () => Promise<Database>, secret: () => string): ServiceLoginStore {
  return {
    async load(): Promise<StoredServiceLogin | null> {
      const row = await readServiceLoginRow(await getDb(), service);
      if (!row) return null;
      return {
        username: row.username,
        password: await decryptSecret(row.passwordEnc, secret()),
        token: await decryptSecret(row.tokenEnc, secret()),
        tokenExpiresAt: row.tokenExpiresAt,
        lastLoginAt: row.lastLoginAt,
        lastFailureAt: row.lastFailureAt,
        failureCount: row.failureCount,
        lastError: row.lastError,
      };
    },
    async saveToken(token, expiresAt, at) {
      const db = await getDb();
      const tokenEnc = await encryptSecret(token, secret());
      await db.run(
        sql`UPDATE service_logins SET token_enc = ${tokenEnc}, token_expires_at = ${expiresAt}, last_login_at = ${at},
                   last_failure_at = NULL, failure_count = 0, last_error = NULL
            WHERE service = ${service}`,
      );
    },
    async saveFailure(error, at, failureCount) {
      const db = await getDb();
      await db.run(
        sql`UPDATE service_logins SET last_failure_at = ${at}, failure_count = ${failureCount}, last_error = ${error.slice(0, 500)}
            WHERE service = ${service}`,
      );
    },
  };
}
