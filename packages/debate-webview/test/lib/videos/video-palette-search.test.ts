/**
 * @fileoverview Ctrl/Cmd-K's video rows: how a library tuple reads in the
 * palette, and the one small `/api/videos` page each query asks for.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import type { VideoType } from "@debate/types"

import { PALETTE_VIDEO_LIMIT, fetchPaletteVideos, toPaletteVideo } from "../../../src/lib/videos/video-palette-search"

const ROUND: VideoType = ["abc123", "NDT Finals 2022", "2022-04-01T00:00:00Z", "Debate Vids", 900, "", 4, "NDT", "Finals", "Dartmouth SV", "Michigan PR"]
const LECTURE: VideoType = ["xyz789", "How to Flow", "2024-09-01T00:00:00Z", "Coach Channel", 50, "", "lectures_basics"]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("toPaletteVideo", () => {
  it("describes a round by tournament, round and teams, and links its watch page", () => {
    const row = toPaletteVideo(ROUND)
    expect(row).toMatchObject({ id: "abc123", title: "NDT Finals 2022", kind: "round", detail: "NDT · Finals · Dartmouth SV vs Michigan PR" })
    expect(row.href.startsWith("/videos/")).toBe(true)
  })

  it("describes a lecture by its channel", () => {
    expect(toPaletteVideo(LECTURE)).toMatchObject({ kind: "lecture", detail: "Coach Channel" })
  })

  it("falls back to the channel for an untagged round", () => {
    const untagged: VideoType = ["r1", "Some Round", "2023-01-01", "Uploader", 1, "", 2]
    expect(toPaletteVideo(untagged)).toMatchObject({ kind: "round", detail: "Uploader" })
  })
})

describe("fetchPaletteVideos", () => {
  it("asks the video feed for one small page matching the query", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ videos: [ROUND, LECTURE] })))
    vi.stubGlobal("fetch", fetchMock)
    const rows = await fetchPaletteVideos("flow basics")
    expect(rows.map((r) => r.id)).toEqual(["abc123", "xyz789"])
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]), "https://x")
    expect(url.pathname).toBe("/api/videos")
    expect(url.searchParams.get("q")).toBe("flow basics")
    expect(url.searchParams.get("limit")).toBe(String(PALETTE_VIDEO_LIMIT))
  })

  it("rejects on a server error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })))
    await expect(fetchPaletteVideos("x")).rejects.toThrow()
  })
})
