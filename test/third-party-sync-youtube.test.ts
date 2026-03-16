import { afterEach, describe, expect, it, vi } from "vitest"

vi.stubGlobal('fetch', vi.fn())

describe("sync-youtube-rounds", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("throws when the YouTube API key is missing", async () => {
    vi.resetModules()
    vi.stubEnv("YOUTUBE_API_KEY", "")
    const { syncYouTubeVideos } = await import("../lib/sync-debate-rankings/sync-youtube-rounds")

    await expect(syncYouTubeVideos()).rejects.toThrow("YouTube API key not configured")
  })
})
