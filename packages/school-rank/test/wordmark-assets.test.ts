import { describe, expect, it } from "vitest"
import { WORDMARK_ROWS, getSchool } from "../src/index"
import { wordmarkSrc } from "../src/wordmark-assets"

describe("wordmarkSrc", () => {
  it("resolves every wordmark file to an image URL", () => {
    for (const [file] of WORDMARK_ROWS) expect(wordmarkSrc(file), file).toMatch(/\.png|^data:image/)
  })

  it("takes a school and returns null when it has none", () => {
    expect(wordmarkSrc(getSchool("yale-university-ct"))).toMatch(/yale/)
    expect(wordmarkSrc(getSchool("princeton-university-nj"))).toBeNull()
    expect(wordmarkSrc(null)).toBeNull()
  })
})
