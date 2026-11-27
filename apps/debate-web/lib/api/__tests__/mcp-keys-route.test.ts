/**
 * @fileoverview `/api/mcp/keys` against a real SQLite database: a signed-in
 * browser can create, reveal, reset and revoke its own API keys, but a request
 * authenticated by a key, or by someone else, cannot.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { API_KEY_USER_AGENT, MAX_API_KEYS } from "@/lib/mcp/api-keys";

let db: ReturnType<typeof drizzle<typeof schema>>;
let current: { user: { id: string }; session: { userAgent?: string | null } } | null = null;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => current }));

const route = await import("@/app/api/mcp/keys/route");

const url = "https://debate-ai.com/api/mcp/keys";
const call = (method: "GET" | "POST" | "PATCH" | "DELETE", query = "", body?: unknown) =>
  route[method](new NextRequest(`${url}${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
const asBrowser = (id: string) => (current = { user: { id }, session: { userAgent: "Mozilla/5.0" } });

describe("/api/mcp/keys", () => {
  beforeEach(async () => {
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    asBrowser("alex");
  });

  it("requires a session", async () => {
    current = null;
    for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) expect((await call(method, "?id=x")).status).toBe(401);
  });

  it("refuses to be managed with an API key", async () => {
    current = { user: { id: "alex" }, session: { userAgent: `${API_KEY_USER_AGENT}laptop` } };
    const res = await call("POST", "", { name: "sneaky" });
    expect(res.status).toBe(403);
  });

  it("creates a key, lists its summary and reveals it in full", async () => {
    const created = await (await call("POST", "", { name: "  my   laptop " })).json();
    expect(created.key).toMatch(/^dai_/);
    expect(created.summary).toMatchObject({ name: "my laptop", hint: created.key.slice(-4) });

    const listed = await (await call("GET")).json();
    expect(listed.keys).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(created.key);

    const revealed = await call("GET", `?id=${created.summary.id}`);
    expect(await revealed.json()).toEqual({ key: created.key });
    expect(revealed.headers.get("cache-control")).toBe("no-store");
  });

  it("falls back to a default label when the body is missing or not JSON", async () => {
    const res = await route.POST(new NextRequest(url, { method: "POST", body: "{nope" }));
    expect((await res.json()).summary.name).toBe("MCP client");
  });

  it("answers 409 once the account holds the maximum number of keys", async () => {
    for (let i = 0; i < MAX_API_KEYS; i++) await call("POST", "", { name: `k${i}` });
    const res = await call("POST", "", { name: "one too many" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain(String(MAX_API_KEYS));
  });

  it("resets a key to a new token, keeping its id and label", async () => {
    const { key, summary } = await (await call("POST", "", { name: "ci" })).json();
    expect((await call("PATCH")).status).toBe(400);
    const reset = await call("PATCH", `?id=${summary.id}`);
    expect(reset.headers.get("cache-control")).toBe("no-store");
    const next = await reset.json();
    expect(next.key).not.toBe(key);
    expect(next.summary).toMatchObject({ id: summary.id, name: "ci" });
    expect((await call("PATCH", "?id=missing")).status).toBe(404);
  });

  it("revokes a key and keeps accounts apart", async () => {
    const { summary } = await (await call("POST", "", { name: "ci" })).json();
    expect((await call("DELETE")).status).toBe(400);

    asBrowser("sam");
    expect((await call("GET", `?id=${summary.id}`)).status).toBe(404);
    expect((await call("PATCH", `?id=${summary.id}`)).status).toBe(404);
    expect((await call("DELETE", `?id=${summary.id}`)).status).toBe(404);

    asBrowser("alex");
    expect(await (await call("DELETE", `?id=${summary.id}`)).json()).toEqual({ ok: true });
    expect((await (await call("GET")).json()).keys).toEqual([]);
  });
});
