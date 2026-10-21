// @vitest-environment jsdom
/**
 * @fileoverview Tests for `useRoomTimerSync`: a device's play/pause/reset
 * reaches the room once (not on every tick), and another device's update is
 * applied to the local timers without being echoed back.
 *
 * `useTimerSync` (the room socket) is replaced by a fake that records what
 * was broadcast and lets the test deliver updates from other devices; the
 * timers are the real `useTimerState`.
 */

import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, renderHook, run } from "./dom-helpers"

const room = vi.hoisted(() => ({
  sent: [] as Array<{ name: string; state: Record<string, unknown> }>,
  onRemoteTimer: undefined as undefined | ((s: unknown, from: string) => void),
  participants: [] as Array<{ id: string; name: string; role: string }>,
}))

vi.mock("../src/hooks/useTimerSync", () => ({
  useTimerSync: (_roomId: string, _role: string, opts: { onRemoteTimer?: (s: unknown, from: string) => void } = {}) => {
    room.onRemoteTimer = opts.onRemoteTimer
    return {
      remoteTimers: [],
      participants: room.participants,
      broadcastTimerState: (name: string, state: Record<string, unknown>) => room.sent.push({ name, state }),
      sendClarityRequest: vi.fn(),
    }
  },
}))

import { useTimerState } from "../src/hooks/useTimerState"
import { fromWireState, timerSignature, useRoomTimerSync, PREP_AFF_TIMER } from "../src/hooks/useRoomTimerSync"

function useHarness(roomId: string | null) {
  const timers = useTimerState()
  useRoomTimerSync(roomId, timers)
  return timers
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  room.sent = []
  room.participants = []
})

describe("timerSignature / fromWireState", () => {
  it("ignores a running timer's ticks but not its start", () => {
    const running = { time: 100, resetTime: 200, state: { name: "running" as const, startTime: 5 } }
    expect(timerSignature(running)).toBe(timerSignature({ ...running, time: 50 }))
    expect(timerSignature(running)).not.toBe(timerSignature({ ...running, state: { name: "running", startTime: 6 } }))
    const paused = { time: 100, resetTime: 200, state: { name: "paused" as const } }
    expect(timerSignature(paused)).not.toBe(timerSignature({ ...paused, time: 50 }))
  })

  it("rebases a running timer onto this device's clock", () => {
    const remote = { speechName: "1AC", time: 1, resetTime: 2, state: { name: "running" as const, startTime: 1_000 }, timestamp: 1_500 }
    expect(fromWireState(remote, 90_000).state).toEqual({ name: "running", startTime: 89_500 })
    const paused = { ...remote, state: { name: "paused" as const } }
    expect(fromWireState(paused, 90_000)).toEqual({ time: 1, resetTime: 2, state: { name: "paused" } })
  })
})

describe("useRoomTimerSync", () => {
  it("sends play and pause once each, never the ticks, and nothing on first load", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000)
    const hook = await renderHook(() => useHarness("round-1"))
    expect(room.sent).toEqual([])

    await run(() => hook.result.current.setSpeechTimerState("1AC", { state: { name: "running", startTime: 9_000 } }))
    expect(room.sent).toHaveLength(1)
    expect(room.sent[0]).toMatchObject({ name: "1AC", state: { speechName: "1AC", state: { name: "running", startTime: 9_000 } } })

    // Ticks only move `time`.
    await run(() => hook.result.current.setSpeechTimerState("1AC", { time: 470_000 }))
    await run(() => hook.result.current.setSpeechTimerState("1AC", { time: 469_900 }))
    expect(room.sent).toHaveLength(1)

    await run(() => hook.result.current.setSpeechTimerState("1AC", { state: { name: "paused" } }))
    expect(room.sent).toHaveLength(2)
    expect(room.sent[1]).toMatchObject({ name: "1AC", state: { time: 469_900, state: { name: "paused" } } })
  })

  it("applies another device's play/pause without echoing it, and catches up a newcomer", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(20_000)
    room.participants = [{ id: "p1", name: "Judge", role: "judge" }]
    const hook = await renderHook(() => useHarness("round-1"))

    await run(() =>
      room.onRemoteTimer?.(
        { speechName: "2AC", time: 400_000, resetTime: 480_000, state: { name: "running", startTime: 100 }, timestamp: 600 },
        "p1",
      ),
    )
    expect(hook.result.current.perSpeechTimerStates["2AC"]).toEqual({
      time: 400_000,
      resetTime: 480_000,
      state: { name: "running", startTime: 19_500 },
    })
    expect(room.sent).toEqual([])

    now.mockReturnValue(21_000)
    await run(() =>
      room.onRemoteTimer?.({ speechName: PREP_AFF_TIMER, time: 60_000, resetTime: 180_000, state: { name: "paused" }, timestamp: 1 }, "p1"),
    )
    expect(hook.result.current.prepState).toMatchObject({ time: 60_000, state: { name: "paused" } })
    expect(room.sent).toEqual([])

    // A new device joins: it gets the timers the room has used.
    room.participants = [...room.participants, { id: "p2", name: "2N", role: "speaker" }]
    await hook.rerender(undefined as never)
    expect(room.sent.map((s) => s.name).sort()).toEqual(["2AC", PREP_AFF_TIMER])
  })

  it("stays quiet without a round room", async () => {
    const hook = await renderHook(() => useHarness(null))
    await run(() => hook.result.current.setSpeechTimerState("1AC", { state: { name: "running", startTime: 1 } }))
    expect(room.sent).toEqual([])
  })
})
