/**
 * @fileoverview `/api/admin/env/*` against a real SQLite database with a fake
 * Cloudflare and GitHub: admin-only, tokens and secret values never leave the
 * server, the settings PATCH keeps every other binding, protected and deleted
 * variables need confirmation, and a rebuild dispatches the deploy workflow.
 */

import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT, CF_TOKEN, GH_TOKEN, fakeUpstream } from "./helpers";

let db: ReturnType<typeof drizzle>;
let isAdmin = true;
const env: Record<string, string | undefined> = {};

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => undefined }));
vi.mock("@/lib/auth/admin", () => ({ getAdminAccess: async () => ({ isAdmin, email: isAdmin ? "admin@example.com" : null }) }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));

const credentials = await import("@/app/api/admin/env/credentials/route");
const testRoute = await import("@/app/api/admin/env/test/route");
const varsRoute = await import("@/app/api/admin/env/vars/route");
const applyRoute = await import("@/app/api/admin/env/apply/route");
const rebuildRoute = await import("@/app/api/admin/env/rebuild/route");
const auditRoute = await import("@/app/api/admin/env/audit/route");
const { resetEnvManagerTables } = await import("@/lib/env-manager/store");

let upstream: ReturnType<typeof fakeUpstream>;

const req = (path: string, method: string, body?: unknown) =>
  new Request(`https://d.ebate.app/api/admin/env/${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

async function connect() {
  const res = await credentials.POST(req("credentials", "POST", { cloudflareToken: CF_TOKEN, accountId: ACCOUNT, githubToken: GH_TOKEN }));
  expect(res.status).toBe(200);
}

/** Clears the 10s apply and 30s rebuild cooldowns by ageing the audit rows. */
async function ageAudit() {
  await db.run(sql`UPDATE env_manager_audit SET at = at - 120000`);
}

beforeEach(() => {
  db = drizzle(createClient({ url: ":memory:" }));
  isAdmin = true;
  for (const key of Object.keys(env)) delete env[key];
  env.SERVICE_LOGINS_SECRET = "test-secret";
  resetEnvManagerTables();
  upstream = fakeUpstream();
  vi.stubGlobal("fetch", upstream.fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("admin-only", () => {
  it("answers 403 to everyone but an admin on every route and method, and calls nothing", async () => {
    await connect();
    upstream.fetchMock.mockClear();
    isAdmin = false;
    const responses = await Promise.all([
      credentials.GET(),
      credentials.POST(req("credentials", "POST", { cloudflareToken: "x".repeat(20) })),
      credentials.DELETE(req("credentials?which=github", "DELETE")),
      testRoute.POST(req("test", "POST", { target: "cloudflare" })),
      varsRoute.GET(),
      applyRoute.POST(req("apply", "POST", { changes: [{ op: "delete", name: "SITE_NAME" }] })),
      rebuildRoute.POST(),
      rebuildRoute.GET(req("rebuild?runId=1", "GET")),
      auditRoute.GET(),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(9).fill(403));
    expect(upstream.fetchMock).not.toHaveBeenCalled();
    const [row] = (await db.all(sql`SELECT COUNT(*) AS n FROM env_manager_settings WHERE key = 'github_token'`)) as { n: number }[];
    expect(row.n).toBe(1);
  });
});

describe("credentials", () => {
  it("stores tokens encrypted and only ever returns whether they are set and their last four characters", async () => {
    const res = await credentials.POST(req("credentials", "POST", { cloudflareToken: CF_TOKEN, accountId: ACCOUNT, script: "my-worker", githubToken: GH_TOKEN, branch: "main" }));
    const text = await res.text();
    expect(text).not.toContain(CF_TOKEN);
    expect(text).not.toContain(GH_TOKEN);
    const status = JSON.parse(text).status;
    expect(status.cloudflare).toMatchObject({ set: true, endsIn: CF_TOKEN.slice(-4), accountId: ACCOUNT, script: "my-worker", updatedBy: "admin@example.com" });
    expect(status.github).toMatchObject({ set: true, endsIn: GH_TOKEN.slice(-4), branch: "main", owner: "debate", repo: "debate-ai.com" });

    const rows = (await db.all(sql`SELECT key, value FROM env_manager_settings`)) as { key: string; value: string }[];
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain(CF_TOKEN);
    expect(dump).not.toContain(GH_TOKEN);
    expect(rows.find((r) => r.key === "cloudflare_token")!.value).toMatch(/^v1\./);

    const listed = await (await credentials.GET()).text();
    expect(listed).not.toContain(CF_TOKEN);
    expect(listed).not.toContain(GH_TOKEN);
  });

  it("keeps a saved token when the field is left blank, and validates fields", async () => {
    await connect();
    await ageAudit();
    const res = await credentials.POST(req("credentials", "POST", { cloudflareToken: "", script: "other" }));
    expect((await res.json()).status.cloudflare).toMatchObject({ set: true, script: "other" });
    await ageAudit();
    expect((await credentials.POST(req("credentials", "POST", { accountId: "nope" }))).status).toBe(400);
    await ageAudit();
    expect((await credentials.POST(req("credentials", "POST", { workflow: "../x.sh" }))).status).toBe(400);
  });

  it("removes one side on DELETE", async () => {
    await connect();
    const res = await credentials.DELETE(req("credentials?which=github", "DELETE"));
    const { status } = await res.json();
    expect(status.github.set).toBe(false);
    expect(status.cloudflare.set).toBe(true);
    expect((await credentials.DELETE(req("credentials?which=x", "DELETE"))).status).toBe(400);
  });

  it("reads a token as unreadable after the server secret rotates", async () => {
    await connect();
    env.SERVICE_LOGINS_SECRET = "rotated";
    const { status } = await (await credentials.GET()).json();
    expect(status.cloudflare).toMatchObject({ set: false, unreadable: true });
  });
});

describe("test connection", () => {
  it("validates both tokens without changing anything", async () => {
    await connect();
    await ageAudit();
    const cf = await (await testRoute.POST(req("test", "POST", { target: "cloudflare" }))).json();
    expect(cf.ok).toBe(true);
    expect(cf.missing).toEqual([]);
    await ageAudit();
    const gh = await (await testRoute.POST(req("test", "POST", { target: "github" }))).json();
    expect(gh.ok).toBe(true);
    expect(gh.checks.some((c: { name: string }) => c.name.includes("wrangler.jsonc"))).toBe(true);
    expect(upstream.calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("names the missing Cloudflare permission", async () => {
    await connect();
    upstream.fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/tokens/verify")) return new Response(JSON.stringify({ success: true, result: { status: "active" } }), { status: 200 });
      return new Response(JSON.stringify({ success: false, errors: [{ code: 10000, message: "Authentication error" }] }), { status: 403 });
    });
    const res = await (await testRoute.POST(req("test", "POST", { target: "cloudflare" }))).json();
    expect(res.ok).toBe(false);
    expect(res.missing.join(" ")).toContain("Workers Scripts");
  });

  it("flags a classic GitHub token without the repo scope, and a rejected token", async () => {
    await connect();
    upstream.state.scopes = "read:user";
    const scoped = await (await testRoute.POST(req("test", "POST", { target: "github" }))).json();
    expect(scoped.ok).toBe(false);
    expect(scoped.missing).toContain("Classic token scope: repo");

    await ageAudit();
    upstream.state.failGithub = { status: 401, message: `Bad credentials for ${GH_TOKEN}` };
    const text = await (await testRoute.POST(req("test", "POST", { target: "github" }))).text();
    expect(text).not.toContain(GH_TOKEN);
    expect(JSON.parse(text).missing).toContain("A valid, unexpired GitHub token");
  });

  it("asks for credentials first and rate-limits repeat tests", async () => {
    expect((await testRoute.POST(req("test", "POST", { target: "cloudflare" }))).status).toBe(400);
    await connect();
    await ageAudit();
    expect((await testRoute.POST(req("test", "POST", { target: "cloudflare" }))).status).toBe(200);
    expect((await testRoute.POST(req("test", "POST", { target: "bogus" }))).status).toBe(400);
  });
});

describe("variables", () => {
  it("lists values for text variables, names only for secrets, and flags wrangler.jsonc ownership", async () => {
    await connect();
    const text = await (await varsRoute.GET()).text();
    const data = JSON.parse(text);
    const byName = Object.fromEntries(data.vars.map((v: { name: string }) => [v.name, v]));
    expect(byName.SITE_NAME).toMatchObject({ kind: "plain_text", value: "Debate", protected: false, inWrangler: false });
    expect(byName.ADMIN_EMAIL).toMatchObject({ inWrangler: true, protected: true });
    expect(byName.BETTER_AUTH_SECRET).toMatchObject({ kind: "secret_text", protected: true });
    expect(byName.BETTER_AUTH_SECRET).not.toHaveProperty("value");
    expect(data.bindings.map((b: { name: string }) => b.name)).toEqual(["ASSETS", "debate_db"]);
    expect(data.warnings).toEqual([]);
    expect(text).not.toContain(CF_TOKEN);
  });

  it("warns when wrangler.jsonc lacks keep_vars or names another Worker", async () => {
    await connect();
    upstream.state.wrangler = `{ "name": "other-worker", "vars": {} }`;
    const data = await (await varsRoute.GET()).json();
    expect(data.warnings.join(" ")).toContain("keep_vars");
    expect(data.warnings.join(" ")).toContain("other-worker");
  });

  it("redacts the token from Cloudflare errors", async () => {
    await connect();
    upstream.state.failCloudflare = { status: 500, message: `boom ${CF_TOKEN} Bearer ${CF_TOKEN}` };
    const res = await varsRoute.GET();
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(CF_TOKEN);
  });
});

describe("apply", () => {
  const patches = () => upstream.calls.filter((c) => c.method === "PATCH" && c.url.endsWith("/settings"));

  it("previews a diff with secrets by name only and changes nothing", async () => {
    await connect();
    const res = await applyRoute.POST(
      req("apply", "POST", {
        dryRun: true,
        changes: [
          { op: "set", name: "SITE_NAME", kind: "plain_text", value: "Debate AI" },
          { op: "set", name: "NEW_SECRET", kind: "secret_text", value: "hunter2-secret" },
          { op: "delete", name: "RESEND_API_KEY" },
          { op: "set", name: "ADMIN_EMAIL", kind: "plain_text", value: "x@example.com" },
        ],
      }),
    );
    const text = await res.text();
    expect(text).not.toContain("hunter2-secret");
    const { plan } = JSON.parse(text);
    const entry = (name: string) => plan.entries.find((e: { name: string }) => e.name === name);
    expect(entry("SITE_NAME")).toMatchObject({ action: "update", before: "Debate", after: "Debate AI" });
    expect(entry("NEW_SECRET")).toMatchObject({ action: "add", kind: "secret_text", after: null });
    expect(entry("RESEND_API_KEY")).toMatchObject({ action: "delete", before: null });
    expect(entry("ADMIN_EMAIL").warnings.join(" ")).toContain("wrangler.jsonc");
    expect(plan).toMatchObject({ hasDeletes: true, hasProtected: true });
    expect(patches()).toHaveLength(0);
  });

  it("refuses deletes and protected changes until they are confirmed", async () => {
    await connect();
    const del = { changes: [{ op: "delete", name: "SITE_NAME" }] };
    const first = await applyRoute.POST(req("apply", "POST", del));
    expect(first.status).toBe(409);
    expect((await first.json()).needs).toBe("confirmDelete");

    const prot = { changes: [{ op: "set", name: "BETTER_AUTH_SECRET", kind: "secret_text", value: "new-auth-secret" }] };
    const second = await applyRoute.POST(req("apply", "POST", prot));
    const body = await second.json();
    expect(second.status).toBe(409);
    expect(body.needs).toBe("confirmProtected");
    expect(JSON.stringify(body)).not.toContain("new-auth-secret");
    expect(patches()).toHaveLength(0);
  });

  it("PATCHes once with every other binding preserved and the audit log names no values", async () => {
    await connect();
    const res = await applyRoute.POST(
      req("apply", "POST", {
        confirmDelete: true,
        changes: [
          { op: "set", name: "SITE_NAME", kind: "plain_text", value: "Debate AI" },
          { op: "set", name: "SENTRY_DSN", kind: "secret_text", value: "https://secret-dsn@sentry" },
          { op: "set", name: "FLAGS", kind: "json", value: '{"a":1}' },
          { op: "delete", name: "RESEND_API_KEY" },
        ],
      }),
    );
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain("secret-dsn");
    expect(JSON.parse(text).applied).toBe(4);

    expect(patches()).toHaveLength(1);
    const sent = (patches()[0].body as { bindings: Array<Record<string, unknown>> }).bindings;
    expect(sent).toEqual([
      { type: "plain_text", name: "ADMIN_EMAIL", text: "boss@example.com" },
      { type: "inherit", name: "BETTER_AUTH_SECRET" },
      { type: "inherit", name: "debate_db" },
      { type: "inherit", name: "ASSETS" },
      { type: "plain_text", name: "SITE_NAME", text: "Debate AI" },
      { type: "secret_text", name: "SENTRY_DSN", text: "https://secret-dsn@sentry" },
      { type: "json", name: "FLAGS", json: { a: 1 } },
    ]);
    expect(upstream.state.bindings.map((b) => b.name).sort()).toEqual(["ADMIN_EMAIL", "ASSETS", "BETTER_AUTH_SECRET", "FLAGS", "SENTRY_DSN", "SITE_NAME", "debate_db"]);
    expect(patches()[0].headers["Content-Type"]).toBeUndefined();

    const audit = await (await auditRoute.GET()).text();
    expect(audit).not.toContain("secret-dsn");
    expect(audit).not.toContain("Debate AI");
    const entries = JSON.parse(audit).entries as Array<{ action: string; names: string[]; actor: string }>;
    const applied = entries.find((e) => e.action === "apply")!;
    expect(applied.actor).toBe("admin@example.com");
    expect(applied.names).toEqual(expect.arrayContaining(["update:SITE_NAME", "add:SENTRY_DSN (secret)", "delete:RESEND_API_KEY (secret)", "add:FLAGS"]));
  });

  it("refuses to edit a non-variable binding", async () => {
    await connect();
    const res = await applyRoute.POST(req("apply", "POST", { changes: [{ op: "set", name: "debate_db", kind: "plain_text", value: "x" }] }));
    expect(res.status).toBe(400);
    expect(patches()).toHaveLength(0);
  });

  it("fails loudly when Cloudflare drops a binding it should have kept", async () => {
    await connect();
    upstream.state.dropOnPatch = "debate_db";
    const res = await applyRoute.POST(req("apply", "POST", { changes: [{ op: "set", name: "SITE_NAME", kind: "plain_text", value: "x" }] }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("debate_db");
  });

  it("validates the payload and redacts secret values from errors", async () => {
    await connect();
    for (const changes of [[], [{ op: "set", name: "1BAD", kind: "plain_text", value: "x" }], [{ op: "set", name: "A", kind: "secret_text", value: "" }], [{ op: "set", name: "J", kind: "json", value: "{" }], [{ op: "delete", name: "A" }, { op: "delete", name: "A" }]]) {
      expect((await applyRoute.POST(req("apply", "POST", { changes }))).status).toBe(400);
    }
    upstream.state.failCloudflare = { status: 400, message: "bad value top-secret-value" };
    const res = await applyRoute.POST(req("apply", "POST", { changes: [{ op: "set", name: "X", kind: "secret_text", value: "top-secret-value" }] }));
    expect(await res.text()).not.toContain("top-secret-value");
  });

  it("rate-limits a second apply", async () => {
    await connect();
    const body = { changes: [{ op: "set", name: "SITE_NAME", kind: "plain_text", value: "one" }] };
    expect((await applyRoute.POST(req("apply", "POST", body))).status).toBe(200);
    const again = await applyRoute.POST(req("apply", "POST", { changes: [{ op: "set", name: "SITE_NAME", kind: "plain_text", value: "two" }] }));
    expect(again.status).toBe(429);
    expect(again.headers.get("Retry-After")).toBeTruthy();
  });

  it("applies and rebuilds: syncs NEXT_PUBLIC variables to GitHub, then dispatches the workflow", async () => {
    await connect();
    const res = await applyRoute.POST(
      req("apply", "POST", {
        rebuild: true,
        changes: [
          { op: "set", name: "NEXT_PUBLIC_SENTRY_DSN", kind: "plain_text", value: "https://public@sentry" },
          { op: "set", name: "NEXT_PUBLIC_SECRETISH", kind: "secret_text", value: "nope" },
          { op: "set", name: "SITE_NAME", kind: "plain_text", value: "new" },
        ],
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rebuild.run).toMatchObject({ id: 9001, url: "https://github.com/debate/debate-ai.com/actions/runs/9001" });
    expect(body.rebuild.variables).toEqual([
      { name: "NEXT_PUBLIC_SENTRY_DSN", ok: true },
      { name: "NEXT_PUBLIC_SECRETISH", ok: false, error: expect.stringContaining("never sent to GitHub") },
    ]);
    expect(upstream.state.variables.get("NEXT_PUBLIC_SENTRY_DSN")).toBe("https://public@sentry");
    expect(upstream.state.variables.has("NEXT_PUBLIC_SECRETISH")).toBe(false);

    const dispatch = upstream.calls.find((c) => c.url.endsWith("/dispatches"))!;
    expect(dispatch.url).toBe("https://api.github.com/repos/debate/debate-ai.com/actions/workflows/cloudflare-workers-deploy.yml/dispatches");
    expect(dispatch.body).toMatchObject({ ref: "master", inputs: { app: "debate-web" } });
    expect(dispatch.headers.Authorization).toBe(`Bearer ${GH_TOKEN}`);
    const order = upstream.calls.map((c) => c.method + " " + c.url.split("/").slice(-1)[0]);
    expect(order.findIndex((x) => x === "PATCH settings")).toBeLessThan(order.findIndex((x) => x === "POST dispatches"));
  });

  it("keeps the applied change when the rebuild fails, and says so", async () => {
    await connect();
    upstream.state.failGithub = null;
    const inner = upstream.fetchMock.getMockImplementation()!;
    upstream.fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes("/dispatches")) {
        return new Response(JSON.stringify({ message: `Resource not accessible by personal access token ${GH_TOKEN}` }), { status: 403 });
      }
      return inner(input, init);
    });
    const res = await applyRoute.POST(req("apply", "POST", { rebuild: true, changes: [{ op: "set", name: "SITE_NAME", kind: "plain_text", value: "z" }] }));
    const text = await res.text();
    expect(text).not.toContain(GH_TOKEN);
    const body = JSON.parse(text);
    expect(body.applied).toBe(1);
    expect(body.rebuild.error).toContain("not accessible");
  });
});

describe("rebuild", () => {
  it("dispatches, then reports the run's status and link", async () => {
    await connect();
    const res = await rebuildRoute.POST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.run.id).toBe(9001);

    upstream.state.runs = [upstream.run(9001, "completed", "success")];
    const polled = await (await rebuildRoute.GET(req("rebuild?runId=9001", "GET"))).json();
    expect(polled.run).toMatchObject({ status: "completed", conclusion: "success", url: expect.stringContaining("/runs/9001") });
  });

  it("finds the run by time when GitHub returns no run id, and rate-limits", async () => {
    await connect();
    upstream.state.dispatchReturnsRun = false;
    const first = await (await rebuildRoute.POST()).json();
    expect(first.run).toBeNull();
    const found = await (await rebuildRoute.GET(req(`rebuild?since=${first.dispatchedAt}`, "GET"))).json();
    expect(found.run.id).toBe(9001);
    expect((await rebuildRoute.POST()).status).toBe(429);
  });

  it("needs a GitHub token and a numeric run id", async () => {
    expect((await rebuildRoute.POST()).status).toBe(400);
    await connect();
    expect((await rebuildRoute.GET(req("rebuild?runId=abc", "GET"))).status).toBe(400);
    expect((await rebuildRoute.GET(req("rebuild", "GET"))).status).toBe(400);
  });
});
