import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import {
  API_KEY_USER_AGENT,
  MAX_API_KEYS,
  TooManyApiKeysError,
  createApiKey,
  generateApiKeyToken,
  listApiKeys,
  normalizeKeyLabel,
  resetApiKey,
  revealApiKey,
  revokeApiKey,
} from "../api-keys";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE session (
    id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ip_address TEXT,
    user_agent TEXT, user_id TEXT NOT NULL, active_organization_id TEXT)`);
  // A browser session, which must never show up as a key.
  await client.execute({
    sql: "INSERT INTO session VALUES ('browser', 9999999999, 'tok', 0, 0, '', 'Mozilla/5.0', 'u1', NULL)",
    args: [],
  });
  return drizzle(client);
}

describe("api keys", () => {
  it("generates undotted, prefixed, unguessable tokens", () => {
    const a = generateApiKeyToken();
    expect(a).toMatch(/^dai_[A-Za-z0-9]{40}$/);
    expect(a).not.toBe(generateApiKeyToken());
  });

  it("normalizes labels", () => {
    expect(normalizeKeyLabel("  Claude   Desktop ")).toBe("Claude Desktop");
    expect(normalizeKeyLabel("")).toBe("MCP client");
    expect(normalizeKeyLabel(42)).toBe("MCP client");
    expect(normalizeKeyLabel("x".repeat(200))).toHaveLength(60);
  });

  it("creates a key as a year-long session and lists only key sessions", async () => {
    const db = await freshDb();
    const now = new Date("2026-10-25T00:00:00Z");
    const { key, summary } = await createApiKey(db, "u1", "Cursor", now);
    expect(summary.name).toBe("Cursor");
    expect(summary.hint).toBe(key.slice(-4));
    expect(summary.expiresAt).toBe("2027-10-25T00:00:00.000Z");

    const keys = await listApiKeys(db, "u1");
    expect(keys).toEqual([summary]);
    expect(await listApiKeys(db, "u2")).toEqual([]);
  });

  it("revokes only the owner's key sessions", async () => {
    const db = await freshDb();
    const { summary } = await createApiKey(db, "u1", "Claude");
    expect(await revokeApiKey(db, "u2", summary.id)).toBe(false);
    expect(await revokeApiKey(db, "u1", "browser")).toBe(false);
    expect(await revokeApiKey(db, "u1", summary.id)).toBe(true);
    expect(await listApiKeys(db, "u1")).toEqual([]);
  });

  it("caps keys per account", async () => {
    const db = await freshDb();
    for (let i = 0; i < MAX_API_KEYS; i++) await createApiKey(db, "u1", `k${i}`);
    await expect(createApiKey(db, "u1", "one more")).rejects.toBeInstanceOf(TooManyApiKeysError);
  });

  it("marks key sessions by user agent", () => {
    expect(API_KEY_USER_AGENT.startsWith("Debate AI API key")).toBe(true);
  });
});

describe("showing and resetting a key", () => {
  it("shows only the owner's key again, never a browser session", async () => {
    const db = await freshDb();
    const { key, summary } = await createApiKey(db, "u1", "Claude");
    expect(await revealApiKey(db, "u1", summary.id)).toBe(key);
    expect(await revealApiKey(db, "u2", summary.id)).toBeNull();
    expect(await revealApiKey(db, "u1", "browser")).toBeNull();
  });

  it("resets a key to a new token, keeping its id and name, with a fresh year", async () => {
    const db = await freshDb();
    const { key: oldKey, summary } = await createApiKey(db, "u1", "Cursor", new Date("2026-01-01T00:00:00Z"));
    const reset = await resetApiKey(db, "u1", summary.id, new Date("2026-10-25T00:00:00Z"));
    expect(reset?.key).not.toBe(oldKey);
    expect(reset?.key).toMatch(/^dai_/);
    expect(reset?.summary).toMatchObject({ id: summary.id, name: "Cursor", hint: reset!.key.slice(-4) });
    expect(reset?.summary.expiresAt).toBe("2027-10-25T00:00:00.000Z");
    expect(await revealApiKey(db, "u1", summary.id)).toBe(reset?.key);
  });

  it("won't reset someone else's key or a browser session", async () => {
    const db = await freshDb();
    const { key, summary } = await createApiKey(db, "u1", "Claude");
    expect(await resetApiKey(db, "u2", summary.id)).toBeNull();
    expect(await resetApiKey(db, "u1", "browser")).toBeNull();
    expect(await revealApiKey(db, "u1", summary.id)).toBe(key);
  });
});
