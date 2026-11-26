// @vitest-environment node
/**
 * @fileoverview The CLI half of the YouTube ingest: the channel scan that
 * merges new rounds and lectures into the JSON files, the view-count refresh,
 * the missing-top-picks backfill, the transcript extractor and the duplicate
 * finder. Each runs against an in-memory `fs` and a stubbed YouTube client, so
 * what is asserted is what each script would have written to disk.
 */
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The "disk": file basename → contents, and the names written, in order. */
const fsMock = vi.hoisted(() => ({ disk: new Map<string, string>(), written: [] as string[] }));
const { disk, written } = fsMock;

vi.mock("fs", () => {
  const read = (file: string) => {
    const key = file.split(/[\\/]/).pop()!;
    const value = fsMock.disk.get(key);
    if (value === undefined) throw Object.assign(new Error(`ENOENT: ${file}`), { code: "ENOENT" });
    return value;
  };
  const write = (file: string, data: string) => {
    const key = file.split(/[\\/]/).pop()!;
    fsMock.disk.set(key, data);
    fsMock.written.push(key);
  };
  return {
    promises: {
      readFile: async (file: string) => read(file),
      writeFile: async (file: string, data: string) => write(file, data),
      unlink: async (file: string) => {
        const key = file.split(/[\\/]/).pop()!;
        if (!fsMock.disk.delete(key)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
    },
    readFileSync: (file: string) => read(file),
    writeFileSync: (file: string, data: string) => write(file, data),
  };
});

const api = vi.hoisted(() => ({
  getChannelId: vi.fn(),
  getVideosForChannel: vi.fn(),
  getVideosByIds: vi.fn(),
  fetchFullDescriptions: vi.fn(),
  YoutubeAPI: vi.fn(),
}));
vi.mock("../src/sync/youtube/youtube-api", () => api);

vi.mock("../src/sync/youtube/channel-config", () => ({
  channelsToUpdate: [],
  channels: ["chanA", "chanB", "chanC"],
  publishedAfter: "2024-01-01",
  ROUNDS_FILES: { 1: "rounds-policy.json", 2: "rounds-pf.json", 3: "rounds-ld.json", 4: "rounds-college.json" },
}));

const transcripts = vi.hoisted(() => ({ fetchTranscript: vi.fn() }));
vi.mock("extract-youtube", () => ({
  YouTubeTranscriptApi: class {
    fetchTranscript = transcripts.fetchTranscript;
  },
}));

const json = (file: string) => JSON.parse(disk.get(file)!);

beforeEach(() => {
  disk.clear();
  written.length = 0;
  vi.resetModules();
  for (const fn of Object.values(api)) fn.mockReset();
  transcripts.fetchTranscript.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const video = (id: string, title: string, date: string, desc = "", views = 100, channel = "Chan") => [id, title, date, channel, views, desc];

describe("syncYouTubeVideos", () => {
  it("refuses to run without an API key", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const { syncYouTubeVideos } = await import("../src/sync/youtube/youtube-sync");
    await expect(syncYouTubeVideos()).rejects.toThrow("YouTube API key not configured");
    expect(api.getChannelId).not.toHaveBeenCalled();
  });

  it("scans each channel, files rounds by style and lectures by category, and merges into existing files", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    api.getChannelId.mockImplementation(async (name: string) => (name === "chanB" ? null : `id-${name}`));
    api.getVideosForChannel.mockImplementation(async (id: string) => {
      if (id === "id-chanA") {
        return [
          video("r1", "TOC Finals: Michigan KM vs Northwestern BC", "2025-03-01", "Full round"),
          video("r2", "Harvard PF Finals: Lex AB vs Ben CD", "2025-04-01", "Full round"),
          video("old", "Wake CX Semis: Iowa AB vs Emory CD", "2025-01-01", "dup of an existing round"),
          video("l1", "Intro to Public Forum", "2025-02-01", "A very long description that was cut off..."),
        ];
      }
      return [video("l2", "2024 Topic Analysis", "2025-05-01", "topic")];
    });
    api.fetchFullDescriptions.mockResolvedValue({ l1: "The full untruncated description" });
    disk.set("new-rounds-policy.json", JSON.stringify([["old", "Existing title", "2025-01-01"], ["older", "Older", "2024-06-01"]]));

    const { syncYouTubeVideos } = await import("../src/sync/youtube/youtube-sync");
    const result = await syncYouTubeVideos();

    expect(api.getChannelId.mock.calls.map((c) => c[0])).toEqual(["chanA", "chanB", "chanC"]);
    expect(api.getVideosForChannel).toHaveBeenCalledTimes(2);
    expect(api.getVideosForChannel).toHaveBeenCalledWith("id-chanA", "chanA", "2024-01-01");
    expect(api.fetchFullDescriptions).toHaveBeenCalledWith(["l1"]);

    const policy = json("new-rounds-policy.json");
    expect(policy.map((row: string[]) => row[0])).toEqual(["r1", "old", "older"]);
    expect(policy[1][1]).toBe("Existing title");
    expect(policy[0]).toHaveLength(17);
    expect(policy[0].slice(0, 7)).toEqual(["r1", "TOC Finals: Michigan KM vs Northwestern BC", "2025-03-01", "Chan", 100, "Full round", 1]);
    expect(policy[0][8]).toBe("Finals");
    expect(json("new-rounds-pf.json").map((row: string[]) => row[0])).toEqual(["r2"]);
    expect(disk.has("new-rounds-ld.json")).toBe(false);
    expect(disk.has("new-rounds-college.json")).toBe(false);

    const lectures = json("new-lectures.json");
    expect(lectures.map((row: string[]) => row[0])).toEqual(["l2", "l1"]);
    expect(lectures.find((row: string[]) => row[0] === "l1")[5]).toBe("The full untruncated description");
    expect(lectures[0]).toHaveLength(7);

    expect(result.success).toBe(true);
    expect(result.stats).toMatchObject({
      fetched: 5,
      truncatedFixed: 1,
      classified: { rounds: 3, roundsByStyle: { policy: 2, pf: 1, ld: 0, college: 0 }, lectures: 2 },
      merged: { policy: { total: 3, existing: 2, new: 1, duplicates: 1 }, pf: { total: 1, existing: 0, new: 1, duplicates: 0 } },
      lectures: { total: 2, existing: 0, new: 2, duplicates: 0 },
    });
    expect(result.stats.outputFiles.rounds.map((file: string) => path.basename(file))).toEqual(["new-rounds-policy.json", "new-rounds-pf.json"]);
  });

  it("merges lectures into an existing file without duplicating", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    api.getChannelId.mockResolvedValue("id");
    api.getVideosForChannel.mockResolvedValueOnce([video("l1", "Intro to Public Forum", "2025-02-01", "short")]).mockResolvedValue([]);
    disk.set("new-lectures.json", JSON.stringify([["l1", "Intro to Public Forum", "2025-02-01"], ["l0", "Earlier", "2024-12-01"]]));

    const { syncYouTubeVideos } = await import("../src/sync/youtube/youtube-sync");
    const { stats } = await syncYouTubeVideos();

    expect(api.fetchFullDescriptions).not.toHaveBeenCalled();
    expect(json("new-lectures.json").map((row: string[]) => row[0])).toEqual(["l1", "l0"]);
    expect(stats.lectures).toMatchObject({ total: 2, existing: 2, new: 0, duplicates: 1 });
    expect(stats.merged).toEqual({});
  });
});

describe("syncMissingTopPicks", () => {
  const withKey = async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    return (await import("../src/sync/youtube/youtube-sync")).syncMissingTopPicks;
  };

  it("refuses to run without an API key", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const { syncMissingTopPicks } = await import("../src/sync/youtube/youtube-sync");
    await expect(syncMissingTopPicks()).rejects.toThrow("YouTube API key not configured");
  });

  it("does nothing for an empty list", async () => {
    const run = await withKey();
    disk.set("missing-top-picks.txt", "\n  \n");
    expect(await run()).toBeUndefined();
    expect(api.getVideosByIds).not.toHaveBeenCalled();
  });

  it("adds new videos to the split file for their style and reports the ones YouTube lacks", async () => {
    const run = await withKey();
    disk.set("missing-top-picks.txt", "have\nnewPolicy\nnewUnknownStyle\n gone \n");
    for (const [file, ids] of [["rounds-policy.json", ["have"]], ["rounds-pf.json", []], ["rounds-ld.json", []], ["rounds-college.json", []]] as const) {
      disk.set(file, JSON.stringify({ data: ids.map((id) => [id]) }));
    }
    api.getVideosByIds.mockResolvedValue([
      ["have", "t", "d", "c", 1, "", 1],
      ["newPolicy", "t", "d", "c", 1, "", 1],
      ["newUnknownStyle", "t", "d", "c", 1, "", 0],
    ]);

    const result = await run();

    expect(api.getVideosByIds).toHaveBeenCalledWith(["have", "newPolicy", "newUnknownStyle", "gone"]);
    expect(json("rounds-policy.json").data.map((row: string[]) => row[0])).toEqual(["have", "newPolicy"]);
    expect(json("rounds-college.json").data.map((row: string[]) => row[0])).toEqual(["newUnknownStyle"]);
    expect(result).toEqual({ added: 2, notFound: ["gone"] });
  });
});

