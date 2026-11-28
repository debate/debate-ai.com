/**
 * @fileoverview The transcript backfill against a real SQLite database: it
 * pages through the videos that have no cached transcript, keeps going past a
 * video whose captions can't be fetched, optionally stores an AI summary
 * document, and reports a cursor the caller loops on until `done`. The model
 * call is checked against the request each provider expects.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
const env: Record<string, string | undefined> = {};
const captions = vi.hoisted(() => ({
  byVideo: {} as Record<string, Array<{ text: string; start: number; duration: number }> | Error>,
  fetched: [] as string[],
}));

vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/youtube/transcript", () => ({
  fetchYouTubeTranscript: async (videoId: string) => {
    captions.fetched.push(videoId);
    const result = captions.byVideo[videoId];
    if (!result) throw new Error("No captions available");
    if (result instanceof Error) throw result;
    return result;
  },
}));
vi.mock("@/lib/youtube/transcript-cache", () => ({
  writeCachedTranscript: async (videoId: string, lang: string, snippets: unknown[]) => {
    await db.insert(schema.videoTranscripts).values({ videoId, lang, snippets: JSON.stringify(snippets) });
  },
}));

const scraper = await import("@/lib/videos/transcript-scraper");

const cue = (text: string) => ({ text, start: 0, duration: 1 });

async function addVideos(...ids: string[]) {
  await db.insert(schema.videos).values(ids.map((videoId) => ({ videoId, source: "rounds", title: `Round ${videoId}` })));
}

beforeEach(async () => {
  db = await freshSchemaDb();
  for (const key of Object.keys(env)) delete env[key];
  captions.byVideo = {};
  captions.fetched = [];
  vi.unstubAllGlobals();
});

describe("sharedProviderKey", () => {
  it("prefers OpenRouter, falls back to Anthropic, and cleans a pasted key", () => {
    expect(scraper.sharedProviderKey()).toBeNull();
    env.ANTHROPIC_API_KEY = '"Bearer sk-ant"';
    expect(scraper.sharedProviderKey()).toEqual({ provider: "anthropic", key: "sk-ant", own: false });
    env.OPENROUTER_API_KEY = " sk-or ";
    expect(scraper.sharedProviderKey()).toEqual({ provider: "openrouter", key: "sk-or", own: false });
  });
});

describe("getTranscriptScraperStats", () => {
  it("counts videos, distinct videos with captions, and summaries", async () => {
    await addVideos("v1", "v2", "v3");
    await db.insert(schema.videoTranscripts).values([
      { videoId: "v1", lang: "en", snippets: "[]" },
      { videoId: "v1", lang: "es", snippets: "[]" },
    ]);
    await db.insert(schema.videoDocuments).values([
      { videoId: "v1", kind: "summary", body: "S", author: "ai", wordCount: 1 },
      { videoId: "v1", kind: "analysis", body: "A", author: "ai", wordCount: 1 },
    ]);
    expect(await scraper.getTranscriptScraperStats(db)).toEqual({
      totalVideos: 3,
      withTranscript: 1,
      withoutTranscript: 2,
      withSummary: 1,
    });
  });
});

describe("callModel", () => {
  const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

  it("sends OpenRouter's chat format with the key as a bearer token", async () => {
    const fetchMock = reply({ choices: [{ message: { content: "the summary" } }] });
    vi.stubGlobal("fetch", fetchMock);
    const text = await scraper.callModel({ provider: "openrouter", key: "k", own: false }, "be brief", "prompt", 50);
    expect(text).toBe("the summary");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
    expect(JSON.parse(init.body as string)).toEqual({
      max_tokens: 50,
      model: "openrouter/free",
      messages: [{ role: "system", content: "be brief" }, { role: "user", content: "prompt" }],
    });
  });

  it("omits an empty system message for OpenRouter", async () => {
    const fetchMock = reply({ choices: [{ message: { content: "ok" } }] });
    vi.stubGlobal("fetch", fetchMock);
    await scraper.callModel({ provider: "openrouter", key: "k", own: false }, "", "prompt", 5);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages).toEqual([{ role: "user", content: "prompt" }]);
  });

  it("sends Anthropic's messages format and joins its text blocks", async () => {
    const fetchMock = reply({ content: [{ type: "text", text: "one " }, { type: "tool_use" }, { type: "text", text: "two" }] });
    vi.stubGlobal("fetch", fetchMock);
    const text = await scraper.callModel({ provider: "anthropic", key: "k", own: false }, "sys", "prompt", 9);
    expect(text).toBe("one two");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({ "x-api-key": "k", "anthropic-version": "2023-06-01" });
    expect(JSON.parse(init.body as string)).toMatchObject({ model: scraper.SUMMARY_MODEL, system: "sys", max_tokens: 9 });
  });

  it("throws with the status and a clipped detail on a failed or empty response", async () => {
    vi.stubGlobal("fetch", reply("x".repeat(500), 429));
    await expect(scraper.callModel({ provider: "anthropic", key: "k", own: false }, "", "p", 1)).rejects.toThrow(
      new RegExp(`^AI API returned 429: x{200}$`),
    );
    vi.stubGlobal("fetch", reply({ choices: [{ message: { content: "" } }] }));
    await expect(scraper.callModel({ provider: "openrouter", key: "k", own: false }, "", "p", 1)).rejects.toThrow("empty response");
  });
});

describe("scrapeTranscriptsPage", () => {
  it("caches captions for videos that have none, skipping those already cached", async () => {
    await addVideos("v1", "v2", "v3");
    await db.insert(schema.videoTranscripts).values({ videoId: "v2", lang: "en", snippets: "[]" });
    captions.byVideo = { v1: [cue("hello")], v3: [cue("world")] };

    const result = await scraper.scrapeTranscriptsPage(db, null, 10, false, null);
    expect(result).toEqual({ processed: 2, scraped: 2, summarized: 0, errors: [], nextAfterId: "v3", done: true });
    expect(captions.fetched).toEqual(["v1", "v3"]);
    expect((await db.select().from(schema.videoTranscripts)).map((row) => row.videoId).sort()).toEqual(["v1", "v2", "v3"]);
  });

  it("records a failing video and keeps going", async () => {
    await addVideos("v1", "v2", "v3");
    captions.byVideo = { v1: [cue("a")], v2: new Error("bot check"), v3: [cue("c")] };
    const result = await scraper.scrapeTranscriptsPage(db, null, 10, false, null);
    expect(result.scraped).toBe(2);
    expect(result.errors).toEqual([{ videoId: "v2", error: "bot check" }]);
  });

  it("pages with a cursor until fewer rows than the limit come back", async () => {
    await addVideos("v1", "v2", "v3");
    captions.byVideo = { v1: [cue("a")], v2: [cue("b")], v3: [cue("c")] };

    const first = await scraper.scrapeTranscriptsPage(db, null, 2, false, null);
    expect(first).toMatchObject({ processed: 2, nextAfterId: "v2", done: false });
    const second = await scraper.scrapeTranscriptsPage(db, first.nextAfterId, 2, false, null);
    expect(second).toMatchObject({ processed: 1, nextAfterId: "v3", done: true });
    const empty = await scraper.scrapeTranscriptsPage(db, second.nextAfterId, 2, false, null);
    expect(empty).toEqual({ processed: 0, scraped: 0, summarized: 0, errors: [], nextAfterId: "v3", done: true });
  });

  it("stores an AI summary document per video when summaries are on", async () => {
    await addVideos("v1", "v2");
    captions.byVideo = { v1: [cue("first   speech"), cue("second")], v2: [cue("   ")] };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "A tidy summary" } }] })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await scraper.scrapeTranscriptsPage(db, null, 10, true, { provider: "openrouter", key: "k", own: false });
    expect(result).toMatchObject({ processed: 2, scraped: 2, summarized: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.messages[1].content).toBe("Video title: Round v1\n\nTranscript:\nfirst speech second");

    const [summary] = await db.select().from(schema.videoDocuments);
    expect(summary).toMatchObject({ videoId: "v1", kind: "summary", body: "A tidy summary", author: "ai", model: scraper.SUMMARY_MODEL, wordCount: 3 });
  });

  it("keeps the captions but reports an error when the summary fails, and does not summarise without a key", async () => {
    await addVideos("v1");
    captions.byVideo = { v1: [cue("hello")] };
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    const failed = await scraper.scrapeTranscriptsPage(db, null, 10, true, { provider: "anthropic", key: "k", own: false });
    expect(failed.scraped).toBe(1);
    expect(failed.summarized).toBe(0);
    expect(failed.errors[0].error).toContain("AI API returned 503");
    expect(await db.select().from(schema.videoDocuments)).toEqual([]);

    await db.delete(schema.videoTranscripts);
    const noKey = await scraper.scrapeTranscriptsPage(db, null, 10, true, null);
    expect(noKey).toMatchObject({ scraped: 1, summarized: 0, errors: [] });
  });
});
