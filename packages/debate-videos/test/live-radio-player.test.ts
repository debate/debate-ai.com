/**
 * @fileoverview The live round radio player: segments play back to back (the
 * next one preloaded in the second audio element), a live stream waits at
 * the live edge and resumes when new audio arrives, a replay finishes, and a
 * broken segment is skipped.
 */

import { describe, expect, it } from "vitest"

import { LiveRadioPlayer, type AudioLike, type LiveRadioSnapshot } from "../src/components/videos/live/live-radio-player"
import type { LiveSegment } from "@debate-ai/timer/src/recorder/live-radio"

class FakeAudio implements AudioLike {
  src = ""
  preload = ""
  paused = true
  private listeners: Record<string, Array<() => void>> = {}
  play() {
    this.paused = false
    return Promise.resolve()
  }
  pause() {
    this.paused = true
  }
  addEventListener(type: string, fn: () => void) {
    ;(this.listeners[type] ??= []).push(fn)
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn)
  }
  fire(type: "ended" | "error") {
    if (type === "ended") this.paused = true
    for (const fn of this.listeners[type] ?? []) fn()
  }
}

const seg = (seq: number, speech: string): LiveSegment => ({ seq, speech, durationMs: 5000, createdAt: "" })

function setup(live: boolean, segments: LiveSegment[]) {
  const audios: FakeAudio[] = []
  const changes: LiveRadioSnapshot[] = []
  const player = new LiveRadioPlayer({
    streamId: "s",
    createAudio: () => {
      const a = new FakeAudio()
      audios.push(a)
      return a
    },
    onChange: (s) => changes.push(s),
    segmentUrl: (_id, seq) => `seg-${seq}`,
  })
  player.setLive(live)
  player.addSegments(segments)
  const playing = () => audios.find((a) => !a.paused)
  return { player, audios, changes, playing }
}

describe("LiveRadioPlayer", () => {
  it("plays a replay from the top, back to back, then finishes", () => {
    const { player, playing } = setup(false, [seg(0, "1AC"), seg(1, "1AC"), seg(2, "CX")])
    player.play()
    expect(playing()?.src).toBe("seg-0")
    expect(player.snapshot).toEqual({ state: "playing", seq: 0, speech: "1AC" })

    // The next segment is already loading in the other element.
    const first = playing()!
    playing()!.fire("ended")
    expect(playing()?.src).toBe("seg-1")
    expect(playing()).not.toBe(first)

    playing()!.fire("ended")
    expect(player.snapshot.speech).toBe("CX")
    playing()!.fire("ended")
    expect(player.snapshot.state).toBe("finished")
  })

  it("joins a live stream at the start of the current speech and waits at the live edge", () => {
    const { player, playing } = setup(true, [seg(0, "1AC"), seg(1, "1NC"), seg(2, "1NC")])
    player.play()
    expect(player.snapshot.seq).toBe(1)
    playing()!.fire("ended")
    playing()!.fire("ended")
    expect(player.snapshot.state).toBe("waiting")

    player.addSegments([seg(3, "1NC")])
    expect(player.snapshot).toEqual({ state: "playing", seq: 3, speech: "1NC" })
    expect(playing()?.src).toBe("seg-3")
  })

  it("finishes when a waiting stream goes off air", () => {
    const { player, playing } = setup(true, [seg(0, "1AC")])
    player.play()
    playing()!.fire("ended")
    expect(player.snapshot.state).toBe("waiting")
    player.setLive(false)
    expect(player.snapshot.state).toBe("finished")
  })

  it("waits for the first speech of a stream with no audio yet", () => {
    const { player, playing } = setup(true, [])
    player.play()
    expect(player.snapshot.state).toBe("waiting")
    player.addSegments([seg(0, "1AC")])
    expect(playing()?.src).toBe("seg-0")
  })

  it("skips a segment that fails to load, but not for a failed preload", () => {
    const { player, audios, playing } = setup(false, [seg(0, "1AC"), seg(1, "1AC"), seg(2, "1AC")])
    player.play()
    const idle = audios.find((a) => a.paused)!
    idle.fire("error") // the preload of seg-1 failed
    expect(player.snapshot.seq).toBe(0)
    playing()!.fire("error") // seg-0 itself failed
    expect(player.snapshot.seq).toBe(1)
    expect(playing()?.src).toBe("seg-1")
  })

  it("pauses, resumes, jumps to a speech and goes live", () => {
    const { player, playing } = setup(true, [seg(0, "1AC"), seg(1, "1AC"), seg(2, "1NC")])
    player.play()
    player.pause()
    expect(player.snapshot.state).toBe("paused")
    expect(playing()).toBeUndefined()
    player.play()
    expect(player.snapshot).toEqual({ state: "playing", seq: 2, speech: "1NC" })
    player.jumpTo(0)
    expect(playing()?.src).toBe("seg-0")
    player.jumpTo(99)
    expect(player.snapshot.seq).toBe(0)
    player.goLive()
    expect(player.snapshot.seq).toBe(2)
    player.destroy()
  })
})
