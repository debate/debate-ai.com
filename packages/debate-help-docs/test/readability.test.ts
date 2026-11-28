import { describe, expect, it } from "vitest"
import {
  countSyllables,
  MIN_WORDS,
  readability,
  readabilityBand,
} from "../lib/fumadocs/readability"
import { pageStats, readableProse } from "../lib/fumadocs/page-stats"

const SAMPLE =
  "Playing games has always been thought to be important to the development of well-balanced and creative children; however, what part, if any, they should play in the lives of adults has never been researched that deeply. I believe that playing games is every bit as important for adults as for children. Not only is taking time out to play games with our children and other adults valuable to building interpersonal relationships but is also a wonderful way to release built up tension."

describe("countSyllables", () => {
  it.each([
    ["the", 1],
    ["games", 1],
    ["always", 2],
    ["table", 2],
    ["little", 2],
    ["created", 2],
    ["important", 3],
    ["development", 4],
    ["interpersonal", 5],
    ["relationships", 3],
    ["tension", 2],
  ])("%s has %i syllables", (word, expected) => {
    expect(countSyllables(word)).toBe(expected)
  })
})

describe("readability", () => {
  const result = readability(SAMPLE)

  it("counts words and sentences of the prose", () => {
    expect(result.words).toBe(82)
    expect(result.sentences).toBe(3)
    expect(result.syllables).toBeGreaterThan(110)
    expect(result.syllables).toBeLessThan(140)
  })

  it("scores the sample as a difficult adult text, in a sane range", () => {
    expect(result.fleschReadingEase).toBeGreaterThan(35)
    expect(result.fleschReadingEase).toBeLessThan(65)
    expect(result.score).toBe(Math.round(result.fleschReadingEase!))
  })

  it("agrees with the Flesch Reading Ease formula on the counted totals", () => {
    const { words, sentences, syllables, fleschReadingEase } = result
    const r1 = (n: number) => Math.round(n * 10) / 10
    expect(fleschReadingEase).toBe(r1(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)))
  })

  it("scores plain short sentences as easy", () => {
    const easy = readability("The cat sat on the mat. The dog ran to the park. We like to play. It is a sunny day.")
    expect(easy.score).toBeGreaterThan(90)
    expect(easy.band).toBe("Very easy")
  })

  it("clamps the headline score to 0-100", () => {
    const dense = readability(
      "Notwithstanding institutionalization's incontrovertible interconnectedness, characteristically incomprehensible epistemological reconceptualizations proliferate indefinitely.",
    )
    expect(dense.fleschReadingEase!).toBeLessThan(0)
    expect(dense.score).toBe(0)
    expect(dense.band).toBe("Very difficult")
  })

  it("returns nulls, never NaN, for empty or very short text", () => {
    for (const text of ["", "   ", "One word.", "Too short to score."]) {
      const short = readability(text)
      expect(short.words).toBeLessThan(MIN_WORDS)
      expect(short.score).toBeNull()
      expect(short.band).toBeNull()
      expect(short.fleschReadingEase).toBeNull()
    }
  })

  it("does not split sentences on abbreviations or decimals", () => {
    const text = "Studies, e.g. Smith et al. found a rise of 3.5 percent in scores across many schools. Teachers noted the change."
    expect(readability(text).sentences).toBe(2)
  })
})

describe("readabilityBand", () => {
  it.each([
    [100, "Very easy"],
    [90, "Very easy"],
    [89, "Easy"],
    [80, "Easy"],
    [79, "Fairly easy"],
    [70, "Fairly easy"],
    [69, "Standard"],
    [62, "Standard"],
    [60, "Standard"],
    [59, "Fairly difficult"],
    [50, "Fairly difficult"],
    [49, "Difficult"],
    [30, "Difficult"],
    [29, "Very difficult"],
    [0, "Very difficult"],
  ])("%i is %s", (score, band) => {
    expect(readabilityBand(score)).toBe(band)
  })
})

describe("readableProse", () => {
  const markdown = `---
title: Sample
---

import { Card } from 'fumadocs-ui/components/card';

## 1. First section

Debaters ==read the marked words== of a card, as Shanahan (1993) argues. See [the guide](/docs/learn) now.

![A figure](https://example.com/a.png)

\`\`\`ts
const notProse = "code"
\`\`\`

| a | b |
| --- | --- |

The evidence (Alinsky 1971, 66; Hitchens 1999) is clear.[^1]
`

  it("keeps running prose and drops frontmatter, headings, code, tables, URLs and citations", () => {
    const prose = readableProse(markdown)
    expect(prose).toContain("Debaters read the marked words of a card")
    expect(prose).toContain("See the guide now.")
    expect(prose).not.toMatch(/First section|title:|import|notProse|example\.com|docs\/learn|Alinsky|Hitchens|\[\^1\]|==/)
  })

  it("feeds pageStats' readability", () => {
    expect(pageStats(markdown).readability.words).toBeLessThan(25)
    expect(pageStats(`${SAMPLE}\n`).readability.score).not.toBeNull()
    expect(pageStats("").readability.score).toBeNull()
  })
})
