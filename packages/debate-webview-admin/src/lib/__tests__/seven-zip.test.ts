import { describe, expect, it } from "vitest"
import { crc32 } from "../src/lib/seven-zip"

describe("crc32", () => {
  it("returns 0 for empty input", () => {
    expect(crc32(new Uint8Array([]))).toBe(0)
  })

  it("returns a stable value for known input", () => {
    const bytes = new TextEncoder().encode("hello world")
    expect(crc32(bytes)).toBe(0x0d4a1185 >>> 0)
  })

  it("is chainable via the seed parameter", () => {
    const bytes = new TextEncoder().encode("hello world")
    const first = crc32(bytes)
    const chained = crc32(new Uint8Array([]), first)
    expect(chained).toBe(first)
  })

  it("produces different values for different inputs", () => {
    expect(crc32(new TextEncoder().encode("hello"))).not.toBe(
      crc32(new TextEncoder().encode("world")),
    )
  })
})