describe("updateVideoViewCounts", () => {
  const seedFiles = () => {
    disk.set("rounds-policy.json", JSON.stringify({ data: [["p1", "t", "d", "c", 10], ["p2", "t", "d", "c", 20]] }));
    disk.set("rounds-pf.json", JSON.stringify({ data: [["f1", "t", "d", "c", 30]] }));
    disk.set("rounds-ld.json", JSON.stringify({ data: [] }));
    disk.set("rounds-college.json", JSON.stringify({ data: [] }));
    disk.set("debate-lectures.json", JSON.stringify({ data: [["l1", "t", "d", "c", 40]] }));
  };
  const views = (counts: Record<string, string>) => async (_path: string, params: { id: string }) => ({
    items: params.id.split(",").filter((id) => id in counts).map((id) => ({ id, statistics: { viewCount: counts[id] } })),
  });

  it("refuses to run without an API key", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const { updateVideoViewCounts } = await import("../src/sync/youtube/youtube-update-views");
    await expect(updateVideoViewCounts()).rejects.toThrow("YouTube API key not configured");
  });

  it("writes new counts back to each file, tallies changes and removes the progress file when done", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    seedFiles();
    api.YoutubeAPI.mockImplementation(views({ p1: "15", p2: "20", f1: "35", l1: "40" }));
    const { updateVideoViewCounts } = await import("../src/sync/youtube/youtube-update-views");

    const stats = await updateVideoViewCounts(50);

    expect(api.YoutubeAPI).toHaveBeenCalledTimes(1);
    expect(api.YoutubeAPI).toHaveBeenCalledWith("/videos", { part: "statistics", id: "p1,p2,f1,l1" });
    expect(json("rounds-policy.json").data.map((row: unknown[]) => row[4])).toEqual([15, 20]);
    expect(json("rounds-pf.json").data[0][4]).toBe(35);
    expect(json("debate-lectures.json").data[0][4]).toBe(40);
    expect(stats).toMatchObject({ totalVideos: 4, processedCount: 4, updatedCount: 2, errorCount: 0, unchangedCount: 2 });
    expect(disk.has("youtube-update-progress.json")).toBe(false);
  });

  it("works through the list in batches", async () => {
    vi.useFakeTimers();
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    seedFiles();
    api.YoutubeAPI.mockImplementation(views({ p1: "11", p2: "21", f1: "31", l1: "41" }));
    const { updateVideoViewCounts } = await import("../src/sync/youtube/youtube-update-views");

    const pending = updateVideoViewCounts(3);
    await vi.runAllTimersAsync();
    const stats = await pending;

    expect(api.YoutubeAPI.mock.calls.map((call) => call[1].id)).toEqual(["p1,p2,f1", "l1"]);
    expect(stats.updatedCount).toBe(4);
    expect(json("debate-lectures.json").data[0][4]).toBe(41);
  });

  it("resumes after the last processed video from a saved progress file", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    seedFiles();
    disk.set(
      "youtube-update-progress.json",
      JSON.stringify({ lastProcessedIndex: 1, processedCount: 2, updatedCount: 1, errorCount: 0, startTime: "t", lastUpdateTime: "t" }),
    );
    api.YoutubeAPI.mockImplementation(views({ f1: "99", l1: "40" }));
    const { updateVideoViewCounts } = await import("../src/sync/youtube/youtube-update-views");

    const stats = await updateVideoViewCounts();

    expect(api.YoutubeAPI).toHaveBeenCalledWith("/videos", { part: "statistics", id: "f1,l1" });
    expect(json("rounds-policy.json").data.map((row: unknown[]) => row[4])).toEqual([10, 20]);
    expect(stats).toMatchObject({ processedCount: 4, updatedCount: 2, unchangedCount: 2, startTime: "t" });
    expect(disk.has("youtube-update-progress.json")).toBe(false);
  });

  it("counts a batch with no data as errors and keeps the progress file for the next run", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    seedFiles();
    api.YoutubeAPI.mockResolvedValue({});
    const { updateVideoViewCounts } = await import("../src/sync/youtube/youtube-update-views");

    const stats = await updateVideoViewCounts();

    expect(stats).toMatchObject({ processedCount: 0, errorCount: 4, updatedCount: 0 });
    expect(json("youtube-update-progress.json")).toMatchObject({ errorCount: 4, lastProcessedIndex: -1 });
  });

  it("counts a failing request as errors without losing the other data", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    seedFiles();
    api.YoutubeAPI.mockRejectedValue(new Error("quotaExceeded"));
    const { updateVideoViewCounts } = await import("../src/sync/youtube/youtube-update-views");

    const stats = await updateVideoViewCounts();

    expect(stats.errorCount).toBe(4);
    expect(json("rounds-policy.json").data.map((row: unknown[]) => row[4])).toEqual([10, 20]);
    expect(disk.has("youtube-update-progress.json")).toBe(true);
  });
});

