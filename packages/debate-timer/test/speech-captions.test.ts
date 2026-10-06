import { describe, expect, it } from "vitest"
import { activeCaptionIndex, buildCaptionWords } from "../src/recorder/speech-captions"

describe("buildCaptionWords", () => {
  it("spreads each segment's words across its own window", () => {
    const words = buildCaptionWords({
      text: "aa bb cc",
      segments: [
        { text: "aa bb", start: 0, end: 2 },
        { text: "cc", start: 10, end: 12 },
      ],
    })
    expect(words.map((w) => w.word)).toEqual(["aa", "bb", "cc"])
    expect(words[0]).toMatchObject({ start: 0, end: 1 })
    expect(words[1]).toMatchObject({ start: 1, end: 2 })
    expect(words[2]).toMatchObject({ start: 10, end: 12 })
  })

  it("weights words by length", () => {
    const [short, long] = buildCaptionWords({ text: "a", segments: [{ text: "a bbb", start: 0, end: 6 }] })
    expect(short.end - short.start).toBeCloseTo(2)
    expect(long.end - long.start).toBeCloseTo(4)
  })

  it("spreads an untimed transcript across the recording length", () => {
    const words = buildCaptionWords({ text: "one two" }, 8)
    expect(words[0].start).toBe(0)
    expect(words[1].start).toBeCloseTo(4)
    expect(words[1].end).toBeCloseTo(8)
  })

  it("returns nothing without a transcript", () => {
    expect(buildCaptionWords(null)).toEqual([])
    expect(buildCaptionWords({ text: "  " }, 5)).toEqual([])
  })
})

describe("activeCaptionIndex", () => {
  const words = [
    { word: "a", start: 0, end: 1 },
    { word: "b", start: 1, end: 2 },
    { word: "c", start: 5, end: 6 },
  ]

  it("finds the last word started by the given time", () => {
    expect(activeCaptionIndex(words, 0)).toBe(0)
    expect(activeCaptionIndex(words, 1.5)).toBe(1)
    expect(activeCaptionIndex(words, 3)).toBe(1)
    expect(activeCaptionIndex(words, 9)).toBe(2)
  })

  it("is -1 before the first word or with no words", () => {
    expect(activeCaptionIndex([{ word: "a", start: 2, end: 3 }], 1)).toBe(-1)
    expect(activeCaptionIndex([], 1)).toBe(-1)
  })
})
