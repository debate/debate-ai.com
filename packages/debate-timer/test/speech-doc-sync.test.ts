import { describe, expect, it } from "vitest"
import {
  activeOutlineIndex,
  captionLineAt,
  docOutline,
  outlinePhrase,
  paceSectionTimings,
  parseSpeechDoc,
  parseSpeechOutline,
  parseWebVtt,
  sectionAtTime,
  shiftTimings,
  signpostOutline,
  speechDocSections,
  syncSpeechDoc,
  transcriptSectionTimings,
} from "../src/recorder/speech-doc-sync"
import { toWebVtt } from "../src/recorder/round-recording"
import { buildCaptionWords, type CaptionWord } from "../src/recorder/speech-captions"
import { buildTranscriptLines } from "../src/recorder/transcript-sections"

const DOC = [
  '<h2 class="pmd-hat">Advantage One: Economy</h2>',
  '<h4 class="pmd-tag">Tariffs collapse manufacturing exports</h4>',
  "<p><b>Smith 24</b> economist</p>",
  '<p>Studies show <span class="pmd-highlight">steel tariffs raised costs for factories</span> across the midwest region</p>',
  '<h4 class="pmd-tag">Recession causes global nuclear war</h4>',
  '<p>Historically <mark>economic decline triggers militarized conflict between rival powers</mark></p>',
  '<h2 class="pmd-hat">Plan</h2>',
  '<p class="pmd-analytic">The United States should repeal steel tariffs</p>',
].join("")

/** Caption words, one per second, from a spoken text. */
function spoken(text: string, from = 0): CaptionWord[] {
  return text.split(/\s+/).map((word, i) => ({ word, start: from + i, end: from + i + 1 }))
}

describe("parseSpeechDoc", () => {
  it("splits HTML into heading, tag and body paragraphs with formatting", () => {
    const paragraphs = parseSpeechDoc(DOC)
    expect(paragraphs.map((p) => p.level)).toEqual([2, 4, null, null, 4, null, 2, null])
    expect(paragraphs[3].runs.find((r) => r.highlight)?.text).toBe("steel tariffs raised costs for factories")
    expect(paragraphs[2].runs[0].bold).toBe(true)
    expect(paragraphs[7].analytic).toBe(true)
  })

  it("reads markdown speech docs", () => {
    const paragraphs = parseSpeechDoc("# Off\n\n#### Tag line\n\nSome ==highlighted== text")
    expect(paragraphs.map((p) => [p.level, p.text])).toEqual([
      [1, "Off"],
      [4, "Tag line"],
      [null, "Some highlighted text"],
    ])
  })

  it("returns nothing for an empty doc", () => {
    expect(parseSpeechDoc("")).toEqual([])
    expect(speechDocSections(null)).toEqual([])
  })
})

describe("speechDocSections", () => {
  it("starts a section at every heading and tag, reading only highlighted card text", () => {
    const sections = speechDocSections(DOC)
    expect(sections.map((s) => s.title)).toEqual([
      "Advantage One: Economy",
      "Tariffs collapse manufacturing exports",
      "Recession causes global nuclear war",
      "Plan",
    ])
    // Tag + bold cite + highlighted words; "midwest" isn't highlighted.
    expect(sections[1].tokens).toContain("factorie")
    expect(sections[1].tokens).not.toContain("midwest")
    expect(sections[3].tokens).toContain("repeal")
  })
})

