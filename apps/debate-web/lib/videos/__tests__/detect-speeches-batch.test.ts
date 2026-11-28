/**
 * @fileoverview The admin "Detect speeches on every round" batch against a
 * real SQLite database. The model and the caption fetch are stubbed; what is
 * under test is the job's own rules: newest rounds first with a stable keyset
 * cursor, rounds that already hold a detection (or have no captions, or are not
 * YouTube ids) are skipped for free, the model runs on at most `limit` rounds,
 * a rate limit stops the page *before* its round, and the free router only ever
 * sees the shared OpenRouter keys.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
const env: Record<string, string | undefined> = {};
const model = vi.hoisted(() => ({
  captions: {} as Record<string, Array<{ text: string; start: number; duration: number }>>,
  detections: [] as string[],
  failures: {} as Record<string, Error>,
  replies: [] as string[],
  requests: [] as Array<{ model: string; key: string; maxTokens: number }>,
}));

vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/videos/speech-analysis", () => ({
  loadCaptions: async (videoId: string) => {
    const captions = model.captions[videoId];
    if (!captions) throw new Error("no captions");
    return captions;
  },
}));
vi.mock("@debate-ai/videos/src/lib/watch-ai-precompute", () => ({
  detectSpeeches: async (
    row: { videoId: string },
    _captions: unknown,
    { ask }: { ask: (system: string, prompt: string, maxTokens: number) => Promise<string> },
  ) => {
    model.detections.push(row.videoId);
    const failure = model.failures[row.videoId];
    if (failure) throw failure;
    if (model.replies.length > 0) await ask("system", "prompt", 100);
    return { speeches: [{ name: "1AC" }, { name: "CX" }, { name: "1NC" }] };
  },
}));
vi.mock("@/lib/ai/write-language-chat", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/ai/write-language-chat")>()),
  writeLanguageChat: async (request: { model: string; key: { key: string }; maxTokens: number }) => {
    model.requests.push({ model: request.model, key: request.key.key, maxTokens: request.maxTokens });
    return { text: model.replies.shift() ?? "" };
  },
}));

const batch = await import("@/lib/videos/detect-speeches-batch");
const { WriteLanguageChatError } = await import("@/lib/ai/write-language-chat");

const CAPTION = [{ text: "hello", start: 0, duration: 1 }];
const id = (n: number) => `video${String(n).padStart(6, "0")}`;
const ELEVEN = (n: number) => id(n).slice(0, 11);

async function addRound(videoId: string, publishedMs: number, extra: Record<string, unknown> = {}) {
  await db.insert(schema.videos).values({ videoId, source: "rounds", title: `Round ${videoId}`, publishedMs, style: 1, ...extra });
  model.captions[videoId] = CAPTION;
}

const run = (options: { afterId?: string | null; limit?: number } = {}) =>
  batch.processDetectSpeechesPage(db, batch.freeRouterKeys(), "admin", { afterId: options.afterId ?? null, limit: options.limit ?? 5 });

beforeEach(async () => {
  db = await freshSchemaDb();
  for (const key of Object.keys(env)) delete env[key];
  env.OPENROUTER_API_KEY = "or-key";
  env.ANTHROPIC_API_KEY = "ant-key";
  Object.assign(model, { captions: {}, detections: [], failures: {}, replies: [], requests: [] });
  const now = new Date();
  await db.insert(schema.user).values({ id: "admin", name: "Admin", email: "admin@example.com", createdAt: now, updatedAt: now });
});

describe("freeRouterKeys / isRateLimitError", () => {
  it("never offers the paid Anthropic key to this job", () => {
    expect(batch.freeRouterKeys()).toEqual([{ provider: "openrouter", key: "or-key", own: false }]);
    delete env.OPENROUTER_API_KEY;
    expect(batch.freeRouterKeys()).toEqual([]);
  });

  it("recognises a rate limit by status or by wording", () => {
    expect(batch.isRateLimitError(new WriteLanguageChatError("x", 429, ""))).toBe(true);
    expect(batch.isRateLimitError(new Error("HTTP 429 from provider"))).toBe(true);
    expect(batch.isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
    expect(batch.isRateLimitError("rate-limited")).toBe(true);
    expect(batch.isRateLimitError(new Error("context length exceeded"))).toBe(false);
    expect(batch.isRateLimitError(new WriteLanguageChatError("x", 500, ""))).toBe(false);
  });
});

describe("getDetectSpeechesStats", () => {
  it("counts rounds (not lectures) and the distinct rounds holding a segmentation", async () => {
    await addRound(ELEVEN(1), 3);
    await addRound(ELEVEN(2), 2);
    await db.insert(schema.videos).values({ videoId: "lecture0001", source: "lectures", title: "Lecture", style: null });
    await db.insert(schema.videoAiResults).values([
      { id: "a", videoId: ELEVEN(1), kind: "segmentation", itemKey: "", data: "{}" },
      { id: "b", videoId: ELEVEN(1), kind: "summary", itemKey: "1ac", data: "{}" },
      { id: "c", videoId: "lecture0001", kind: "segmentation", itemKey: "", data: "{}" },
    ]);
    expect(await batch.getDetectSpeechesStats(db)).toEqual({ rounds: 2, detected: 1 });
  });
});

describe("processDetectSpeechesPage", () => {
  it("detects newest rounds first and saves each result as the admin's, first come", async () => {
    await addRound(ELEVEN(1), 100);
    await addRound(ELEVEN(2), 300);
    await addRound(ELEVEN(3), 200);

    const page = await run();
    expect(model.detections).toEqual([ELEVEN(2), ELEVEN(3), ELEVEN(1)]);
    expect(page).toMatchObject({ scanned: 3, detected: 3, skipped: 0, failed: 0, nextAfterId: ELEVEN(1), done: true, rateLimited: false });
    expect(page.results[0]).toMatchObject({ videoId: ELEVEN(2), status: "detected", speeches: ["1AC", "CX", "1NC"] });

    const saved = await db.select().from(schema.videoAiResults);
    expect(saved).toHaveLength(3);
    expect(saved.every((row) => row.kind === "segmentation" && row.createdBy === "admin")).toBe(true);
  });

  it("skips rounds already detected, with no captions, or whose id is not a YouTube id, without calling the model", async () => {
    await addRound(ELEVEN(1), 500);
    await addRound(ELEVEN(2), 400);
    await addRound(ELEVEN(3), 300);
    await addRound("too-short", 200);
    delete model.captions[ELEVEN(2)];
    await db.insert(schema.videoAiResults).values({ id: "x", videoId: ELEVEN(1), kind: "segmentation", itemKey: "", data: "{}" });

    const page = await run();
    expect(model.detections).toEqual([ELEVEN(3)]);
    expect(page).toMatchObject({ scanned: 4, detected: 1, skipped: 3, failed: 0 });
    expect(page.results.map((line) => line.videoId)).toEqual([ELEVEN(3)]);
  });

  it("runs the model on at most `limit` rounds and resumes from the cursor it returns", async () => {
    for (let n = 1; n <= 3; n++) await addRound(ELEVEN(n), n * 10);

    const first = await run({ limit: 2 });
    expect(first).toMatchObject({ detected: 2, nextAfterId: ELEVEN(2), done: false });
    const second = await run({ limit: 2, afterId: first.nextAfterId });
    expect(second).toMatchObject({ detected: 1, nextAfterId: ELEVEN(1), done: true });
    expect(model.detections).toEqual([ELEVEN(3), ELEVEN(2), ELEVEN(1)]);
  });

  it("breaks ties on publish time by video id, so the cursor never repeats or skips a round", async () => {
    for (let n = 1; n <= 3; n++) await addRound(ELEVEN(n), 50);
    const first = await run({ limit: 1 });
    const second = await run({ limit: 1, afterId: first.nextAfterId });
    const third = await run({ limit: 1, afterId: second.nextAfterId });
    expect(model.detections).toEqual([ELEVEN(1), ELEVEN(2), ELEVEN(3)]);
    expect(third.done).toBe(true);
  });

  it("falls back to id order when the cursor round is no longer in the library", async () => {
    await addRound(ELEVEN(5), 10);
    await addRound(ELEVEN(6), 20);
    const page = await run({ afterId: "aaaaaaaaaaa" });
    expect(model.detections).toEqual([ELEVEN(6), ELEVEN(5)]);
    expect(page.detected).toBe(2);
  });

  it("reports a failed round and moves on", async () => {
    await addRound(ELEVEN(1), 20);
    await addRound(ELEVEN(2), 10);
    model.failures[ELEVEN(1)] = new Error("model returned junk");
    const page = await run();
    expect(page).toMatchObject({ detected: 1, failed: 1, scanned: 2 });
    expect(page.results[0]).toMatchObject({ videoId: ELEVEN(1), status: "failed", reason: "model returned junk" });
  });

  it("counts a failure against the limit", async () => {
    await addRound(ELEVEN(1), 30);
    await addRound(ELEVEN(2), 20);
    model.failures[ELEVEN(1)] = new Error("junk");
    const page = await run({ limit: 1 });
    expect(page).toMatchObject({ failed: 1, detected: 0, nextAfterId: ELEVEN(1), done: false });
    expect(model.detections).toEqual([ELEVEN(1)]);
  });

  it("stops before a rate-limited round so the retry runs it", async () => {
    await addRound(ELEVEN(1), 30);
    await addRound(ELEVEN(2), 20);
    await addRound(ELEVEN(3), 10);
    model.failures[ELEVEN(2)] = new WriteLanguageChatError("slow down", 429, "");

    const page = await run();
    expect(page).toMatchObject({ detected: 1, rateLimited: true, nextAfterId: ELEVEN(1), done: false });
    expect(model.detections).toEqual([ELEVEN(1), ELEVEN(2)]);

    delete model.failures[ELEVEN(2)];
    const retry = await run({ afterId: page.nextAfterId });
    expect(retry.detected).toBe(2);
    expect(model.detections.slice(2)).toEqual([ELEVEN(2), ELEVEN(3)]);
  });

  it("fails a round when the video already holds the most AI results it may", async () => {
    await addRound(ELEVEN(1), 10);
    await db.insert(schema.videoAiResults).values(
      Array.from({ length: 300 }, (_, i) => ({ id: `r${i}`, videoId: ELEVEN(1), kind: "summary", itemKey: `k${i}`, data: "{}" })),
    );
    const page = await run();
    expect(page.failed).toBe(1);
    expect(page.results[0].reason).toContain("as many AI results as it can");
  });

  it("sends the model call to OpenRouter's free router with the shared key, retrying an empty reply", async () => {
    await addRound(ELEVEN(1), 10);
    model.replies = ["", "a real answer"];
    const page = await run();
    expect(page.detected).toBe(1);
    expect(model.requests).toHaveLength(2);
    expect(model.requests.every((request) => request.model === "openrouter/free" && request.key === "or-key")).toBe(true);
    expect(model.requests[0].maxTokens).toBe(6100);
  });

  it("answers an empty library with a finished page", async () => {
    expect(await run()).toEqual({ scanned: 0, detected: 0, skipped: 0, failed: 0, results: [], nextAfterId: null, done: true, rateLimited: false });
  });
});
