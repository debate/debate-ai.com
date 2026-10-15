import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/database/context", () => ({ getCloudflareContext: () => undefined }))
import {
  isAllowedContentType,
  isOwnRoundFileKey,
  isRoundFileName,
  roundFileKey,
} from "../storage"

describe("round recording keys", () => {
  it("builds a key under the user's own round folder", () => {
    expect(roundFileKey("u1", "1712345", "round.mp3")).toBe("round-recordings/u1/1712345/round.mp3")
  })

  it("rejects round ids and names that could escape the folder", () => {
    expect(roundFileKey("u1", "../u2", "round.mp3")).toBeNull()
    expect(roundFileKey("u1", "1", "../round.mp3")).toBeNull()
    expect(roundFileKey("u1", "1", "a/b.mp3")).toBeNull()
    expect(isRoundFileName(".hidden")).toBe(false)
  })

  it("serves a key only to the user who owns it", () => {
    const key = "round-recordings/u1/1/round.mp3"
    expect(isOwnRoundFileKey(key, "u1")).toBe(true)
    expect(isOwnRoundFileKey(key, "u2")).toBe(false)
    expect(isOwnRoundFileKey("round-recordings/u1/1/x/round.mp3", "u1")).toBe(false)
    expect(isOwnRoundFileKey("db-backups/x.sql.gz", "u1")).toBe(false)
  })

  it("accepts only audio, video, captions and JSON", () => {
    expect(isAllowedContentType("audio/mpeg")).toBe(true)
    expect(isAllowedContentType("video/webm;codecs=vp9,opus")).toBe(true)
    expect(isAllowedContentType("text/vtt")).toBe(true)
    expect(isAllowedContentType("application/json")).toBe(true)
    expect(isAllowedContentType("text/html")).toBe(false)
    expect(isAllowedContentType(null)).toBe(false)
  })
})
