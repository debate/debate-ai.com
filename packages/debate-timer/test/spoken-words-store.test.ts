import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  appendSpokenSegment,
  clearSpokenTranscript,
  loadSpokenTranscript,
  loadSpokenWordCount,
  SPOKEN_WORDS_EVENT,
  spokenTranscriptKey,
} from "../src/recorder/spoken-words-store"

describe("spoken-words-store", () => {
  let store: Map<string, string>
  let dispatched: string[]

  beforeEach(() => {
    store = new Map()
    dispatched = []
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    vi.stubGlobal("window", { dispatchEvent: (e: Event) => void dispatched.push(e.type) })
    vi.stubGlobal("CustomEvent", class extends Event {
      detail: unknown
      constructor(type: string, init?: { detail?: unknown }) {
        super(type)
        this.detail = init?.detail
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("starts at zero", () => {
    expect(loadSpokenWordCount("1AC")).toBe(0)
    expect(loadSpokenTranscript("1AC")).toBeNull()
  })

  it("appends recognized segments and counts their words", () => {
    appendSpokenSegment("1AC", "I affirm the resolution")
    appendSpokenSegment("1AC", "  observation one  ")
    expect(loadSpokenTranscript("1AC")?.text).toBe("I affirm the resolution observation one")
    expect(loadSpokenWordCount("1AC")).toBe(6)
    expect(dispatched).toEqual([SPOKEN_WORDS_EVENT, SPOKEN_WORDS_EVENT])
  })

  it("ignores blank segments and keeps speeches separate", () => {
    appendSpokenSegment("1AC", "one two")
    appendSpokenSegment("1AC", "   ")
    appendSpokenSegment("1NC", "three")
    expect(loadSpokenWordCount("1AC")).toBe(2)
    expect(loadSpokenWordCount("1NC")).toBe(1)
  })

  it("clears a speech's transcript", () => {
    appendSpokenSegment("2AC", "words here")
    clearSpokenTranscript("2AC")
    expect(store.has(spokenTranscriptKey("2AC"))).toBe(false)
    expect(loadSpokenWordCount("2AC")).toBe(0)
  })

  it("tolerates corrupt storage", () => {
    store.set(spokenTranscriptKey("1AR"), "{not json")
    expect(loadSpokenWordCount("1AR")).toBe(0)
  })
})
