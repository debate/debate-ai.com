/**
 * @fileoverview `/api/admin/service-logins` against a real SQLite database,
 * with Tabroom stubbed: saving a login signs in and stores the password and
 * token encrypted, responses never carry either, `tabroomFetch()` then sends
 * the stored session, and a refused login is reported with its cooldown.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: ReturnType<typeof drizzle>;
let isAdmin = true;
const env: Record<string, string | undefined> = {};

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => undefined }));
vi.mock("@/lib/auth/admin", () => ({ getAdminAccess: async () => ({ isAdmin, email: isAdmin ? "admin@example.com" : null }) }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));

const route = await import("@/app/api/admin/service-logins/route");
const { resetServiceSessions } = await import("@/lib/service-logins");
const { resetServiceLoginsTable } = await import("@/lib/service-logins/store");
const { tabroomFetch } = await import("@/lib/judge-paradigms/tabroom");

let acceptPassword = "right";
let logins = 0;
const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  if (url === "https://api.tabroom.com/v1/auth/login") {
    const body = JSON.parse(String(init?.body));
    if (body.password !== acceptPassword) return new Response(JSON.stringify({ title: "Invalid Credentials" }), { status: 401 });
    logins++;
    return new Response(JSON.stringify({ token: `$6$session${logins}` }), {
      status: 200,
      headers: { "set-cookie": `TabroomToken=%246%24session${logins}; Path=/; HttpOnly` },
    });
  }
  return new Response(JSON.stringify({ cookie: new Headers(init?.headers).get("cookie") }), { status: 200 });
});

const post = (body: unknown) =>
  route.POST(new Request("https://d.ebate.app/api/admin/service-logins", { method: "POST", body: JSON.stringify(body) }));

describe("/api/admin/service-logins", () => {
  beforeEach(() => {
    db = drizzle(createClient({ url: ":memory:" }));
    isAdmin = true;
    acceptPassword = "right";
    logins = 0;
    for (const key of Object.keys(env)) delete env[key];
    env.SERVICE_LOGINS_SECRET = "test-secret";
    resetServiceSessions();
    resetServiceLoginsTable();
    upstream.mockClear();
    vi.stubGlobal("fetch", upstream);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is admin-only", async () => {
    isAdmin = false;
    expect((await route.GET()).status).toBe(403);
    expect((await post({ service: "tabroom", username: "u", password: "p" })).status).toBe(403);
  });

  it("saves a login, signs in and stores only ciphertext", async () => {
    const res = await post({ service: "tabroom", username: "coach@example.com", password: "right" });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain("right");
    expect(text).not.toContain("session1");
    expect(JSON.parse(text).status).toMatchObject({
      service: "tabroom",
      configured: true,
      connected: true,
      username: "coach@example.com",
      lastError: null,
      expiresAt: null,
      updatedBy: "admin@example.com",
    });

    const [row] = (await db.all(sql`SELECT password_enc AS p, token_enc AS t FROM service_logins WHERE service = 'tabroom'`)) as { p: string; t: string }[];
    expect(row.p).toMatch(/^v1\./);
    expect(row.p).not.toContain("right");
    expect(row.t).not.toContain("session1");

    const listed = await (await route.GET()).text();
    expect(listed).not.toContain("right");
    expect(JSON.parse(listed).services.map((s: { service: string }) => s.service)).toEqual(["tabroom", "opencaselist"]);
  });

  it("sends the stored session on Tabroom requests instead of TABROOM_API_KEY", async () => {
    env.TABROOM_API_KEY = "env-token";
    const before = await (await tabroomFetch()("https://api.tabroom.com/v1/rest/tourns/1/rounds")).json();
    expect(before.cookie).toBe("TabroomToken=env-token");

    await post({ service: "tabroom", username: "coach@example.com", password: "right" });
    const after = await (await tabroomFetch()("https://api.tabroom.com/v1/rest/tourns/1/rounds")).json();
    expect(after.cookie).toBe("TabroomToken=%246%24session1");
    expect(logins).toBe(1);
  });

  it("reports a refused login with when it will be retried, and keeps the env fallback", async () => {
    env.TABROOM_API_KEY = "env-token";
    const res = await post({ service: "tabroom", username: "coach@example.com", password: "wrong" });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/refused/);
    expect(body.status).toMatchObject({ configured: true, connected: false, envFallback: true });
    expect(body.status.retryAt).toBeGreaterThan(Date.now());

    const sent = await (await tabroomFetch()("https://api.tabroom.com/v1/rest/tourns/1/rounds")).json();
    expect(sent.cookie).toBe("TabroomToken=env-token");
    expect(upstream.mock.calls.filter(([url]) => String(url).endsWith("/auth/login"))).toHaveLength(1);
  });

  it("forgets a login on DELETE", async () => {
    await post({ service: "tabroom", username: "coach@example.com", password: "right" });
    const res = await route.DELETE(new Request("https://d.ebate.app/api/admin/service-logins?service=tabroom", { method: "DELETE" }));
    expect((await res.json()).status).toMatchObject({ configured: false, connected: false, username: null });
  });

  it("validates the service and fields", async () => {
    expect((await post({ service: "nope", username: "u", password: "p" })).status).toBe(400);
    expect((await post({ service: "tabroom", username: "u" })).status).toBe(400);
  });
});
