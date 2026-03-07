import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("grab-url", () => {
  const stub = vi.fn()
  stub.instance = vi.fn(() => stub)
  return { default: stub }
})

describe("sync-youtube-rounds", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("throws when the YouTube API key is missing", async () => {
    vi.resetModules()
    vi.stubEnv("YOUTUBE_API_KEY", "")
    const { syncYouTubeVideos } = await import("../lib/third-party-sync/sync-youtube-rounds")

    await expect(syncYouTubeVideos()).rejects.toThrow("YouTube API key not configured")
  })
})
