/** @vitest-environment jsdom */
/**
 * @fileoverview `useLiveRadio` loads a live round stream, polls for newly
 * recorded segments while it is live, stops once it ends, reports an
 * unavailable stream, and hands its play controls to the radio player.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { LiveRoundDetail, LiveRoundSummary, LiveSegment } from "@debate-ai/timer/src/recorder/live-radio"

const fetchLiveRound = vi.hoisted(() => vi.fn())

vi.mock("@debate-ai/timer/src/recorder/live-radio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/timer/src/recorder/live-radio")>()),
  fetchLiveRound,
}))

const { LIVE_POLL_MS, useLiveRadio } = await import("../src/components/videos/live/useLiveRadio")
const { flush, renderHook } = await import("./helpers/mount")

class FakeAudio {
  src = ""
  preload = ""
  paused = true
  play = vi.fn(() => {
    this.paused = false
    return Promise.resolve()
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  addEventListener() {}
  removeEventListener() {}
}

const seg = (seq: number, speech = "1AC"): LiveSegment => ({ seq, speech, durationMs: 5000, createdAt: "" })

function detail(status: "live" | "ended", segments: LiveSegment[]): LiveRoundDetail {
  const stream = { id: "stream-1", status, segmentCount: segments.length } as unknown as LiveRoundSummary
  return { stream, segments }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("Audio", FakeAudio)
  fetchLiveRound.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("useLiveRadio", () => {
  it("loads the stream and its segments, and polls again while live", async () => {
    fetchLiveRound
      .mockResolvedValueOnce(detail("live", [seg(0), seg(1)]))
      .mockResolvedValueOnce(detail("live", [seg(1), seg(2, "1NC")]))
      .mockResolvedValue(detail("live", []))
    const hook = await renderHook(() => useLiveRadio("stream-1"))
    await flush()

    expect(fetchLiveRound).toHaveBeenNthCalledWith(1, "stream-1", -1)
    expect(hook.result.current.loading).toBe(false)
    expect(hook.result.current.stream?.status).toBe("live")
    expect(hook.result.current.segments.map((s) => s.seq)).toEqual([0, 1])

    await flush(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS))
    expect(fetchLiveRound).toHaveBeenNthCalledWith(2, "stream-1", 1)
    expect(hook.result.current.segments.map((s) => s.seq)).toEqual([0, 1, 2])

    await hook.unmount()
    const calls = fetchLiveRound.mock.calls.length
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 3)
    expect(fetchLiveRound).toHaveBeenCalledTimes(calls)
  })

  it("stops polling once the stream has ended", async () => {
    fetchLiveRound.mockResolvedValue(detail("ended", [seg(0)]))
    const hook = await renderHook(() => useLiveRadio("stream-1"))
    await flush()
    await flush(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 3))
    expect(fetchLiveRound).toHaveBeenCalledTimes(1)
    expect(hook.result.current.stream?.status).toBe("ended")
    await hook.unmount()
  })

  it("reports a stream that cannot be read", async () => {
    fetchLiveRound.mockResolvedValue(null)
    const hook = await renderHook(() => useLiveRadio("missing"))
    await flush()
    expect(hook.result.current.loading).toBe(false)
    expect(hook.result.current.error).toMatch(/isn't available/)
    await flush(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 2))
    expect(fetchLiveRound).toHaveBeenCalledTimes(1)
    await hook.unmount()
  })

  it("keeps polling through a failed read once a segment has been heard", async () => {
    fetchLiveRound
      .mockResolvedValueOnce(detail("live", [seg(0)]))
      .mockResolvedValueOnce(null)
      .mockResolvedValue(detail("live", [seg(1)]))
    const hook = await renderHook(() => useLiveRadio("stream-1"))
    await flush()
    await flush(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS))
    expect(hook.result.current.error).toBeNull()
    await flush(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS))
    expect(hook.result.current.segments.map((s) => s.seq)).toEqual([0, 1])
    await hook.unmount()
  })

  it("drives the player: play starts the tuned-in speech, pause and jumpTo follow", async () => {
    fetchLiveRound.mockResolvedValue(detail("ended", [seg(0, "1AC"), seg(1, "1NC")]))
    const hook = await renderHook(() => useLiveRadio("stream-1"))
    await flush()
    expect(hook.result.current.playback.state).toBe("idle")

    await flush(() => hook.result.current.play())
    expect(hook.result.current.playback.state).toBe("playing")

    await flush(() => hook.result.current.jumpTo(1))
    expect(hook.result.current.playback.seq).toBe(1)
    expect(hook.result.current.playback.speech).toBe("1NC")

    await flush(() => hook.result.current.pause())
    expect(hook.result.current.playback.state).toBe("paused")

    await flush(() => hook.result.current.goLive())
    expect(hook.result.current.playback.state).toBe("playing")
    await hook.unmount()
  })
})
