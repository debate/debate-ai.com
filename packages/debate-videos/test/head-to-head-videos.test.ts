import { describe, expect, it } from "vitest"
import { videoMatchesGroups } from "../src/panels/HeadToHeadVideos"
import type { VideoType } from "../src/types/videos"

function video(over: Partial<{ title: string; aff: string | null; neg: string | null }> = {}): VideoType {
  return [
    "id1",
    over.title ?? "Round",
    "2025-01-01",
    "Channel",
    0,
    "",
    1,
    "Kentucky",
    "Finals",
    over.aff === undefined ? "Emory GY" : over.aff,
    over.neg === undefined ? "Michigan ES" : over.neg,
  ]
}

describe("videoMatchesGroups", () => {
  it("requires each team on a different side for a pairing", () => {
    const groups = [["emory gy"], ["michigan es"]]
    expect(videoMatchesGroups(video(), groups)).toBe(true)
    expect(videoMatchesGroups(video({ aff: "Michigan ES", neg: "Emory GY" }), groups)).toBe(true)
    expect(videoMatchesGroups(video({ aff: "Emory GY", neg: "Kansas BT" }), groups)).toBe(false)
    expect(videoMatchesGroups(video({ aff: "Emory GY", neg: "Emory Other" }), groups)).toBe(false)
  })

  it("falls back to the title when no teams are tagged", () => {
    const groups = [["emory gy"], ["michigan es"]]
    expect(
      videoMatchesGroups(video({ aff: null, neg: null, title: "Emory GY vs Michigan ES Finals" }), groups),
    ).toBe(true)
    expect(
      videoMatchesGroups(video({ aff: null, neg: null, title: "Emory GY Finals" }), groups),
    ).toBe(false)
  })
})