describe("extract-transcripts script", () => {
  const run = async (...args: string[]) => {
    const argv = process.argv;
    process.argv = [...argv.slice(0, 2), ...args];
    try {
      await import("../src/sync/youtube/extract-transcripts");
      await vi.waitFor(() => expect(written).toContain("transcripts.json"));
    } finally {
      process.argv = argv;
    }
  };
  const snippets = (text: unknown) => ({ snippets: [{ text, start: 1.5, duration: 2 }] });

  it("fetches a transcript per lecture, saves failures as skipped, and keeps existing ones", async () => {
    disk.set("debate-lectures.json", JSON.stringify({ data: [["a", "Lecture A"], ["b", "Lecture B"], ["c", "Lecture C"]] }));
    disk.set("transcripts.json", JSON.stringify({ a: [{ text: "kept", start: 0, duration: 1 }] }));
    transcripts.fetchTranscript.mockImplementation(async (id: string) => {
      if (id === "c") throw new Error("captions disabled");
      return snippets("hello");
    });

    await run();

    expect(transcripts.fetchTranscript.mock.calls.map((c) => c[0])).toEqual(["b", "c"]);
    expect(json("transcripts.json")).toEqual({
      a: [{ text: "kept", start: 0, duration: 1 }],
      b: [{ text: "hello", start: 1.5, duration: 2 }],
    });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("captions disabled"));
  });

  it("--overwrite refetches, --limit caps the list, and a non-string snippet becomes empty text", async () => {
    disk.set("debate-lectures.json", JSON.stringify([["a", "Lecture A"], ["b", "Lecture B"]]));
    disk.set("transcripts.json", JSON.stringify({ a: [{ text: "stale", start: 0, duration: 1 }] }));
    transcripts.fetchTranscript.mockResolvedValue(snippets(undefined));

    await run("--overwrite", "--limit=1");

    expect(transcripts.fetchTranscript.mock.calls.map((c) => c[0])).toEqual(["a"]);
    expect(json("transcripts.json")).toEqual({ a: [{ text: "", start: 1.5, duration: 2 }] });
  });

  it("starts fresh when there is no transcripts file yet", async () => {
    disk.set("debate-lectures.json", JSON.stringify({ data: [["a", "Lecture A"]] }));
    transcripts.fetchTranscript.mockResolvedValue(snippets("hi"));

    await run();

    expect(Object.keys(json("transcripts.json"))).toEqual(["a"]);
  });
});