describe("estimating which card was read", () => {
  const sections = speechDocSections(DOC)

  it("follows the transcript through the cards in order", () => {
    const words = [
      ...spoken("advantage one economy"),
      ...spoken("tariffs collapse manufacturing exports smith steel tariffs raised costs for factories", 10),
      ...spoken("recession causes global nuclear war economic decline triggers militarized conflict between rival powers", 40),
      ...spoken("plan the united states should repeal steel tariffs", 80),
    ]
    const timings = transcriptSectionTimings(sections, words)!
    expect(timings.map((t) => t.section)).toEqual([0, 1, 2, 3])
    expect(timings[0].start).toBe(0)
    expect(timings[2].start).toBeGreaterThanOrEqual(40)
    expect(timings[2].start).toBeLessThan(50)
    expect(timings[3].start).toBeGreaterThanOrEqual(80)
    expect(sectionAtTime(timings, 45)).toBe(2)
    expect(syncSpeechDoc(sections, words, 100).method).toBe("transcript")
  })

  it("lets a skipped card go unread", () => {
    const words = [
      ...spoken("tariffs collapse manufacturing exports steel tariffs raised costs factories"),
      ...spoken("plan united states should repeal steel tariffs plan repeal", 30),
    ]
    const timings = transcriptSectionTimings(sections, words)!
    expect(timings.map((t) => t.section)).not.toContain(2)
  })

  it("falls back to reading pace when the transcript doesn't match", () => {
    const words = spoken("lorem ipsum dolor amet consectetur adipiscing elit sed eiusmod tempor incididunt labore dolore magna")
    expect(transcriptSectionTimings(sections, words)).toBeNull()
    const sync = syncSpeechDoc(sections, words, 120)
    expect(sync.method).toBe("pace")
    expect(sync.timings.map((t) => t.section)).toEqual([0, 1, 2, 3])
    expect(sync.timings[0].start).toBe(0)
    expect(sync.timings[3].start).toBeLessThan(120)
  })

  it("splits the speech by how much each card reads", () => {
    const timings = paceSectionTimings(speechDocSections("#### A\n\n==one two==\n\n#### B\n\n==three four five six seven eight=="), 100)
    // A reads 3 words, B reads 7: B starts 30% in.
    expect(timings[1].start).toBeCloseTo(30)
    expect(shiftTimings(timings, 10)[1].start).toBeCloseTo(40)
  })

  it("has no section before anything is timed", () => {
    expect(sectionAtTime([], 5)).toBeNull()
    expect(sectionAtTime([{ section: 0, start: 3 }], 1)).toBe(0)
  })
})

describe("captions", () => {
  it("reads back the cues toWebVtt writes", () => {
    const cues = [
      { start: 1.5, end: 3, text: "first line" },
      { start: 3661.25, end: 3662, text: "an hour in" },
    ]
    expect(parseWebVtt(toWebVtt(cues))).toEqual(cues)
    expect(parseWebVtt(null)).toEqual([])
  })

  it("finds the caption line being said", () => {
    const words = buildCaptionWords({ text: "", segments: [{ text: "one two three. four five six.", start: 0, end: 6 }] })
    const lines = buildTranscriptLines(words)
    const line = captionLineAt(lines, words, 4)!
    expect(line.line).toBe(1)
    expect(line.words.map((w) => w.word)).toEqual(["four", "five", "six."])
    expect(line.active).toBe(1)
    expect(captionLineAt(lines, words, -1)).toBeNull()
  })
})

describe("outline", () => {
  it("makes hats H1 and card tags H2 when the doc has one heading level", () => {
    const sections = speechDocSections(DOC)
    const items = docOutline(sections, [
      { section: 0, start: 0 },
      { section: 1, start: 5 },
      { section: 3, start: 50 },
    ])
    expect(items).toEqual([
      { level: 1, text: "Advantage One: Economy", start: 0 },
      { level: 2, text: "Tariffs collapse manufacturing exports", start: 5 },
      { level: 1, text: "Plan", start: 50 },
    ])
    expect(activeOutlineIndex(items, 10)).toBe(1)
    expect(activeOutlineIndex(items, -1)).toBe(-1)
  })

  it("nests pockets, hats and tags as H1, H2 and H3", () => {
    const sections = speechDocSections("# 1NC\n\n## Off 1: Politics\n\n### Uniqueness\n\n#### Bill passes now")
    const items = docOutline(sections, sections.map((s, i) => ({ section: s.index, start: i })))
    expect(items.map((i) => i.level)).toEqual([1, 2, 2, 3])
  })

  it("shortens long tags into phrases", () => {
    expect(outlinePhrase("one two three four five", 3)).toBe("one two three…")
    expect(outlinePhrase("short tag")).toBe("short tag")
  })

  it("guesses an outline from signposts in the transcript", () => {
    const items = signpostOutline([
      { start: 0, text: "Contention one is the economy" },
      { start: 9, text: "First, tariffs hurt factories" },
      { start: 20, text: "Smith finds costs went up across the region" },
    ])
    expect(items.map((i) => i.level)).toEqual([1, 2, 3])
  })

  it("reads an AI outline reply", () => {
    const lines = [{ start: 0 }, { start: 10 }, { start: 20 }]
    const reply = 'Here: [{"level":2,"text":"Link","line":2},{"level":1,"text":"Off 1","line":0},{"level":5,"text":"bad","line":1},{"level":3,"text":"x","line":9}]'
    expect(parseSpeechOutline(reply, lines)).toEqual([
      { level: 1, text: "Off 1", start: 0 },
      { level: 2, text: "Link", start: 20 },
    ])
    expect(parseSpeechOutline("no json", lines)).toBeNull()
  })
})
