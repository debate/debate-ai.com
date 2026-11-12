import { describe, expect, it } from "vitest"
import { PRODUCTION_AMPLITUDE_API_KEY, resolveAmplitudeKey } from "../key"

describe("resolveAmplitudeKey", () => {
  it("prefers the build-time key", () => {
    expect(resolveAmplitudeKey("abc", "localhost")).toBe("abc")
    expect(resolveAmplitudeKey("abc", "debate-ai.com")).toBe("abc")
  })

  it("falls back to the public project key on production hosts", () => {
    expect(resolveAmplitudeKey(undefined, "debate-ai.com")).toBe(PRODUCTION_AMPLITUDE_API_KEY)
    expect(resolveAmplitudeKey("", "d.ebate.app")).toBe(PRODUCTION_AMPLITUDE_API_KEY)
  })

  it("sends nothing from dev or preview hosts without a key", () => {
    expect(resolveAmplitudeKey(undefined, "localhost")).toBeNull()
    expect(resolveAmplitudeKey(undefined, "preview.debate-ai.workers.dev")).toBeNull()
  })
})
