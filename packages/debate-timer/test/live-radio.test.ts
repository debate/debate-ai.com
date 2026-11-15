/**
 * @fileoverview The live round radio protocol: stream ids from round slugs,
 * where a listener tunes in, and the segmented recorder + ordered upload
 * queue the broadcaster relies on (each segment must decode on its own and
 * reach the server in the order it was spoken).
 */

import { describe, expect, it, vi } from "vitest"

import {
  SegmentUploadQueue,
  SegmentedRecorder,
  formatBroadcastLength,
  isLiveStreamId,
  liveSegmentUrl,
  liveStreamIdForSlug,
  pickLiveMimeType,
  pickTuneInSeq,
  speechChapters,
  uploadLiveSegment,
  type LiveSegment,
  type SegmentRecorderLike,
} from "../src/recorder/live-radio"

const seg = (seq: number, speech: string): LiveSegment => ({ seq, speech, durationMs: 5000, createdAt: "" })

describe("liveStreamIdForSlug", () => {
  it("flattens a round slug into one safe id", () => {
    expect(liveStreamIdForSlug("2025-glenbrooks/lynbrook-bz-monta-ey")).toBe("2025-glenbrooks-lynbrook-bz-monta-ey")
    expect(liveStreamIdForSlug("  TOC  /  Octos!! ")).toBe("toc-octos")
    expect(isLiveStreamId("toc-octos")).toBe(true)
  })

  it("has no id for a round without a slug", () => {
    expect(liveStreamIdForSlug("")).toBeNull()
    expect(liveStreamIdForSlug(undefined)).toBeNull()
    expect(liveStreamIdForSlug("///")).toBeNull()
    expect(isLiveStreamId("../etc")).toBe(false)
  })

  it("never ends an id with a dash after trimming to length", () => {
    const id = liveStreamIdForSlug(`${"a".repeat(119)}/b`)!
    expect(id.length).toBeLessThanOrEqual(120)
    expect(id.endsWith("-")).toBe(false)
  })
})

describe("pickTuneInSeq", () => {
  const segments = [seg(0, "1AC"), seg(1, "1AC"), seg(2, "1NC"), seg(3, "1NC"), seg(4, "1NC")]

  it("starts a replay at the top", () => {
    expect(pickTuneInSeq(segments, false)).toBe(0)
  })

  it("starts a live stream at the beginning of the speech being given", () => {
    expect(pickTuneInSeq(segments, true)).toBe(2)
    expect(pickTuneInSeq([seg(7, "2AR")], true)).toBe(7)
    expect(pickTuneInSeq([], true)).toBe(0)
  })
})

describe("speechChapters", () => {
  it("lists each speech's first segment in order, a repeated speech twice", () => {
    expect(speechChapters([seg(0, "1AC"), seg(1, "1AC"), seg(2, "CX"), seg(3, "1AC")])).toEqual([
      { speech: "1AC", seq: 0 },
      { speech: "CX", seq: 2 },
      { speech: "1AC", seq: 3 },
    ])
  })
})

describe("small helpers", () => {
  it("formats broadcast lengths", () => {
    expect(formatBroadcastLength(65_000)).toBe("1:05")
    expect(formatBroadcastLength(3_725_000)).toBe("1:02:05")
    expect(formatBroadcastLength(-5)).toBe("0:00")
  })

  it("builds segment urls", () => {
    expect(liveSegmentUrl("toc-octos", 3)).toBe("/api/live-rounds/segment?id=toc-octos&seq=3")
  })

  it("prefers Opus in WebM, and falls back to the browser default", () => {
    expect(pickLiveMimeType(() => true)).toBe("audio/webm;codecs=opus")
    expect(pickLiveMimeType((t) => t === "audio/mp4")).toBe("audio/mp4")
    expect(pickLiveMimeType(() => false)).toBeUndefined()
    expect(pickLiveMimeType(() => { throw new Error("nope") })).toBeUndefined()
  })
})

