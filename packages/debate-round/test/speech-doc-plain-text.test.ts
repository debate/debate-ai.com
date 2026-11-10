import { describe, expect, it } from "vitest"
import { detectFallacies } from "@debate-ai/speech-writer/src/analysis/detect-fallacies"
import { speechDocPlainText } from "../src/utils/speech-doc-plain-text"

describe("speechDocPlainText", () => {
  it("returns empty text for missing content", () => {
    expect(speechDocPlainText(null)).toBe("")
    expect(speechDocPlainText(undefined)).toBe("")
    expect(speechDocPlainText("")).toBe("")
  })

  it("strips markdown heading and emphasis markers", () => {
    expect(speechDocPlainText("# Heading\nSome **bold** text")).toBe("Heading\nSome bold text")
  })

  it("drops HTML tags, decodes entities and separates blocks", () => {
    const html = "<h1>Off &amp; On</h1><p>First claim</p><style>p{}</style><p>Second&nbsp;claim</p>"
    expect(speechDocPlainText(html)).toBe("Off & On. First claim. Second claim.")
  })

  it("lets the fallacy detector see phrasing across HTML markup", () => {
    const html = "<p>My opponent is <strong>clueless</strong>.</p>"
    expect(detectFallacies(speechDocPlainText(html)).map((f) => f.kind)).toContain("ad-hominem")
  })
})
