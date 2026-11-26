// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requests: Array<{ path: string; params: Record<string, any> }> = [];
/** Resolves (or rejects) the next request; the last handler repeats. */
let handlers: Array<(path: string, params: Record<string, any>) => any> = [];

vi.mock("grab-url", () => {
  const request = (path: string, params: Record<string, any>) => {
    requests.push({ path, params });
    const handler = handlers.length > 1 ? handlers.shift()! : handlers[0];
    try {
      return Promise.resolve(handler(path, params));
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return { default: { instance: () => request } };
});

const api = await import("../src/sync/youtube/youtube-api");

const UC_ID = `UC${"a".repeat(22)}`;

const detail = (id: string, title = `Title ${id}`, views = "10") => ({
  id,
  snippet: {
    title,
    publishedAt: "2024-03-05T10:00:00Z",
    channelTitle: "Chan",
    description: `About ${id}`,
  },
  statistics: { viewCount: views },
});

beforeEach(() => {
  requests.length = 0;
  handlers = [() => ({ items: [] })];
  api.setYouTubeApiKey("k");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  api.setYouTubeApiKey(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getYouTubeApiKey", () => {
  it("prefers the handed-over key, trimmed, and falls back to the environment", () => {
    api.setYouTubeApiKey("  secret  ");
    expect(api.getYouTubeApiKey()).toBe("secret");

    vi.stubEnv("YOUTUBE_API_KEY", "from-env");
    api.setYouTubeApiKey("   ");
    expect(api.getYouTubeApiKey()).toBe("from-env");

    vi.stubEnv("YOUTUBE_API_KEY", "");
    api.setYouTubeApiKey(undefined);
    expect(api.getYouTubeApiKey()).toBe("");
  });
});

describe("YouTubeApiError", () => {
  it("carries the failing path and a recognizable name", () => {
    const err = new api.YouTubeApiError("boom", "/videos");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("YouTubeApiError");
    expect(err.path).toBe("/videos");
  });
});

describe("getChannelId", () => {
  it("returns a channel id as given, with no lookup", async () => {
    await expect(api.getChannelId(UC_ID)).resolves.toBe(UC_ID);
    expect(requests).toEqual([]);
  });

  it("resolves a legacy username first", async () => {
    handlers = [() => ({ items: [{ id: "UCfromUser" }] })];
    await expect(api.getChannelId("@DebateArchive2")).resolves.toBe("UCfromUser");
    expect(requests).toHaveLength(1);
    expect(requests[0].path).toBe("/channels");
    expect(requests[0].params).toMatchObject({ part: "id", forUsername: "DebateArchive2", key: "k" });
  });

  it("falls back to the @handle when the username is unknown", async () => {
    handlers = [() => ({ items: [] }), () => ({ items: [{ id: "UCfromHandle" }] })];
    await expect(api.getChannelId("DebateArchive")).resolves.toBe("UCfromHandle");
    expect(requests.map((r) => r.params.forHandle ?? r.params.forUsername)).toEqual([
      "DebateArchive",
      "@DebateArchive",
    ]);
  });

  it("keeps an existing @ on the handle and survives a failing username lookup", async () => {
    handlers = [
      () => {
        throw new Error("quota");
      },
      () => ({ items: [{ id: "UCfromHandle" }] }),
    ];
    await expect(api.getChannelId("@Handle")).resolves.toBe("UCfromHandle");
    expect(requests[1].params.forHandle).toBe("@Handle");
  });

  it("returns null when neither lookup finds a channel", async () => {
    handlers = [() => ({ items: [] })];
    await expect(api.getChannelId("nobody")).resolves.toBeNull();
    expect(requests).toHaveLength(2);
  });

  it("returns null rather than throwing when both lookups fail", async () => {
    handlers = [
      () => {
        throw new Error("down");
      },
    ];
    await expect(api.getChannelId("nobody")).resolves.toBeNull();
  });
});

describe("getVideosByIds", () => {
  it("maps snippet and statistics to rows, in batches of 50", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `v${i}`);
    handlers = [
      (_path, params) => ({
        items: String(params.id)
          .split(",")
          .map((id) => detail(id)),
      }),
    ];
    const rows = await api.getVideosByIds(ids);
    expect(requests).toHaveLength(2);
    expect(requests[0].params.part).toBe("snippet,statistics");
    expect(String(requests[1].params.id)).toBe("v50");
    expect(rows).toHaveLength(51);
    expect(rows[0]).toEqual(["v0", "Title v0", "2024-03-05", "Chan", 10, "About v0"]);
  });

  it("defaults missing statistics and description", async () => {
    handlers = [
      () => ({
        items: [{ id: "x", snippet: { title: "T", publishedAt: "2020-01-01T00:00:00Z", channelTitle: "C" } }],
      }),
    ];
    await expect(api.getVideosByIds(["x"])).resolves.toEqual([["x", "T", "2020-01-01", "C", 0, ""]]);
  });

  it("returns nothing when the response carries no items", async () => {
    handlers = [() => ({})];
    await expect(api.getVideosByIds(["x"])).resolves.toEqual([]);
  });
});

describe("fetchViewCounts", () => {
  it("skips ids the API omitted and videos with no usable count", async () => {
    handlers = [
      () => ({
        items: [
          { id: "a", statistics: { viewCount: "42" } },
          { id: "b", statistics: {} },
          { id: "c" },
        ],
      }),
    ];
    await expect(api.fetchViewCounts(["a", "b", "c", "d"])).resolves.toEqual({ a: 42 });
  });
});

describe("parseIsoDuration", () => {
  it.each([
    ["PT1H2M3S", 3723],
    ["PT45S", 45],
    ["PT10M", 600],
    ["P1DT2H", 93600],
    ["P1W", 604800],
    ["PT1.6S", 2],
    ["P0D", 0],
    [" PT5M ", 300],
  ])("reads %s as %d seconds", (iso, seconds) => {
    expect(api.parseIsoDuration(iso)).toBe(seconds);
  });

  it.each([[null], [undefined], [""], ["12:34"], ["PT-5S"], ["garbage"]])(
    "returns null for %s",
    (iso) => {
      expect(api.parseIsoDuration(iso as any)).toBeNull();
    },
  );
});

describe("fetchVideoDurations", () => {
  it("reports unparseable durations and absent ids as missing", async () => {
    handlers = [
      () => ({
        items: [
          { id: "a", contentDetails: { duration: "PT1M" } },
          { id: "b", contentDetails: { duration: "nope" } },
          { id: "c" },
        ],
      }),
    ];
    const report = await api.fetchVideoDurations(["a", "b", "c", "d"]);
    expect(report.durations).toEqual({ a: 60 });
    expect(report.missing).toEqual(["b", "c", "d"]);
    expect(requests[0].params.part).toBe("contentDetails");
  });

  it("throws when the API declines", async () => {
    handlers = [() => ({ error: "quotaExceeded" })];
    await expect(api.fetchVideoDurations(["a"])).rejects.toThrow("quotaExceeded");
  });
});

describe("fetchFullDescriptions", () => {
  it("keys descriptions by id, with an empty string when there is none", async () => {
    handlers = [
      () => ({
        items: [
          { id: "a", snippet: { description: "Hello" } },
          { id: "b", snippet: {} },
        ],
      }),
    ];
    await expect(api.fetchFullDescriptions(["a", "b"])).resolves.toEqual({ a: "Hello", b: "" });
    expect(requests[0].params).toMatchObject({ part: "snippet", id: "a,b" });
  });

  it("tolerates a response with no items", async () => {
    handlers = [() => ({})];
    await expect(api.fetchFullDescriptions(["a"])).resolves.toEqual({});
  });
});

describe("getVideosForChannel", () => {
  const playlistItem = (videoId: string, publishedAt: string) => ({
    contentDetails: { videoId, videoPublishedAt: publishedAt },
  });

  it("walks the uploads playlist, filters by date and dedupes across pages", async () => {
    handlers = [
      () => ({
        items: [
          playlistItem("new1", "2024-05-01T00:00:00Z"),
          playlistItem("old", "2019-01-01T00:00:00Z"),
        ],
        nextPageToken: "page2",
      }),
      () => ({ items: [playlistItem("new1", "2024-05-01T00:00:00Z"), playlistItem("new2", "2024-06-01T00:00:00Z")] }),
      (_path, params) => ({
        items: String(params.id)
          .split(",")
          .map((id) => detail(id)),
      }),
    ];

    const rows = await api.getVideosForChannel(UC_ID, "Chan", "2024-01-01");

    expect(requests[0].path).toBe("/playlistItems");
    expect(requests[0].params.playlistId).toBe(`UU${"a".repeat(22)}`);
    expect(requests[0].params.pageToken).toBeUndefined();
    expect(requests[1].params.pageToken).toBe("page2");
    expect(requests[2]).toMatchObject({ path: "/videos", params: { id: "new1,new2" } });
    expect(rows.map((row) => row[0])).toEqual(["new1", "new2"]);
  });

  it("returns an empty list, with no details request, when the playlist is empty", async () => {
    handlers = [() => ({ items: [] })];
    await expect(api.getVideosForChannel(UC_ID, "Chan", "2024-01-01")).resolves.toEqual([]);
    expect(requests).toHaveLength(1);
  });

  it("propagates a failed playlist request", async () => {
    handlers = [() => ({ error: { message: "playlistNotFound" } })];
    await expect(api.getVideosForChannel(UC_ID, "Chan", "2024-01-01")).rejects.toThrow("playlistNotFound");
  });
});

describe("youtubeRequest response handling", () => {
  it("reads a non-JSON body from res.data and falls back to a generic failure message", async () => {
    handlers = [() => ({ data: { items: [{ id: "a", snippet: { description: "x" } }] } })];
    await expect(api.fetchFullDescriptions(["a"])).resolves.toEqual({ a: "x" });

    handlers = [() => ({ error: {} })];
    await expect(api.fetchFullDescriptions(["a"])).rejects.toThrow("YouTube API request failed");
  });
});
