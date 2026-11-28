/**
 * @fileoverview `/api/admin/emails` — the template preview and test-send
 * route behind the admin Emails section. Rendering and Resend are stubbed;
 * what is checked is who may use it, that the panel is told whether sending is
 * possible, that an unknown template is a 404 rather than a render crash, and
 * that a test send goes only to the signed-in admin's own address.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let db: ReturnType<typeof drizzle>;
let admin: { isAdmin: boolean; email: string | null } = { isAdmin: true, email: "admin@example.com" };
const env: Record<string, string | undefined> = {};
const resend = vi.hoisted(() => ({
  keys: [] as string[],
  sent: [] as Array<{ from: string; to: string; subject: string; html: string; text: string }>,
  result: { error: null } as { error: { message?: string } | null },
  throws: null as Error | null,
  renderFails: false,
}));

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => undefined }));
vi.mock("@/lib/auth/admin", () => ({ getAdminAccess: async () => admin }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/emails/render", () => ({
  renderEmailPreview: async (id: string, origin?: string) => {
    if (resend.renderFails) throw new Error("template exploded");
    return { subject: `Subject of ${id}`, html: `<p>${id} at ${origin}</p>`, text: `${id} text` };
  },
}));
vi.mock("resend", () => ({
  Resend: class {
    constructor(key: string) {
      resend.keys.push(key);
    }
    emails = {
      send: async (message: { from: string; to: string; subject: string; html: string; text: string }) => {
        if (resend.throws) throw resend.throws;
        resend.sent.push(message);
        return resend.result;
      },
    };
  },
}));

const route = await import("@/app/api/admin/emails/route");
const { EMAIL_TEMPLATES } = await import("@debate-ai/emails");

const KNOWN = EMAIL_TEMPLATES[0].id;
const get = (query = "") => route.GET(new NextRequest(`https://debate-ai.com/api/admin/emails${query}`));
const post = (body: unknown) =>
  route.POST(new NextRequest("https://debate-ai.com/api/admin/emails", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  db = drizzle(createClient({ url: ":memory:" }));
  admin = { isAdmin: true, email: "admin@example.com" };
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(resend, { keys: [], sent: [], result: { error: null }, throws: null, renderFails: false });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/admin/emails", () => {
  it("is admin only", async () => {
    admin = { isAdmin: false, email: "user@example.com" };
    expect((await get()).status).toBe(403);
    expect((await get(`?template=${KNOWN}`)).status).toBe(403);
  });

  it("lists every template and says whether a Resend key is available", async () => {
    const without = await (await get()).json();
    expect(without.canSend).toBe(false);
    expect(without.templates).toHaveLength(EMAIL_TEMPLATES.length);
    expect(Object.keys(without.templates[0]).sort()).toEqual(["description", "id", "name", "sentFrom"]);

    env.RESEND_API_KEY = "re_env";
    expect((await (await get()).json()).canSend).toBe(true);
  });

  it("renders a known template linked to this deployment's origin", async () => {
    const body = await (await get(`?template=${KNOWN}`)).json();
    expect(body).toEqual({ subject: `Subject of ${KNOWN}`, html: `<p>${KNOWN} at https://debate-ai.com</p>`, text: `${KNOWN} text` });
  });

  it("404s for an unknown template, and 500s with the reason when rendering fails", async () => {
    const unknown = await get("?template=nope");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'Unknown email template "nope".' });

    resend.renderFails = true;
    const failed = await get(`?template=${KNOWN}`);
    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toContain("template exploded");
  });
});

describe("POST /api/admin/emails", () => {
  beforeEach(() => {
    env.RESEND_API_KEY = "re_env";
  });

  it("needs an admin with an address", async () => {
    admin = { isAdmin: false, email: "user@example.com" };
    expect((await post({ template: KNOWN })).status).toBe(403);
    admin = { isAdmin: true, email: null };
    expect((await post({ template: KNOWN })).status).toBe(403);
    expect(resend.sent).toEqual([]);
  });

  it("rejects a malformed body and an unknown template", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ template: "nope" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(resend.sent).toEqual([]);
  });

  it("says so when no Resend key is configured", async () => {
    delete env.RESEND_API_KEY;
    const res = await post({ template: KNOWN });
    expect(res.status).toBe(503);
    expect(resend.sent).toEqual([]);
  });

  it("sends the rendered sample only to the signed-in admin, marked as a test", async () => {
    const res = await post({ template: KNOWN });
    expect(await res.json()).toEqual({ ok: true, to: "admin@example.com" });
    expect(resend.keys).toEqual(["re_env"]);
    expect(resend.sent).toHaveLength(1);
    expect(resend.sent[0]).toMatchObject({ to: "admin@example.com", subject: `[Test] Subject of ${KNOWN}`, text: `${KNOWN} text` });
    expect(resend.sent[0].html).toContain("https://debate-ai.com");
  });

  it("answers 502 when Resend refuses or throws", async () => {
    resend.result = { error: { message: "domain not verified" } };
    const refused = await post({ template: KNOWN });
    expect(refused.status).toBe(502);
    expect(await refused.json()).toEqual({ error: "domain not verified" });

    resend.result = { error: {} };
    expect((await (await post({ template: KNOWN })).json()).error).toBe("Resend refused the email.");

    resend.throws = new Error("network down");
    const thrown = await post({ template: KNOWN });
    expect(thrown.status).toBe(502);
    expect((await thrown.json()).error).toBe("network down");
  });

  it("answers 502 when the template cannot be rendered", async () => {
    resend.renderFails = true;
    const res = await post({ template: KNOWN });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("template exploded");
    expect(resend.sent).toEqual([]);
  });
});
