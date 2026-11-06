/**
 * @fileoverview `/api/docs-answers` against a real in-memory SQLite database:
 * answers to the docs' suggested questions are public to read, saved once per
 * page and question by the first signed-in reader, and cleared only by staff.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";

// One database for the file: the store creates its table once per isolate.
const db = drizzle(createClient({ url: ":memory:" }), { schema });
let signedInAs: string | null = null;
let isStaff = false;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/auth/admin", () => ({ getStaffAccess: async () => ({ canEditContent: isStaff }) }));

const route = await import("@/app/api/docs-answers/route");

const req = (path: string, init?: RequestInit) => new Request(`https://debate-ai.com${path}`, init) as never;
const post = (body: unknown) => route.POST(req("/api/docs-answers", { method: "POST", body: JSON.stringify(body) }));
const read = async (page: string) => (await route.GET(req(`/api/docs-answers?page=${encodeURIComponent(page)}`))).json();

describe("/api/docs-answers", () => {
  beforeEach(() => {
    signedInAs = null;
    isStaff = false;
  });

  it("is empty, and public, before anyone asks", async () => {
    const res = await route.GET(req("/api/docs-answers?page=/docs/learn/empty"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("public");
    expect(await res.json()).toEqual({ answers: [] });
    expect((await route.GET(req("/api/docs-answers?page=/elsewhere"))).status).toBe(400);
  });

  it("needs a session to save", async () => {
    expect((await post({ page: "/docs/learn/a", question: "Why?", answer: "## Because" })).status).toBe(401);
  });

  it("keeps the first answer to a question and serves it to everyone", async () => {
    const page = "/docs/learn/critiques/heidegger";
    signedInAs = "alex";
    expect(await (await post({ page, question: "What is doing nothing?", answer: "## First" })).json()).toMatchObject({
      stored: true,
    });

    signedInAs = "sam";
    // The same question, asked differently, is the same question.
    const second = await (await post({ page, question: "  what is DOING nothing ", answer: "## Second" })).json();
    expect(second).toEqual({ stored: false, answer: { question: "What is doing nothing?", answer: "## First" } });

    signedInAs = null;
    expect(await read(page)).toEqual({ answers: [{ question: "What is doing nothing?", answer: "## First" }] });
    // Pages and a paper's scope are kept apart.
    expect(await read(`${page}#paper`)).toEqual({ answers: [] });
  });

  it("rejects a bad body", async () => {
    signedInAs = "alex";
    expect((await post({ page: "/docs/x", question: "", answer: "y" })).status).toBe(400);
    expect((await post({ page: "/docs/x", question: "q", answer: "" })).status).toBe(400);
    expect((await post({ page: "https://evil.example/docs/x", question: "q", answer: "a" })).status).toBe(400);
  });

  it("lets only staff clear answers", async () => {
    const page = "/docs/learn/clear-me";
    signedInAs = "alex";
    await post({ page, question: "One?", answer: "1" });
    await post({ page, question: "Two?", answer: "2" });

    const del = (query: string) => route.DELETE(req(`/api/docs-answers?${query}`, { method: "DELETE" }));
    expect((await del(`page=${page}&question=One`)).status).toBe(403);

    isStaff = true;
    expect((await del(`page=${page}&question=one?`)).status).toBe(200);
    expect(await read(page)).toEqual({ answers: [{ question: "Two?", answer: "2" }] });
    await del(`page=${page}`);
    expect(await read(page)).toEqual({ answers: [] });
  });
});
