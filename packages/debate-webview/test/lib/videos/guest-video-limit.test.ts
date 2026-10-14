/**
 * @fileoverview Covers the guest video limit: distinct videos count once,
 * re-watching is never blocked, the eleventh new video is, and broken storage
 * never throws.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  GUEST_VIDEOS_KEY,
  GUEST_VIDEO_LIMIT,
  admitGuestVideo,
  readGuestVideos,
} from "../../../src/lib/videos/guest-video-limit"

/** A minimal localStorage, since these tests run in the node environment. */
function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  })
  return store
}

describe("guest video limit", () => {
  beforeEach(() => {
    installLocalStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("admits up to the limit of distinct videos, then blocks a new one", () => {
    for (let i = 0; i < GUEST_VIDEO_LIMIT; i++) expect(admitGuestVideo(`v${i}`)).toBe(true)
    expect(readGuestVideos()).toHaveLength(GUEST_VIDEO_LIMIT)
    expect(admitGuestVideo("one-more")).toBe(false)
    expect(readGuestVideos()).not.toContain("one-more")
  })

  it("never counts or blocks a video already watched", () => {
    expect(admitGuestVideo("same")).toBe(true)
    expect(admitGuestVideo("same")).toBe(true)
    expect(readGuestVideos()).toEqual(["same"])
    for (let i = 1; i < GUEST_VIDEO_LIMIT; i++) admitGuestVideo(`v${i}`)
    expect(admitGuestVideo("same")).toBe(true)
  })

  it("ignores a corrupt stored value", () => {
    localStorage.setItem(GUEST_VIDEOS_KEY, "{not json")
    expect(readGuestVideos()).toEqual([])
    expect(admitGuestVideo("a")).toBe(true)
  })
})

describe("guest video limit without storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lets the video play when localStorage is missing or throws", () => {
    expect(admitGuestVideo("a")).toBe(true)
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("denied")
      },
    })
    expect(admitGuestVideo("b")).toBe(true)
  })
})
