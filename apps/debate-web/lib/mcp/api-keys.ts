/**
 * Personal API keys — what an MCP client (or any script calling `/api`) sends
 * as `Authorization: Bearer <key>`.
 *
 * A key is a long-lived better-auth session, not a separate credential: the
 * `bearer()` plugin (lib/auth/index.ts) already turns a bearer session token
 * into the session cookie, so every route that calls `auth.api.getSession`
 * accepts a key with no change. Key sessions are told apart from browser
 * sessions by their `user_agent`, which starts with {@link API_KEY_USER_AGENT}
 * and carries the key's label. Revoking a key deletes its session row; signing
 * out of all other sessions revokes keys too.
 */
import { and, desc, eq, like } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { session } from "../database/schema";

/** Marks a session row as an API key; the key's label follows it. */
export const API_KEY_USER_AGENT = "Debate AI API key: ";
/** How long a new key lasts. better-auth extends a session it sees in use near its expiry. */
export const API_KEY_LIFETIME_DAYS = 365;
/** Keys per account, so a loop in a client can't fill the session table. */
export const MAX_API_KEYS = 20;
const MAX_LABEL_LENGTH = 60;

export interface ApiKeySummary {
  id: string;
  name: string;
  /** The key's last four characters. */
  hint: string;
  createdAt: string;
  expiresAt: string;
}

type SessionRow = typeof session.$inferSelect;

// Any async SQLite drizzle instance: D1 in the app, libsql in the tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<"async", any, any>;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * 40 random base62 characters. No `.`: the bearer plugin treats a dotted token
 * as already signed, and signs an undotted one itself.
 */
export function generateApiKeyToken(): string {
  let out = "";
  while (out.length < 40) {
    for (const byte of crypto.getRandomValues(new Uint8Array(48))) {
      // 248 = 4 × 62: dropping bytes above it keeps every character equally likely.
      if (byte < 248 && out.length < 40) out += ALPHABET[byte % 62];
    }
  }
  return `dai_${out}`;
}

export function normalizeKeyLabel(raw: unknown): string {
  const label = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_LENGTH) : "";
  return label || "MCP client";
}

function toSummary(row: Pick<SessionRow, "id" | "token" | "userAgent" | "createdAt" | "expiresAt">): ApiKeySummary {
  return {
    id: row.id,
    name: (row.userAgent ?? "").slice(API_KEY_USER_AGENT.length) || "MCP client",
    hint: row.token.slice(-4),
    createdAt: new Date(row.createdAt).toISOString(),
    expiresAt: new Date(row.expiresAt).toISOString(),
  };
}

export async function listApiKeys(db: Db, userId: string): Promise<ApiKeySummary[]> {
  const rows: SessionRow[] = await db
    .select()
    .from(session)
    .where(and(eq(session.userId, userId), like(session.userAgent, `${API_KEY_USER_AGENT}%`)))
    .orderBy(desc(session.createdAt));
  return rows.map(toSummary);
}

export class TooManyApiKeysError extends Error {
  constructor() {
    super(`An account can hold at most ${MAX_API_KEYS} API keys. Revoke one first.`);
  }
}

/** Mints a key. The returned `key` is the only copy the caller will ever see. */
export async function createApiKey(
  db: Db,
  userId: string,
  label: unknown,
  now = new Date(),
): Promise<{ key: string; summary: ApiKeySummary }> {
  const existing = await listApiKeys(db, userId);
  if (existing.length >= MAX_API_KEYS) throw new TooManyApiKeysError();

  const row = {
    id: crypto.randomUUID(),
    token: generateApiKeyToken(),
    userId,
    userAgent: `${API_KEY_USER_AGENT}${normalizeKeyLabel(label)}`,
    ipAddress: "",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + API_KEY_LIFETIME_DAYS * 86_400_000),
  };
  await db.insert(session).values(row);
  return { key: row.token, summary: toSummary(row) };
}

/** Deletes one of `userId`'s keys. Returns false when no such key exists. */
export async function revokeApiKey(db: Db, userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(session)
    .where(and(eq(session.id, id), eq(session.userId, userId), like(session.userAgent, `${API_KEY_USER_AGENT}%`)))
    .returning({ id: session.id });
  return deleted.length > 0;
}