describe("find-duplicate-videos script", () => {
  const files = ["debate-lectures.json", "debate-top-picks.json", "rounds-college.json", "rounds-ld.json", "rounds-pf.json", "rounds-policy.json"];
  const seed = () => {
    for (const file of files) disk.set(file, JSON.stringify({ data: [] }));
    disk.set("rounds-pf.json", JSON.stringify({ data: [["dup", "PF copy"], ["solo", "Only here"]] }));
    disk.set("rounds-policy.json", JSON.stringify({ data: [{ id: "dup", title: "Policy copy" }, { title: "no id" }] }));
    disk.set("debate-top-picks.json", JSON.stringify({ data: [["dup", "Top pick copy"]] }));
  };
  const run = async (...args: string[]) => {
    const argv = process.argv;
    process.argv = [...argv.slice(0, 2), ...args];
    try {
      await import("../src/sync/youtube/find-duplicate-videos");
    } finally {
      process.argv = argv;
    }
  };

  it("reports a video id that appears in more than one file, without changing anything", async () => {
    seed();
    await run();
    const output = vi.mocked(console.log).mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Found 1 duplicate video ID(s)");
    expect(output).toContain('[debate-top-picks.json] index 0: "Top pick copy"');
    expect(output).toContain('[rounds-pf.json] index 0: "PF copy"');
    expect(output).toContain('[rounds-policy.json] index 0: "Policy copy"');
    expect(written).toEqual([]);
  });

  it("--fix keeps the first occurrence and rewrites only the files that lost a copy", async () => {
    seed();
    await run("--fix");
    expect(written.sort()).toEqual(["rounds-pf.json", "rounds-policy.json"]);
    expect(json("rounds-pf.json").data).toEqual([["solo", "Only here"]]);
    expect(json("rounds-policy.json").data).toEqual([{ title: "no id" }]);
    expect(json("debate-top-picks.json").data).toEqual([["dup", "Top pick copy"]]);
  });

  it("says so when nothing is duplicated", async () => {
    for (const file of files) disk.set(file, JSON.stringify({ data: [["unique-" + file, "t"]] }));
    await run("--fix");
    expect(console.log).toHaveBeenCalledWith("No duplicates found.");
    expect(written).toEqual([]);
  });
});

describe("channel config", () => {
  it("lists each subscribed channel once, with the parliamentary channels subscribed", async () => {
    vi.doUnmock("../src/sync/youtube/channel-config");
    vi.resetModules();
    const config = await import("../src/sync/youtube/channel-config");
    expect(new Set(config.channels).size).toBe(config.channels.length);
    expect(config.channels.every((name) => name === name.trim() && name.length > 0)).toBe(true);
    for (const name of config.PARLI_CHANNELS) expect(config.channels).toContain(name);
    expect(config.publishedAfter).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(config.ROUNDS_FILES).map(Number)).toEqual([1, 2, 3, 4]);
    expect(Object.values(config.ROUNDS_FILES).every((file) => /^rounds-[a-z]+\.json$/.test(file))).toBe(true);
  });
});
