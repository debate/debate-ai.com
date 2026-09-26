import { describe, expect, it } from "vitest"
import {
  computeSpeechDocWordStats,
  looksLikeHtml,
  speechMarkdownToHtml,
} from "../src/formats/speech-doc-word-stats"

describe("computeSpeechDocWordStats", () => {
  it("returns zeros for empty content", () => {
    expect(computeSpeechDocWordStats("")).toEqual({ total: 0, read: 0, underlined: 0, highlighted: 0 })
    expect(computeSpeechDocWordStats(undefined)).toEqual({ total: 0, read: 0, underlined: 0, highlighted: 0 })
  })

  it("counts every word as read when nothing is highlighted", () => {
    expect(computeSpeechDocWordStats("I affirm the resolution today")).toEqual({
      total: 5,
      read: 5,
      underlined: 0,
      highlighted: 0,
    })
  })

  it("counts a CardMirror card: tag words plus highlighted body words are read", () => {
    const html = [
      '<div class="pmd-card">',
      '<p class="pmd-tag">Warming causes extinction</p>',
      '<p class="pmd-cite-para">Smith 24</p>',
      '<p class="pmd-card-body">Scientists <span class="pmd-underline">agree that <span class="pmd-highlight" data-highlight="yellow">warming is</span> accelerating</span> <span class="pmd-highlight" data-highlight="yellow">fast</span> now</p>',
      "</div>",
    ].join("")
    const stats = computeSpeechDocWordStats(html)
    expect(stats.total).toBe(3 + 2 + 8)
    expect(stats.highlighted).toBe(3) // warming, is, fast
    expect(stats.underlined).toBe(5) // agree, that, warming, is, accelerating
    expect(stats.read).toBe(3 + 3) // tag + highlighted
  })

  it("does not count data-highlight=none as highlighted", () => {
    const html = '<p><span class="pmd-highlight" data-highlight="none">plain words</span> <mark>marked</mark></p>'
    const stats = computeSpeechDocWordStats(html)
    expect(stats.highlighted).toBe(1)
  })

  it("treats <u>, emphasis and inline underline styles as underlined", () => {
    const html = '<p><u>one</u> <span class="pmd-emphasis">two</span> <span style="text-decoration: underline">three</span> four</p>'
    expect(computeSpeechDocWordStats(html).underlined).toBe(3)
  })

  it("does not join words across block boundaries or count punctuation", () => {
    const html = "<p>alpha</p><p>beta — gamma</p>"
    expect(computeSpeechDocWordStats(html).total).toBe(3)
  })

  it("decodes entities", () => {
    expect(computeSpeechDocWordStats("<p>a&nbsp;b &amp; c</p>").total).toBe(3)
  })

  it("handles the markdown speech doc shape", () => {
    const md = "# Contention One\nThe ==economy grows== while **trade** expands\n<u>under line</u> text"
    const stats = computeSpeechDocWordStats(md)
    expect(stats.total).toBe(2 + 6 + 3)
    expect(stats.highlighted).toBe(2)
    expect(stats.underlined).toBe(2)
    // heading (2) + highlighted (2) + bold (1)
    expect(stats.read).toBe(5)
  })
})

describe("speech doc format helpers", () => {
  it("detects HTML vs markdown", () => {
    expect(looksLikeHtml("<p>hi</p>")).toBe(true)
    expect(looksLikeHtml("a < b and c > d")).toBe(false)
    expect(looksLikeHtml("# heading\n==hl==")).toBe(false)
  })

  it("converts headings and highlight marks", () => {
    expect(speechMarkdownToHtml("## Plan\n==x== y")).toBe("<h2>Plan</h2>\n<p><mark>x</mark> y</p>")
  })
})
