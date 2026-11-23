/**
 * @fileoverview The hourly round flow job: picks the newest round with no
 * flow chart, records each attempt, leaves failed rounds alone for a week,
 * and honours the pause switch.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videoAiResults, videos } from "../../database/schema";

const precompute = vi.hoisted(() => ({ result: null as any }));

vi.mock("@debate-ai/videos/src/lib/round-flow-precompute", () => ({
  precomputeRoundFlow: vi.fn(async () => precompute.result),
}));
vi.mock("@/lib/videos/video-content", () => ({ getVideoDocuments: vi.fn(async () => []) }));
vi.mock("@/lib/videos/speech-analysis", () => ({ loadCaptions: vi.fn(async () => []) }));
vi.mock("@/lib/videos/transcript-scraper", () => ({
  callModel: vi.fn(async () => ""),
  sharedProviderKey: vi.fn(() => ({ provider: "openrouter", key: "k", own: false })),
}));

import {
  ROUND_FLOW_CRON,
  getRoundFlowStats,
  nextRoundFlowCandidates,
  runRoundFlowOnce,
  setRoundFlowPaused,
} from "../hourly-round-flow";

const key = { provider: "openrouter", key: "k", own: false } as const;
const done = { status: "done", speeches: ["2AR"], detected: false, summaries: ["2AR"], flowChart: true, nodes: 3, errors: [] };

async function seededDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  const db = drizzle(client, { schema });
  await db.insert(videos).values([
    { videoId: "oldoldoldol", title: "Old", source: "round", style: 1, publishedMs: 1 },
    { videoId: "newnewnewne", title: "New", source: "round", style: 1, publishedMs: 3 },
    { videoId: "midmidmidmi", title: "Mid", source: "round", style: 1, publishedMs: 2 },
    { videoId: "lecturelect", title: "Lecture", source: "lecture", style: null, publishedMs: 9 },
  ] as any);
  return db;
}

beforeEach(() => {
  precompute.result = done;
});

describe("hourly round flow", () => {
  it("is scheduled hourly", () => {
    expect(ROUND_FLOW_CRON.split(" ").slice(1)).toEqual(["*", "*", "*", "*"]);
  });

  it("takes the newest round without a flow chart", async () => {
    const db = await seededDb();
    await db.insert(videoAiResults).values({ id: "x", videoId: "newnewnewne", kind: "flowchart", itemKey: "", data: "{}" });
    await runRoundFlowOnce(db, key, { trigger: "cron" });
    const stats = await getRoundFlowStats(db);
    expect(stats.rounds).toBe(3);
    expect(stats.withFlowChart).toBe(1);
    expect(stats.next?.videoId).toBe("oldoldoldol");
    expect(stats.recent.map((run) => run.videoId)).toEqual(["midmidmidmi"]);
    expect(stats.recent[0]).toMatchObject({ status: "done", flowChart: true, trigger: "cron" });
  });

  it("leaves a failed round alone and moves on to the next", async () => {
    const db = await seededDb();
    precompute.result = { ...done, status: "failed", reason: "Flow chart: bad", flowChart: false };
    const first = await runRoundFlowOnce(db, key, { trigger: "cron" });
    expect(first.runs.map((run) => run.videoId)).toEqual(["newnewnewne"]);
    const candidates = await nextRoundFlowCandidates(db, 5);
    expect(candidates.map((row) => row.videoId)).toEqual(["midmidmidmi", "oldoldoldol"]);
    // A week later it is due again.
    const later = await nextRoundFlowCandidates(db, 5, Math.floor(Date.now() / 1000) + 8 * 86_400);
    expect(later[0]?.videoId).toBe("newnewnewne");
  });

  it("works past skipped rounds in one run", async () => {
    const db = await seededDb();
    const results = [{ ...done, status: "skipped", reason: "No captions.", flowChart: false }, done];
    precompute.result = undefined;
    const { precomputeRoundFlow } = await import("@debate-ai/videos/src/lib/round-flow-precompute");
    vi.mocked(precomputeRoundFlow).mockImplementation(async () => results.shift() as any);
    const run = await runRoundFlowOnce(db, key, { trigger: "admin" });
    expect(run.runs.map((entry) => [entry.videoId, entry.status])).toEqual([
      ["newnewnewne", "skipped"],
      ["midmidmidmi", "done"],
    ]);
  });

  it("stores the pause switch", async () => {
    const db = await seededDb();
    await setRoundFlowPaused(db, true);
    expect((await getRoundFlowStats(db)).paused).toBe(true);
    await setRoundFlowPaused(db, false);
    expect((await getRoundFlowStats(db)).paused).toBe(false);
  });
});
