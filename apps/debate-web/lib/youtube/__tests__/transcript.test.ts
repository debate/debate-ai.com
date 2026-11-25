/**
 * @fileoverview `fetchYouTubeTranscript` with `fetch` stubbed: which InnerTube
 * client and caption track it picks, both caption payload formats (json3 and
 * srv3/legacy XML) with their entity decoding, the optional fetch-through
 * proxy, and the bot-check retry before it gives up.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let workerEnv: Record<string, string> | null = null;
vi.mock("@/lib/database/context", () => ({
  getCloudflareContext: () => {
    if (workerEnv === null) throw new Error("no request context");
    return { env: workerEnv };
  },
}));

const { fetchYouTubeTranscript, TranscriptUnavailableError } = await import("../transcript");

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let calls: Array<{ url: string; init?: RequestInit }>;

function stubFetch(handler: Handler) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
}

const playerResponse = (tracks: unknown[], playability: Record<string, string> = { status: "OK" }) =>
  Response.json({ playabilityStatus: playability, captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } } });

const json3 = (events: unknown[]) => new Response(JSON.stringify({ events }));

const isPlayer = (url: string) => url.includes("/youtubei/v1/player");
const clientOf = (init?: RequestInit) => JSON.parse(String(init?.body)).context.client.clientName as string;

beforeEach(() => {
  workerEnv = null;
  delete process.env.YOUTUBE_PROXY_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.YOUTUBE_PROXY_URL;
});

describe("fetchYouTubeTranscript", () => {
  it("reads json3 captions, joining segments, squeezing whitespace and decoding entities", async () => {
    stubFetch((url) => {
      if (isPlayer(url)) return playerResponse([{ baseUrl: "https://captions.test/t?lang=en", languageCode: "en" }]);
      return json3([
        { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: "Tom &amp;  Jerry" }, { utf8: " &#39;run&#x27;\n" }] },
        { tStartMs: 1500, segs: [{ utf8: "   " }] }, // blank: dropped
        { dDurationMs: 10, segs: [{ utf8: "no start" }] }, // no start: dropped
        { tStartMs: 2500, dDurationMs: 500, segs: [{ utf8: "&lt;b&gt; &unknown; &nbsp;x" }, {}] },
      ]);
    });

    expect(await fetchYouTubeTranscript("abcdefghijk")).toEqual([
      { text: "Tom & Jerry 'run'", start: 0, duration: 1.5 },
      { text: "<b> &unknown;  x", start: 2.5, duration: 0.5 },
    ]);
    const trackCall = calls.find((c) => !isPlayer(c.url))!;
    expect(new URL(trackCall.url).searchParams.get("fmt")).toBe("json3");
    expect(new URL(trackCall.url).searchParams.get("lang")).toBe("en");
  });

  it("parses srv3 <p t d> and legacy <text start dur> XML when a track ignores fmt", async () => {
    let n = 0;
    stubFetch((url) => {
      if (isPlayer(url)) {
        return playerResponse([
          { baseUrl: "https://captions.test/srv3", languageCode: "en" },
          { baseUrl: "https://captions.test/legacy", languageCode: "en" },
        ]);
      }
      n++;
      if (url.includes("srv3")) return new Response(""); // first track empty → next track
      return new Response(
        `<?xml version="1.0"?><transcript>
          <text start="1.25" dur="2">Hello &amp;amp; <font>world</font></text>
          <text start="4">no duration</text>
          <p t="5000" d="750">srv3 line</p>
          <text dur="1">no start</text>
          <text start="9" dur="1">   </text>
        </transcript>`,
      );
    });

    expect(await fetchYouTubeTranscript("abcdefghijk")).toEqual([
      { text: "Hello &amp; world", start: 1.25, duration: 2 },
      { text: "no duration", start: 4, duration: 0 },
      { text: "srv3 line", start: 5, duration: 0.75 },
    ]);
    expect(n).toBe(2);
  });

  it("prefers human captions in the requested language, then auto captions, then other languages", async () => {
    const order: string[] = [];
    stubFetch((url) => {
      if (isPlayer(url)) {
        return playerResponse([
          { baseUrl: "https://captions.test/fr-asr", languageCode: "fr", kind: "asr" },
          { baseUrl: "https://captions.test/de", languageCode: "de" },
          { baseUrl: "https://captions.test/es-asr", languageCode: "es-419", kind: "asr" },
          { baseUrl: "https://captions.test/es", languageCode: "ES" },
        ]);
      }
      order.push(new URL(url).pathname.slice(1));
      return new Response("{}"); // parses, but holds no events
    });

    await expect(fetchYouTubeTranscript("abcdefghijk", "es")).rejects.toBeInstanceOf(TranscriptUnavailableError);
    // Tried once per client (iOS, then Android).
    expect(order.slice(0, 4)).toEqual(["es", "es-asr", "de", "fr-asr"]);
    expect(order).toHaveLength(8);
  });

  it("asks the iOS client first and falls through to Android when iOS has no tracks", async () => {
    stubFetch((url, init) => {
      if (isPlayer(url)) {
        return clientOf(init) === "IOS"
          ? playerResponse([], { status: "UNPLAYABLE", reason: "Video unavailable" })
          : playerResponse([{ baseUrl: "https://captions.test/a", languageCode: "en" }]);
      }
      return json3([{ tStartMs: 1000, segs: [{ utf8: "android" }] }]);
    });
    expect(await fetchYouTubeTranscript("abcdefghijk")).toEqual([{ text: "android", start: 1, duration: 0 }]);
    const players = calls.filter((c) => isPlayer(c.url));
    expect(players.map((c) => clientOf(c.init))).toEqual(["IOS", "ANDROID"]);
    expect((players[0].init?.headers as Record<string, string>)["User-Agent"]).toMatch(/ios/);
  });

  it("skips a track that fails or returns malformed JSON", async () => {
    stubFetch((url) => {
      if (isPlayer(url)) {
        return playerResponse([
          { baseUrl: "https://captions.test/500", languageCode: "en" },
          { baseUrl: "https://captions.test/bad", languageCode: "en" },
          { baseUrl: "https://captions.test/throws", languageCode: "en" },
          { baseUrl: "https://captions.test/ok", languageCode: "en" },
        ]);
      }
      if (url.includes("/500")) return new Response("x", { status: 500 });
      if (url.includes("/bad")) return new Response("{not json");
      if (url.includes("/throws")) throw new Error("socket hang up");
      return json3([{ tStartMs: 0, segs: [{ utf8: "ok" }] }]);
    });
    expect((await fetchYouTubeTranscript("abcdefghijk"))[0].text).toBe("ok");
  });

  it("reports the playability reason when nothing is readable, without retrying", async () => {
    stubFetch(() => playerResponse([], { status: "ERROR", reason: "Private video" }));
    await expect(fetchYouTubeTranscript("abcdefghijk")).rejects.toThrow(
      "No transcript available for abcdefghijk: Private video",
    );
    expect(calls).toHaveLength(2);
  });

  it("reports a non-OK HTTP status and a thrown network error", async () => {
    stubFetch(() => new Response("", { status: 429 }));
    await expect(fetchYouTubeTranscript("abcdefghijk")).rejects.toThrow("HTTP 429");

    stubFetch(() => {
      throw new Error("ECONNRESET");
    });
    await expect(fetchYouTubeTranscript("abcdefghijk")).rejects.toThrow("ECONNRESET");
  });

  it("retries once after a bot check, then succeeds", async () => {
    vi.useFakeTimers();
    let players = 0;
    stubFetch((url) => {
      if (isPlayer(url)) {
        players++;
        return players <= 2
          ? playerResponse([], { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you're not a bot" })
          : playerResponse([{ baseUrl: "https://captions.test/a", languageCode: "en" }]);
      }
      return json3([{ tStartMs: 0, segs: [{ utf8: "second try" }] }]);
    });
    const pending = fetchYouTubeTranscript("abcdefghijk");
    await vi.advanceTimersByTimeAsync(500);
    expect((await pending)[0].text).toBe("second try");
    expect(players).toBe(3);
  });

  it("gives up after the one retry when the bot check persists", async () => {
    vi.useFakeTimers();
    stubFetch(() => playerResponse([], { status: "LOGIN_REQUIRED" }));
    const pending = fetchYouTubeTranscript("abcdefghijk");
    const assertion = expect(pending).rejects.toThrow("LOGIN_REQUIRED");
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    expect(calls).toHaveLength(4);
  });
});

describe("the fetch-through proxy", () => {
  const ok: Handler = (url) => {
    const target = decodeURIComponent(url);
    if (isPlayer(target)) return playerResponse([{ baseUrl: "https://captions.test/a", languageCode: "en" }]);
    return json3([{ tStartMs: 0, segs: [{ utf8: "via proxy" }] }]);
  };

  it("substitutes the encoded target into a {url} template from process.env", async () => {
    process.env.YOUTUBE_PROXY_URL = "https://proxy.test/fetch?key=k&target={url}";
    stubFetch(ok);
    await fetchYouTubeTranscript("abcdefghijk");
    for (const { url } of calls) {
      expect(url.startsWith("https://proxy.test/fetch?key=k&target=https%3A%2F%2F")).toBe(true);
    }
  });

  it("appends the target as a url param, preferring the Worker binding", async () => {
    process.env.YOUTUBE_PROXY_URL = "https://ignored.test/";
    workerEnv = { YOUTUBE_PROXY_URL: "https://worker-proxy.test/go" };
    stubFetch(ok);
    await fetchYouTubeTranscript("abcdefghijk");
    expect(calls[0].url.startsWith("https://worker-proxy.test/go?url=https%3A%2F%2Fwww.youtube.com")).toBe(true);

    workerEnv = { YOUTUBE_PROXY_URL: "https://worker-proxy.test/go?k=1" };
    stubFetch(ok);
    await fetchYouTubeTranscript("abcdefghijk");
    expect(calls[0].url.startsWith("https://worker-proxy.test/go?k=1&url=")).toBe(true);
  });

  it("fetches YouTube directly when no proxy is configured", async () => {
    workerEnv = {};
    stubFetch(ok);
    await fetchYouTubeTranscript("abcdefghijk");
    expect(calls[0].url.startsWith("https://www.youtube.com/youtubei/v1/player?key=")).toBe(true);
  });
});
