// @vitest-environment jsdom
/**
 * @fileoverview Tests for the recorder's IndexedDB media store (with and
 * without IndexedDB, clip indexing and replacement, the record-video
 * setting) and for uploading a joined round recording to R2.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoundRecordingManifest } from "../src/recorder/round-recording";
import { createFakeIndexedDb, type FakeIndexedDb } from "./helpers/fake-indexeddb";

type MediaStore = typeof import("../src/recorder/media-store");
type Cloud = typeof import("../src/recorder/round-recording-cloud");

let fake: FakeIndexedDb;
let store: MediaStore;
let cloud: Cloud;

/** Fresh modules, so the media store re-opens its (module-cached) database. */
async function load(withIndexedDb = true) {
  vi.resetModules();
  fake = createFakeIndexedDb();
  if (withIndexedDb) vi.stubGlobal("indexedDB", fake.factory);
  else vi.stubGlobal("indexedDB", undefined);
  store = await import("../src/recorder/media-store");
  cloud = await import("../src/recorder/round-recording-cloud");
}

function manifest(keys: string[]): RoundRecordingManifest {
  return {
    version: 1,
    roundId: "round 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    durationSeconds: 60,
    speeches: keys.map((key, index) => ({ key, start: index * 30, duration: 30 }) as RoundRecordingManifest["speeches"][number]),
    processing: { announcements: false, captions: true, moonshine: false },
    videos: [],
  };
}

beforeEach(async () => {
  localStorage.clear();
  await load();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("media store", () => {
  it("puts, gets and deletes blobs by key", async () => {
    await store.putMedia(store.roundAudioKey("r1"), "mp3-bytes");
    expect(await store.getMedia<string>("round-audio:r1")).toBe("mp3-bytes");
    expect(store.roundCaptionsKey("r1")).toBe("round-captions:r1");
    await store.deleteMedia("round-audio:r1");
    expect(await store.getMedia("round-audio:r1")).toBeNull();
  });

  it("resolves to null when a request fails", async () => {
    await store.putMedia("k", "v");
    fake.failNext();
    expect(await store.getMedia("k")).toBeNull();
  });

  it("resolves to null without IndexedDB", async () => {
    await load(false);
    expect(await store.putMedia("k", "v")).toBeNull();
    expect(await store.getMedia("k")).toBeNull();
  });

  it("indexes clips and replaces a participant's earlier clip for a speech", async () => {
    const saved = vi.fn();
    window.addEventListener(store.VIDEO_CLIP_SAVED_EVENT, saved);
    const first = await store.saveClip("1AC", "alice", new Blob(["a"]));
    await store.saveClip("1AC", "bob", new Blob(["b"]));
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1000);
    const replacement = await store.saveClip("1AC", "alice", new Blob(["c"]));

    const clips = store.listClips();
    expect(clips.map((clip) => clip.participant)).toEqual(["bob", "alice"]);
    expect(clips[1].id).toBe(replacement.id);
    expect(await store.getMedia(store.clipKey(first.id))).toBeNull();
    expect(saved).toHaveBeenCalledTimes(3);
    window.removeEventListener(store.VIDEO_CLIP_SAVED_EVENT, saved);
  });

  it("ignores a corrupt or malformed clip index", () => {
    localStorage.setItem("debate-video-clips", "{nope");
    expect(store.listClips()).toEqual([]);
    localStorage.setItem("debate-video-clips", JSON.stringify([{ id: 1 }, null, { id: "a", speechKey: "1AC" }]));
    expect(store.listClips()).toEqual([{ id: "a", speechKey: "1AC" }]);
    localStorage.setItem("debate-video-clips", JSON.stringify({}));
    expect(store.listClips()).toEqual([]);
  });

  it("reads and writes the record-video setting", () => {
    const changed = vi.fn();
    window.addEventListener(store.RECORD_VIDEO_EVENT, changed);
    expect(store.readRecordVideo()).toBe(false);
    store.writeRecordVideo(true);
    expect(store.readRecordVideo()).toBe(true);
    store.writeRecordVideo(false);
    expect(store.readRecordVideo()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
    window.removeEventListener(store.RECORD_VIDEO_EVENT, changed);
  });
});

describe("round recording upload", () => {
  it("sanitizes file names and builds file links", () => {
    expect(cloud.safeFileName("video 1AC/alice?.webm")).toBe("video-1AC-alice-.webm");
    expect(cloud.safeFileName("///")).toBe("file");
    expect(cloud.safeFileName("x".repeat(200))).toHaveLength(120);
    expect(cloud.roundFileUrl("rounds/a b.mp3")).toBe("/api/round-recordings/file?key=rounds%2Fa%20b.mp3");
  });

  it("uploads one file and surfaces server errors", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ key: "u/r/round.mp3" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await cloud.uploadRoundFile("round 1", "round.mp3", "x", "audio/mpeg")).toBe("u/r/round.mp3");
    expect(fetchMock).toHaveBeenCalledWith("/api/round-recordings?roundId=round%201&name=round.mp3", {
      method: "PUT",
      headers: { "Content-Type": "audio/mpeg" },
      body: "x",
    });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Too large" }), { status: 413 }));
    await expect(cloud.uploadRoundFile("r", "a", "x", "text/plain")).rejects.toThrow("Too large");
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 500 }));
    await expect(cloud.uploadRoundFile("r", "a", "x", "text/plain")).rejects.toThrow("Upload failed (500).");
  });

  it("uploads the audio, captions, this round's clips and the manifest", async () => {
    await store.saveClip("1AC", "alice", new Blob(["video"], { type: "video/webm" }));
    await store.saveClip("other-round", "alice", new Blob(["skip"]));
    const missing = await store.saveClip("1NC", "bob", new Blob(["gone"]));
    await store.deleteMedia(store.clipKey(missing.id));

    const names: string[] = [];
    const bodies: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const name = new URL(url, "https://site.test").searchParams.get("name")!;
        names.push(name);
        bodies[name] = init.body;
        return new Response(JSON.stringify({ key: `k/${name}` }), { status: 200 });
      }),
    );
    const progress: number[] = [];
    const result = await cloud.uploadRoundRecording(manifest(["1AC", "1NC"]), new Blob(["mp3"]), "WEBVTT", (f) => progress.push(f));

    expect(names).toEqual(["round.mp3", "captions.vtt", "video-1AC-alice.webm", "manifest.json"]);
    expect(progress).toEqual([0.2, 0.4, 0.6, 0.8, 1]);
    expect(result.remote).toEqual({ audio: "k/round.mp3", captions: "k/captions.vtt", manifest: "k/manifest.json" });
    expect(result.videos).toEqual([expect.objectContaining({ speechKey: "1AC", participant: "alice", remoteKey: "k/video-1AC-alice.webm" })]);
    expect(JSON.parse(bodies["manifest.json"] as string).remote).toEqual({ audio: "k/round.mp3", captions: "k/captions.vtt" });
  });

  it("skips captions when there are none", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ key: "k" }), { status: 200 })));
    const result = await cloud.uploadRoundRecording(manifest(["1AC"]), new Blob(["mp3"]), null);
    expect(result.remote).toEqual({ audio: "k", captions: undefined, manifest: "k" });
    expect(result.videos).toEqual([]);
  });
});
