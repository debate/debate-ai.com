import { describe, expect, it } from "vitest"
import { shareRecording } from "../src/recorder/SpeechRecordingPlayer"

describe("shareRecording", () => {
  it("resolves with a success message counting the given participants", async () => {
    const result = await shareRecording(["a@example.com", "b@example.com"], "1AC", "data:audio/webm;base64,AAAA")
    expect(result).toEqual({ success: true, message: "Shared with 2 participants" })
  })

  it("uses singular phrasing for exactly one participant", async () => {
    const result = await shareRecording(["a@example.com"], "1AC", "data:audio/webm;base64,AAAA")
    expect(result.message).toBe("Shared with 1 participant")
  })

  it("still resolves successfully with zero participants", async () => {
    const result = await shareRecording([], "1AC", "data:audio/webm;base64,AAAA")
    expect(result).toEqual({ success: true, message: "Shared with 0 participants" })
  })
})
