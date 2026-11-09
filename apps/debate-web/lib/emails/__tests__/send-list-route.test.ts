/**
 * @fileoverview POST /api/admin/emails/send — the admin Emails section's
 * "Send to a list": one email per address through Resend's batch endpoint,
 * with each address's result. Rendering and Resend are stubbed.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  isAdmin: true,
  batches: [] as Array<Array<{ to: string[]; subject: string }>>,
  batchResult: null as null | ((chunk: Array<{ to: string[] }>) => unknown),
}));

vi.mock("@/lib/auth/admin", () => ({
  getAdminAccess: async () => ({ isAdmin: state.isAdmin, email: "admin@example.com" }),
}));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => (key === "RESEND_API_KEY" ? "re_test" : undefined) }));
vi.mock("@/lib/emails/render", () => ({
  renderEmail: async () => ({ subject: "Welcome to Debate AI", html: "<p>hi</p>", text: "hi" }),
}));
vi.mock("resend", () => ({
  Resend: class {
    batch = {
      send: async (chunk: Array<{ to: string[]; subject: string }>) => {
        state.batches.push(chunk);
        if (state.batchResult) return state.batchResult(chunk);
        return { data: { data: chunk.map((_, i) => ({ id: `id_${i}` })), errors: [] }, error: null };
      },
    };
  },
}));

const { POST } = await import("@/app/api/admin/emails/send/route");

function post(body: unknown) {
  return POST(
    new NextRequest("https://d.ebate.app/api/admin/emails/send", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  state.isAdmin = true;
  state.batches = [];
  state.batchResult = null;
});

describe("POST /api/admin/emails/send", () => {
  it("is admin only", async () => {
    state.isAdmin = false;
    expect((await post({ template: "welcome", recipients: "a@x.com" })).status).toBe(403);
    expect(state.batches).toHaveLength(0);
  });

  it("sends one email per deduplicated address", async () => {
    const res = await post({ template: "welcome", recipients: "a@x.com, B@x.com\nb@x.com" });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(state.batches).toHaveLength(1);
    expect(state.batches[0].map((email) => email.to)).toEqual([["a@x.com"], ["b@x.com"]]);
    expect(data).toMatchObject({ sent: 2, failed: 0 });
    expect(data.results.map((r: { email: string; ok: boolean }) => [r.email, r.ok])).toEqual([
      ["a@x.com", true],
      ["b@x.com", true],
    ]);
  });

  it("splits large lists into batches of 100", async () => {
    const recipients = Array.from({ length: 250 }, (_, i) => `user${i}@example.com`);
    const data = await (await post({ template: "welcome", recipients })).json();
    expect(state.batches.map((batch) => batch.length)).toEqual([100, 100, 50]);
    expect(data.sent).toBe(250);
  });

  it("reports per-address failures from permissive validation", async () => {
    state.batchResult = (chunk) => ({
      data: { data: chunk.slice(1).map((_, i) => ({ id: `id_${i}` })), errors: [{ index: 0, message: "Bounced" }] },
      error: null,
    });
    const data = await (await post({ template: "welcome", recipients: "a@x.com, b@x.com" })).json();
    expect(data).toMatchObject({ sent: 1, failed: 1 });
    expect(data.results[0]).toEqual({ email: "a@x.com", ok: false, error: "Bounced" });
    expect(data.results[1]).toMatchObject({ email: "b@x.com", ok: true, id: "id_0" });
  });

  it("rejects invalid addresses, empty lists and other templates without sending", async () => {
    expect((await post({ template: "welcome", recipients: "a@x.com, nope" })).status).toBe(400);
    expect((await post({ template: "welcome", recipients: " , " })).status).toBe(400);
    expect((await post({ template: "file-invite", recipients: "a@x.com" })).status).toBe(400);
    expect((await post({ template: "welcome", recipients: 42 })).status).toBe(400);
    expect(state.batches).toHaveLength(0);
  });

  it("marks a whole batch failed when Resend refuses or throws", async () => {
    state.batchResult = () => ({ data: null, error: { message: "Rate limited" } });
    let data = await (await post({ recipients: ["a@x.com"] })).json();
    expect(data.results).toEqual([{ email: "a@x.com", ok: false, error: "Rate limited" }]);
    state.batchResult = () => {
      throw new Error("Network down");
    };
    data = await (await post({ recipients: ["a@x.com"] })).json();
    expect(data).toMatchObject({ sent: 0, failed: 1, results: [{ email: "a@x.com", error: "Network down" }] });
  });

  it("rejects a body that isn't JSON", async () => {
    const res = await POST(new NextRequest("https://d.ebate.app/api/admin/emails/send", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
  });

  it("caps a send at 500 addresses", async () => {
    const recipients = Array.from({ length: 501 }, (_, i) => `u${i}@example.com`);
    expect((await post({ template: "welcome", recipients })).status).toBe(400);
  });
});
