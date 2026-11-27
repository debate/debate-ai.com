// @vitest-environment jsdom
/**
 * The Synergy Slayer Voice reader's follow-along features
 * (`packages/debate-help-docs/components/guides/voice-read-button.tsx`): the
 * ball under the active word, click-to-restart at a sentence, play/pause and
 * the menu with every part's voice and speed.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  activeWordIndex,
  endsSentence,
  locateWord,
  sentenceStart,
  wordAtCharacter,
} from "../../../../packages/debate-help-docs/components/guides/voice-read-words"
import { PauseControl } from "../../../../packages/debate-help-docs/components/guides/voice-read-pause"
import { blockFromWord, collectVoiceBlocks } from "../../../../packages/debate-help-docs/components/guides/voice-read-text"
import { voicePieces } from "../../../../packages/debate-help-docs/components/guides/voice-read-button"
import { speechChunks } from "@debate-ai/editor/kokoro"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function render(html: string): Element {
  const root = document.createElement("div")
  root.className = "synergy-slayer-doc"
  root.innerHTML = html
  document.body.replaceChildren(root)
  return root
}

describe("sentences", () => {
  it("ends a sentence at . ! ? and closing quotes, not at abbreviations or initials", () => {
    expect(endsSentence("wrong.")).toBe(true)
    expect(endsSentence("really?”")).toBe(true)
    expect(endsSentence("U.S.")).toBe(false)
    expect(endsSentence("Dr.")).toBe(false)
    expect(endsSentence("e.g.")).toBe(false)
    expect(endsSentence("however,")).toBe(false)
  })

  it("finds the first word of the sentence holding a word", () => {
    const words = "It broke. Then the U.S. Senate acted. Done.".split(" ")
    expect(sentenceStart(words, 0)).toBe(0)
    expect(sentenceStart(words, 3)).toBe(2)
    expect(sentenceStart(words, 6)).toBe(2)
    expect(sentenceStart(words, 7)).toBe(7)
  })
})

describe("active word", () => {
  const words = ["The", "assumption,", "however,", "was", "wrong."]

  it("moves from the first word to the last as the clip plays", () => {
    expect(activeWordIndex(words, 0)).toBe(0)
    expect(activeWordIndex(words, 0.5)).toBeGreaterThan(0)
    expect(activeWordIndex(words, 1)).toBe(words.length - 1)
    const seen = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => activeWordIndex(words, f))
    expect([...seen].sort((a, b) => a - b)).toEqual(seen)
  })

  it("finds the word at a spoken character", () => {
    expect(wordAtCharacter(["ab", "cd", "ef"], 0)).toBe(0)
    expect(wordAtCharacter(["ab", "cd", "ef"], 3)).toBe(1)
    expect(wordAtCharacter(["ab", "cd", "ef"], 99)).toBe(2)
  })
})

describe("word positions", () => {
  it("places every word in its text node, across marks", () => {
    const root = render(`<p>The <mark>big <b>bad</b></mark> wolf.</p>`)
    const [block] = collectVoiceBlocks(root)
    expect(block!.words.map((w) => w.text)).toEqual(["The", "big", "bad", "wolf."])
    const bad = block!.words[2]!
    expect(bad.start!.node.nodeValue!.slice(bad.start!.offset, bad.end!.offset)).toBe("bad")
    const wolf = block!.words[3]!
    expect(wolf.start!.node.nodeValue!.slice(wolf.start!.offset, wolf.end!.offset)).toBe("wolf.")
  })

  it("only counts the highlighted words when reading highlights", () => {
    const root = render(`<p>Skip <mark>keep one</mark> skip <mark>keep two</mark></p>`)
    const [block] = collectVoiceBlocks(root, { highlightedOnly: true })
    expect(block!.words.map((w) => w.text)).toEqual(["keep", "one", "keep", "two"])
  })

  it("starts a passage at a word and numbers the pieces from there", () => {
    const root = render(`<p>One two. Three four. Five six.</p>`)
    const [block] = collectVoiceBlocks(root)
    const from = blockFromWord(block!, 2)
    expect(from.text).toBe("Three four. Five six.")
    const pieces = voicePieces([from], (text) => speechChunks(text, 12))
    expect(pieces.map((p) => [p.text, p.firstWord])).toEqual([
      ["Three four.", 2],
      ["Five six.", 4],
    ])
  })

  it("locates the word under a click point, or the next one after it", () => {
    const root = render(`<p id="a">First one. Second one.</p><p id="b">Third.</p>`)
    const blocks = collectVoiceBlocks(root)
    const text = root.querySelector("#a")!.firstChild!
    expect(locateWord(blocks, text, 14)).toEqual({ block: 0, word: 2 })
    expect(locateWord(blocks, text, 0)).toEqual({ block: 0, word: 0 })
    expect(locateWord(blocks, root.querySelector("#b")!.firstChild!, 2)).toEqual({ block: 1, word: 0 })
    expect(locateWord(blocks, root, root.childNodes.length)).toBeNull()
  })
})

describe("PauseControl", () => {
  it("holds the audio and the next clip until resumed", async () => {
    const audio = { pause: vi.fn(), play: vi.fn(() => Promise.resolve()) } as unknown as HTMLAudioElement
    const pause = new PauseControl()
    pause.attachAudio(audio)
    pause.pause()
    expect(audio.pause).toHaveBeenCalled()
    let resumed = false
    void pause.whenResumed(new AbortController().signal).then(() => (resumed = true))
    await Promise.resolve()
    expect(resumed).toBe(false)
    pause.resume()
    await new Promise((r) => setTimeout(r, 0))
    expect(audio.play).toHaveBeenCalled()
    expect(resumed).toBe(true)
  })

  it("lets go when the reading stops", async () => {
    const pause = new PauseControl()
    pause.pause()
    const stop = new AbortController()
    const waiting = pause.whenResumed(stop.signal)
    stop.abort()
    await expect(waiting).resolves.toBeUndefined()
  })
})

describe("the Voice menu and reading", () => {
  class FakeAudio {
    static all: FakeAudio[] = []
    src = ""
    onended: (() => void) | null = null
    onerror: (() => void) | null = null
    playbackRate = 1
    defaultPlaybackRate = 1
    duration = 4
    currentTime = 0
    paused = true
    plays = 0
    constructor() {
      FakeAudio.all.push(this)
    }
    play() {
      this.paused = false
      this.plays++
      return Promise.resolve()
    }
    pause() {
      this.paused = true
    }
    removeAttribute() {}
  }

  let toolbar: HTMLDivElement
  let page: HTMLDivElement
  let app: Root
  const spoken: string[] = []

  beforeEach(async () => {
    localStorage.clear()
    spoken.length = 0
    FakeAudio.all = []
    vi.stubGlobal("Audio", FakeAudio)
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: string }) => {
        if (String(url).includes("/api/tts/cache")) return { ok: false, status: 404, headers: { get: (): string | null => null } }
        spoken.push(JSON.parse(init?.body ?? "{}").text)
        return { ok: true, status: 200, headers: { get: (): string | null => "audio/wav" }, blob: async () => new Blob(["x"]) }
      }),
    )
    URL.createObjectURL = vi.fn(() => "blob:test")
    URL.revokeObjectURL = vi.fn()
    const rect = { left: 10, right: 50, top: 100, bottom: 120, width: 40, height: 20 }
    Range.prototype.getClientRects = (() => [rect]) as unknown as Range["getClientRects"]
    Range.prototype.getBoundingClientRect = (() => rect) as unknown as Range["getBoundingClientRect"]
    Element.prototype.scrollIntoView = vi.fn()
    window.scrollBy = vi.fn() as unknown as typeof window.scrollBy
    page = document.createElement("div")
    page.className = "synergy-slayer-doc"
    page.innerHTML = '<p id="a">First one here. Second one there.</p><p id="b">Another paragraph.</p>'
    toolbar = document.createElement("div")
    document.body.append(toolbar, page)
    const mod = await import("../../../../packages/debate-help-docs/components/guides/voice-read-button")
    app = createRoot(toolbar)
    await act(async () => app.render(<mod.VoiceReadButton />))
  })

  afterEach(async () => {
    await act(async () => app.unmount())
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
  })

  const trigger = () => toolbar.querySelector<HTMLButtonElement>("button[aria-haspopup=dialog]")!
  const menuButton = (text: string) =>
    Array.from(toolbar.querySelectorAll<HTMLButtonElement>("[role=dialog] button")).find((b) => b.textContent?.includes(text))
  const press = (el: Element | undefined) => act(async () => el!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
  const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 60))))
  const ball = () => document.querySelector("[data-voice-ball]")

  it("opens one menu with play, the options and every part's voice and speed", async () => {
    expect(toolbar.querySelectorAll("button")).toHaveLength(1)
    await press(trigger())
    await settle()
    expect(menuButton("Read this page")).toBeTruthy()
    expect(menuButton("Local Kokoro")).toBeTruthy()
    expect(menuButton("Fast speech")).toBeTruthy()
    const parts = Array.from(toolbar.querySelectorAll("[data-voice-settings] section")).map((s) => s.querySelector("h3")?.textContent)
    expect(parts).toEqual(["Tag", "Author & year", "Highlighted text"])
    for (const part of ["tag", "author", "text"]) {
      expect(toolbar.querySelector(`#voice-settings-${part}-voice`)).toBeTruthy()
      expect(toolbar.querySelector(`#voice-settings-${part}-speed`)).toBeTruthy()
    }
  })

  it("changes a part's voice and speed in the shared settings", async () => {
    await press(trigger())
    await settle()
    const voice = toolbar.querySelector<HTMLSelectElement>("#voice-settings-author-voice")!
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!
      set.call(voice, "deepgram:aura-orion-en")
      voice.dispatchEvent(new Event("change", { bubbles: true }))
    })
    const { readStoredVoiceId } = await import("@debate-ai/editor/read-voice")
    expect(readStoredVoiceId("author")).toBe("deepgram:aura-orion-en")
    expect(voice.value).toBe("deepgram:aura-orion-en")
  })

  it("shows a ball on the active word, pauses and resumes from the menu", async () => {
    await press(trigger())
    await settle()
    await press(menuButton("Read this page"))
    await settle()
    const audio = FakeAudio.all.find((a) => a.plays > 1 || (a.plays === 1 && a.src !== ""))!
    expect(audio).toBeTruthy()
    expect(spoken[0]).toBe("First one here. Second one there.")
    expect(ball()?.getAttribute("data-voice-ball")).not.toBe("hidden")
    expect(menuButton("Pause")).toBeTruthy()

    await press(menuButton("Pause"))
    expect(audio.paused).toBe(true)
    expect(menuButton("Resume")).toBeTruthy()
    expect(trigger().textContent).toContain("Paused")

    await press(menuButton("Resume"))
    expect(audio.paused).toBe(false)
    expect(menuButton("Pause")).toBeTruthy()

    await press(menuButton("Stop"))
    expect(ball()).toBeNull()
    expect(menuButton("Read this page")).toBeTruthy()
  })

  it("restarts from the start of the clicked sentence while reading", async () => {
    await press(trigger())
    await settle()
    await press(menuButton("Read this page"))
    await settle()
    const text = page.querySelector("#a")!.firstChild!
    // "Second one there." starts at index 17; click on "one".
    const position = { offsetNode: text, offset: 24 }
    ;(document as unknown as { caretPositionFromPoint: () => typeof position }).caretPositionFromPoint = () => position
    await press(page.querySelector("#a")!)
    await settle()
    expect(spoken).toContain("Second one there.")
    expect(spoken.at(-2)).toBe("Second one there.")
    expect(spoken.at(-1)).toBe("Another paragraph.")
  })

  it("leaves clicks on links and text selections alone", async () => {
    page.innerHTML = '<p id="a">First one here. <a href="#x">link</a></p>'
    await press(trigger())
    await settle()
    await press(menuButton("Read this page"))
    await settle()
    const before = spoken.length
    ;(document as unknown as { caretPositionFromPoint: () => unknown }).caretPositionFromPoint = () => ({
      offsetNode: page.querySelector("#a")!.firstChild!,
      offset: 3,
    })
    await press(page.querySelector("a")!)
    await settle()
    expect(spoken.length).toBe(before)
  })
})
