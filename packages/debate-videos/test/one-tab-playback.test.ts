// @vitest-environment jsdom
/**
 * @fileoverview Only one browser tab plays a video at a time: the playing tab
 * keeps its claim, a newly opened tab loads paused, and pressing play in one
 * tab pauses the others.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  PLAYBACK_TAB_ID,
  anotherTabIsPlaying,
  claimPlayback,
  mayAutoplayInThisTab,
  onOtherTabPlaying,
  releasePlayback,
} from "../src/state/oneTabPlayback"
import { useVideoPlayerStore } from "../src/state/videoPlayerStore"

const OWNER_KEY = "video-playback-owner"

function otherTabOwns(at = Date.now()) {
  localStorage.setItem(OWNER_KEY, JSON.stringify({ tabId: "other-tab", at }))
}

function setUserActivation(hasBeenActive: boolean | undefined) {
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: hasBeenActive === undefined ? undefined : { hasBeenActive },
  })
}

beforeEach(() => {
  localStorage.clear()
  setUserActivation(false)
})

afterEach(() => {
  setUserActivation(undefined)
})

describe("anotherTabIsPlaying", () => {
  it("is false when no tab has claimed playback", () => {
    expect(anotherTabIsPlaying()).toBe(false)
  })

  it("is true while another tab's claim is fresh", () => {
    otherTabOwns()
    expect(anotherTabIsPlaying()).toBe(true)
  })

  it("ignores a stale claim from a tab that stopped refreshing it", () => {
    otherTabOwns(Date.now() - 10_000)
    expect(anotherTabIsPlaying()).toBe(false)
  })

  it("ignores this tab's own claim", () => {
    claimPlayback()
    expect(JSON.parse(localStorage.getItem(OWNER_KEY)!).tabId).toBe(PLAYBACK_TAB_ID)
    expect(anotherTabIsPlaying()).toBe(false)
  })
})

describe("releasePlayback", () => {
  it("clears this tab's claim", () => {
    claimPlayback()
    releasePlayback()
    expect(localStorage.getItem(OWNER_KEY)).toBeNull()
  })

  it("leaves another tab's claim alone", () => {
    otherTabOwns()
    releasePlayback()
    expect(anotherTabIsPlaying()).toBe(true)
  })
})

describe("mayAutoplayInThisTab", () => {
  it("autoplays when nothing else is playing", () => {
    expect(mayAutoplayInThisTab()).toBe(true)
  })

  it("holds a freshly opened tab while another tab plays", () => {
    otherTabOwns()
    expect(mayAutoplayInThisTab()).toBe(false)
  })

  it("lets a video the reader picked in this tab take over", () => {
    otherTabOwns()
    setUserActivation(true)
    expect(mayAutoplayInThisTab()).toBe(true)
  })
})

describe("onOtherTabPlaying", () => {
  it("fires when another tab announces it started playing, not for this tab", async () => {
    const onPlaying = vi.fn()
    const unsubscribe = onOtherTabPlaying(onPlaying)
    const otherTab = new BroadcastChannel("debate-video-playback")
    otherTab.postMessage({ type: "playing", tabId: "other-tab" })
    otherTab.postMessage({ type: "playing", tabId: PLAYBACK_TAB_ID })
    await vi.waitFor(() => expect(onPlaying).toHaveBeenCalledTimes(1))
    unsubscribe()
    otherTab.close()
  })
})

describe("videoPlayerStore autoplay", () => {
  it("loads a video paused when asked not to autoplay", () => {
    useVideoPlayerStore.getState().setActiveVideo("abc", "Round", undefined, 0, { autoplay: false })
    const state = useVideoPlayerStore.getState()
    expect(state.autoplay).toBe(false)
    expect(state.isPlaying).toBe(false)
  })

  it("plays a picked video by default", () => {
    useVideoPlayerStore.getState().setActiveVideo("def", "Round", undefined, 0)
    const state = useVideoPlayerStore.getState()
    expect(state.autoplay).toBe(true)
    expect(state.isPlaying).toBe(true)
  })

  it("restores a saved video paused when another tab plays", () => {
    useVideoPlayerStore.getState().restoreVideo("ghi", "Round", null, {
      isMinimized: false,
      playbackRate: 1,
      queue: [],
      savedTime: 30,
      autoplay: false,
    })
    const state = useVideoPlayerStore.getState()
    expect(state.isPlaying).toBe(false)
    expect(state.autoplay).toBe(false)
  })
})