class FakeRecorder implements SegmentRecorderLike {
  state = "inactive"
  mimeType = "audio/webm"
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(private readonly label: string) {}
  start() {
    this.state = "recording"
  }
  stop() {
    this.state = "inactive"
    this.ondataavailable?.({ data: new Blob([this.label], { type: "audio/webm" }) })
    this.onstop?.()
  }
}

describe("SegmentedRecorder", () => {
  it("cuts the mic into back-to-back segments and flushes the last on stop", async () => {
    let clock = 0
    const timers: Array<() => void> = []
    const recorders: FakeRecorder[] = []
    const segments: Array<{ blob: Blob; durationMs: number }> = []
    const recorder = new SegmentedRecorder({
      createRecorder: () => {
        const r = new FakeRecorder(`part-${recorders.length}`)
        recorders.push(r)
        return r
      },
      onSegment: (s) => void segments.push(s),
      segmentMs: 5000,
      now: () => clock,
      setTimer: (fn) => timers.push(fn),
      clearTimer: () => timers.splice(0),
    })

    recorder.start()
    expect(recorder.isRunning).toBe(true)
    expect(recorders).toHaveLength(1)

    clock = 5000
    timers.shift()!()
    expect(recorders).toHaveLength(2)
    expect(recorders[0].state).toBe("inactive")
    expect(recorders[1].state).toBe("recording")

    clock = 7000
    recorder.stop()
    expect(recorder.isRunning).toBe(false)
    expect(segments.map((s) => s.durationMs)).toEqual([5000, 2000])
    expect(await Promise.all(segments.map((s) => s.blob.text()))).toEqual(["part-0", "part-1"])

    // Stopping twice, or a stale timer, starts nothing new.
    recorder.stop()
    expect(recorders).toHaveLength(2)
  })
})

describe("SegmentUploadQueue", () => {
  const segment = (speech: string) => ({ blob: new Blob(["x"]), durationMs: 5000, speech })

  it("uploads one at a time, in order", async () => {
    const order: string[] = []
    let release: (() => void) | null = null
    const queue = new SegmentUploadQueue(async (s) => {
      order.push(`start ${s.speech}`)
      if (s.speech === "a") await new Promise<void>((r) => (release = r))
      order.push(`end ${s.speech}`)
    })
    void queue.push(segment("a"))
    void queue.push(segment("b"))
    await new Promise((r) => setTimeout(r, 0))
    expect(order).toEqual(["start a"])
    release!()
    await queue.drain()
    expect(order).toEqual(["start a", "end a", "start b", "end b"])
  })

  it("retries a failed upload twice, then moves on", async () => {
    const upload = vi.fn().mockRejectedValueOnce(new Error("1")).mockRejectedValueOnce(new Error("2")).mockResolvedValue(undefined)
    const queue = new SegmentUploadQueue(upload)
    await queue.push(segment("a"))
    expect(upload).toHaveBeenCalledTimes(3)
    expect(queue.failed).toBe(0)

    const broken = new SegmentUploadQueue(() => Promise.reject(new Error("down")))
    await broken.push(segment("a"))
    expect(broken.failed).toBe(1)
  })
})

describe("uploadLiveSegment", () => {
  it("posts the audio with its speech and length, and returns the server's number", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ seq: 4 }), { status: 201 }))
    const seq = await uploadLiveSegment(
      "toc-octos",
      { blob: new Blob(["x"], { type: "audio/webm;codecs=opus" }), durationMs: 4999.6, speech: "1AC" },
      "/api/live-rounds",
      fetchImpl as unknown as typeof fetch,
    )
    expect(seq).toBe(4)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/live-rounds?id=toc-octos&speech=1AC&durationMs=5000")
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("audio/webm")
  })

  it("throws on a refusal so the queue retries", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "nope" }), { status: 403 }))
    await expect(
      uploadLiveSegment("x", { blob: new Blob(["x"]), durationMs: 1, speech: "1AC" }, undefined, fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow("nope")
  })
})
