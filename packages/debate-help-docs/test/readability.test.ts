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
    const s = result.scores
    expect(s.fleschReadingEase).toBeGreaterThan(35)
    expect(s.fleschReadingEase).toBeLessThan(65)
    for (const grade of [s.fleschKincaidGrade, s.gunningFog, s.smog, s.automatedReadability, s.colemanLiau, s.linsearWrite]) {
      expect(grade).toBeGreaterThan(8)
      expect(grade).toBeLessThan(20)
    }
    expect(result.textStandard).toBeGreaterThanOrEqual(11)
    expect(result.textStandard).toBeLessThanOrEqual(15)
    expect(result.score).toBe(Math.round(s.fleschReadingEase!))
  })

  it("agrees with the textstat formulas on the counted totals", () => {
    const { words, sentences, syllables, polysyllables, letters, scores } = result
    const r1 = (n: number) => Math.round(n * 10) / 10
    expect(scores.fleschReadingEase).toBe(r1(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)))
    expect(scores.fleschKincaidGrade).toBe(r1(0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59))
    expect(scores.gunningFog).toBe(r1(0.4 * (words / sentences + (100 * polysyllables) / words)))
    expect(scores.smog).toBe(r1(1.043 * Math.sqrt(polysyllables * (30 / sentences)) + 3.1291))
    expect(scores.automatedReadability).toBe(r1(4.71 * (letters / words) + 0.5 * (words / sentences) - 21.43))
    expect(scores.colemanLiau).toBe(r1(0.0588 * (letters / words) * 100 - 0.296 * (sentences / words) * 100 - 15.8))
  })

  it("scores plain short sentences as easy", () => {
    const easy = readability("The cat sat on the mat. The dog ran to the park. We like to play. It is a sunny day.")
    expect(easy.score).toBeGreaterThan(90)
    expect(easy.band).toBe("Very Easy")
    expect(easy.scores.fleschKincaidGrade!).toBeLessThan(3)
    expect(easy.textStandard).toBeLessThanOrEqual(5)
  })

  it("clamps the headline score to 0-100", () => {
    const dense = readability(
      "Notwithstanding institutionalization's incontrovertible interconnectedness, characteristically incomprehensible epistemological reconceptualizations proliferate indefinitely.",
    )
    expect(dense.scores.fleschReadingEase!).toBeLessThan(0)
    expect(dense.score).toBe(0)
    expect(dense.band).toBe("Very Confusing")
  })

  it("returns nulls, never NaN, for empty or very short text", () => {
    for (const text of ["", "   ", "One word.", "Too short to score."]) {
      const short = readability(text)
      expect(short.words).toBeLessThan(MIN_WORDS)
      expect(short.score).toBeNull()
      expect(short.band).toBeNull()
      expect(short.textStandard).toBeNull()
      expect(Object.values(short.scores).every((value) => value === null)).toBe(true)
    }
  })

  it("leaves SMOG out below three sentences but scores the rest", () => {
    const two = readability("Playing games has always been thought to be important to the development of creative children. I believe that playing games is important for adults.")
    expect(two.sentences).toBe(2)
    expect(two.scores.smog).toBeNull()
    expect(two.scores.fleschReadingEase).not.toBeNull()
  })

  it("does not split sentences on abbreviations or decimals", () => {
    const text = "Studies, e.g. Smith et al. found a rise of 3.5 percent in scores across many schools. Teachers noted the change."
    expect(readability(text).sentences).toBe(2)
  })
})

describe("readabilityBand", () => {
  it.each([
    [100, "Very Easy"],
    [90, "Very Easy"],
    [89, "Easy"],
    [80, "Easy"],
    [79, "Fairly Easy"],
    [70, "Fairly Easy"],
    [69, "Standard"],
    [62, "Standard"],
    [60, "Standard"],
    [59, "Fairly Difficult"],
    [50, "Fairly Difficult"],
    [49, "Difficult"],
    [30, "Difficult"],
    [29, "Very Confusing"],
    [0, "Very Confusing"],
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
