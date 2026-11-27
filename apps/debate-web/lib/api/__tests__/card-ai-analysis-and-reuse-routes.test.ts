/**
 * @fileoverview `/api/card-ai-analysis` (cache, auth for custom prompts, plan
 * limits with refunds, and both providers against a stubbed `fetch`) and
 * `/api/evidence-reuse-check` (lookup by normalised URL, logging, and the
 * contributor upsert), against a real SQLite database.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { FIND_FLAWS_AND_EXTENSIONS_PROMPT, sha256Hex } from "@debate-ai/research-evidence";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alex";
let sharedKeys: Record<string, string | undefined> = {};

vi.mock("@/lib/database/context", () => ({ getCloudflareContext: () => null, getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (signedInAs ? { user: { id: signedInAs } } : null),
}));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  getEnv: (name: string) => sharedKeys[name],
}));

const analysis = await import("@/app/api/card-ai-analysis/route");
const reuse = await import("@/app/api/evidence-reuse-check/route");

const CARD = "Warming is real and caused by humans.";
const post = (body: unknown, headers: Record<string, string> = {}) =>
  analysis.POST(
    new Request("https://debate-ai.com/api/card-ai-analysis", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const anthropicReply = (text: string) =>
  new Response(JSON.stringify({ content: [{ type: "text", text }, { type: "tool_use" }] }), { status: 200 });
const openrouterReply = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });

describe("/api/card-ai-analysis", () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    signedInAs = "alex";
    sharedKeys = { ANTHROPIC_API_KEY: "sk-ant-shared" };
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values({ id: "alex", name: "alex", email: "alex@example.com", createdAt: now, updatedAt: now });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  const usageRows = () => db.select().from(schema.usageCounters);

  it("validates the body", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ content: "   " })).status).toBe(400);
    const long = await post({ content: CARD, prompt: "x".repeat(4_001) });
    expect(long.status).toBe(413);
  });

  it("serves a saved analysis without calling a model, and answers savedOnly misses with null", async () => {
    const [cardHash, promptHash] = await Promise.all([sha256Hex(CARD), sha256Hex(FIND_FLAWS_AND_EXTENSIONS_PROMPT)]);
    await db.insert(schema.cardAiAnalyses).values({ cardHash, promptHash, result: "Saved flaws", model: "m" });
    expect(await (await post({ content: CARD })).json()).toEqual({ result: "Saved flaws", cached: true });
    expect(fetchMock).not.toHaveBeenCalled();

    expect(await (await post({ content: "Another card", savedOnly: true })).json()).toEqual({ result: null, cached: false });
  });

  it("asks guests to sign in for a custom prompt, and reports a server without keys", async () => {
    signedInAs = null;
    expect((await post({ content: CARD, prompt: "Be harsh." })).status).toBe(401);
    sharedKeys = {};
    const res = await post({ content: CARD });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("AI features are not configured on this server.");
  });

  it("runs Anthropic with the shared key, saves the answer and counts one use", async () => {
    fetchMock.mockResolvedValueOnce(anthropicReply("  Flaw one.  "));
    const res = await post({ content: CARD, tag: "Warming" });
    expect(await res.json()).toEqual({ result: "Flaw one.", cached: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("sk-ant-shared");
    expect(JSON.parse(init.body).messages[0].content).toContain(CARD);

    const [saved] = await db.select().from(schema.cardAiAnalyses);
    expect(saved).toMatchObject({ result: "Flaw one.", cardTag: "Warming", userId: "alex" });
    expect((await usageRows())[0]).toMatchObject({ subject: "alex", metric: "cardAiAnalyses", count: 1 });

    expect(await (await post({ content: CARD })).json()).toMatchObject({ cached: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("runs OpenRouter when that is the shared key, and uses a caller's own key without counting usage", async () => {
    sharedKeys = { OPENROUTER_API_KEY: "sk-or-shared" };
    fetchMock.mockResolvedValueOnce(openrouterReply("From OpenRouter"));
    expect(await (await post({ content: CARD })).json()).toEqual({ result: "From OpenRouter", cached: false });
    expect(fetchMock.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer sk-or-shared");

    fetchMock.mockResolvedValueOnce(anthropicReply("Own key answer"));
    const own = await post({ content: "A second card" }, { "x-user-ai-key": "sk-ant-mine" });
    expect(await own.json()).toMatchObject({ result: "Own key answer" });
    expect(fetchMock.mock.calls[1][1].headers["x-api-key"]).toBe("sk-ant-mine");
    expect((await usageRows())[0].count).toBe(1);
  });

  it("stops at the plan's daily limit", async () => {
    fetchMock.mockImplementation(async () => anthropicReply("ok"));
    for (let i = 0; i < 25; i++) expect((await post({ content: `card ${i}` })).status).toBe(200);
    const res = await post({ content: "one too many" });
    expect(res.status).toBe(429);
    expect(typeof (await res.json()).error).toBe("string");
    expect(fetchMock).toHaveBeenCalledTimes(25);
  });

  it("refunds the use and reports a network failure, an upstream error and an empty answer", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const network = await post({ content: CARD });
    expect(network.status).toBe(502);
    expect((await network.json()).error).toContain("offline");

    fetchMock.mockResolvedValueOnce(new Response("overloaded", { status: 529 }));
    const upstream = await post({ content: CARD });
    expect(upstream.status).toBe(502);
    expect((await upstream.json()).error).toBe("AI API returned 529.");

    fetchMock.mockResolvedValueOnce(anthropicReply("   "));
    const empty = await post({ content: CARD });
    expect(empty.status).toBe(502);
    expect((await empty.json()).error).toBe("AI API returned an empty response.");

    expect((await usageRows())[0].count).toBe(0);
    expect(await db.select().from(schema.cardAiAnalyses)).toEqual([]);
  });

  it("explains when the key is out of credit", async () => {
    fetchMock.mockResolvedValueOnce(new Response("credit balance is too low", { status: 402 }));
    const shared = await post({ content: CARD });
    expect(shared.status).toBe(503);
    expect(shared.headers.get("x-ai-key-needed")).toBe("shared-limit");

    fetchMock.mockResolvedValueOnce(new Response("credit balance is too low", { status: 402 }));
    const own = await post({ content: CARD }, { "x-user-ai-key": "sk-ant-mine" });
    expect(own.status).toBe(402);
    expect((await own.json()).error).toContain("Your Anthropic key");
  });
});

describe("/api/evidence-reuse-check", () => {
  const check = (query: string) => reuse.GET(new NextRequest(`https://debate-ai.com/api/evidence-reuse-check?${query}`));
  const contribute = (body: unknown) =>
    reuse.POST(
      new NextRequest("https://debate-ai.com/api/evidence-reuse-check", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  beforeEach(async () => {
    db = drizzle(await freshSchemaClient(), { schema });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("validates the lookup url", async () => {
    expect((await check("")).status).toBe(400);
    expect((await check("url=%20%20")).status).toBe(400);
    const empty = await check("url=https%3A%2F%2F%2F");
    expect(empty.status).toBe(400);
  });

  it("reports whether a source was already cut, ignoring scheme, www, query and trailing slashes", async () => {
    await contribute({ id: "c1", sourceUrl: "https://www.Example.com/paper/", cite: "Smith 24", argBlock: "Warming", topic: "Climate" });
    const hit = await (await check("url=http%3A%2F%2Fexample.com%2Fpaper%3Futm%3D1%23top&source=extension")).json();
    expect(hit).toMatchObject({ alreadyCut: true });
    expect(hit.matches).toEqual([
      { id: "c1", sourceUrl: "https://www.Example.com/paper/", cite: "Smith 24", argBlock: "Warming", topic: "Climate" },
    ]);

    const miss = await (await check("url=example.com%2Fother")).json();
    expect(miss).toMatchObject({ alreadyCut: false, matches: [] });

    const logs = await db.select().from(schema.reuseCheckLog);
    expect(logs.map((log) => [log.alreadyCut, log.matchCount, log.source])).toEqual([
      [true, 1, "extension"],
      [false, 0, "web"],
    ]);
  });

  it("still answers when the lookup log write fails", async () => {
    await contribute({ id: "c1", sourceUrl: "example.com/a", cite: "", argBlock: "", topic: "" });
    vi.spyOn(db, "insert").mockImplementation(() => {
      throw new Error("log down");
    });
    expect((await (await check("url=example.com%2Fa")).json()).alreadyCut).toBe(true);
  });

  it("validates a contribution", async () => {
    expect((await contribute("{nope")).status).toBe(400);
    expect((await contribute({ sourceUrl: "example.com" })).status).toBe(400);
    expect((await contribute({ id: "c1" })).status).toBe(400);
    expect((await contribute({ id: "c1", sourceUrl: "https://" })).status).toBe(400);
  });

  it("creates then updates a contribution by id, truncating long fields", async () => {
    const created = await contribute({ id: "c1", sourceUrl: "example.com/a", cite: "x".repeat(600), contributorId: "u1" });
    expect(created.status).toBe(201);
    expect((await created.json()).cite).toHaveLength(500);

    await contribute({ id: "c1", sourceUrl: "example.com/b", topic: "Updated" });
    const rows = await db.select().from(schema.evidenceReuseIndex).where(eq(schema.evidenceReuseIndex.id, "c1"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ normalizedUrl: "example.com/b", topic: "Updated", cite: "" });
  });
});
