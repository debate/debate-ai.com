// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildCaptionWords } from "../src/recorder/speech-captions"
import {
  buildTranscriptLines,
  buildTranscriptSectionsPrompt,
  loadTranscriptSections,
  parseTranscriptSections,
  requestTranscriptSections,
  saveTranscriptSections,
} from "../src/recorder/transcript-sections"

const words = buildCaptionWords({ text: "", segments: [
  { text: "Framework first. Weigh util.", start: 0, end: 4 },
  { text: "Contention one is the economy and jobs", start: 4, end: 10 },
] })

describe("buildTranscriptLines", () => {
  it("breaks after sentence punctuation and keeps word offsets", () => {
    const lines = buildTranscriptLines(words)
    expect(lines.map((l) => l.text)).toEqual([
      "Framework first.",
      "Weigh util.",
      "Contention one is the economy and jobs",
    ])
    expect(lines.map((l) => l.wordIndex)).toEqual([0, 2, 4])
    expect(lines[2].start).toBe(4)
  })

  it("caps unpunctuated lines at maxWords", () => {
    const lines = buildTranscriptLines(buildCaptionWords({ text: "a b c d e" }, 5), 2)
    expect(lines.map((l) => l.text)).toEqual(["a b", "c d", "e"])
  })
})

describe("buildTranscriptSectionsPrompt", () => {
  it("numbers each line with its time", () => {
    const prompt = buildTranscriptSectionsPrompt("1AC", buildTranscriptLines(words))
    expect(prompt).toContain("Speech: 1AC")
    expect(prompt).toContain("[2] (0:04) Contention one")
  })
})

describe("parseTranscriptSections", () => {
  const lines = buildTranscriptLines(words)

  it("maps line numbers to words, sorted, deduped, starting at the top", () => {
    const sections = parseTranscriptSections(
      'Here: [{"title":"Contention 1","line":2},{"title":"Framework","line":1},{"title":"dup","line":2},{"title":"bad","line":9}]',
      lines,
    )
    expect(sections).toEqual([
      { title: "Framework", wordIndex: 0, start: 0 },
      { title: "Contention 1", wordIndex: 4, start: 4 },
    ])
  })

  it("returns null for unusable replies", () => {
    expect(parseTranscriptSections("no json", lines)).toBeNull()
    expect(parseTranscriptSections("[{\"title\":\"\",\"line\":0}]", lines)).toBeNull()
    expect(parseTranscriptSections("[{\"title\":\"A\",\"line\":0}]", [])).toBeNull()
  })
})

describe("requestTranscriptSections", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("posts to the AI proxy and parses the reply", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: '[{"title":"Intro","line":0}]' })))
    vi.stubGlobal("fetch", fetchMock)
    await expect(requestTranscriptSections("1AC", words)).resolves.toEqual([{ title: "Intro", wordIndex: 0, start: 0 }])
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/reason-ai")
    expect(JSON.parse(init.body as string).messages[0].content).toContain("Speech: 1AC")
  })

  it("surfaces the proxy's error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Sign in to use AI features." }), { status: 401 })))
    await expect(requestTranscriptSections("1AC", words)).rejects.toThrow("Sign in to use AI features.")
  })
})

describe("section cache", () => {
  it("only returns sections saved for the same transcript version", () => {
    saveTranscriptSections("1NC", "v1", [{ title: "A", wordIndex: 0, start: 0 }])
    expect(loadTranscriptSections("1NC", "v1")).toEqual([{ title: "A", wordIndex: 0, start: 0 }])
    expect(loadTranscriptSections("1NC", "v2")).toBeNull()
  })
})
