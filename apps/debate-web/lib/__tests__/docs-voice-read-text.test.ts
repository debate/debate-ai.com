// @vitest-environment jsdom
/**
 * @fileoverview Pins what the Synergy Slayer "Voice" button reads
 * (`packages/debate-help-docs/components/guides/voice-read-text.ts`): every
 * visible passage in page order, never the figures or their captions.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { describe, expect, it } from "vitest"
import {
  collectVoiceBlocks,
  isFigureCaption,
} from "../../../../packages/debate-help-docs/components/guides/voice-read-text"
import { voicePieces } from "../../../../packages/debate-help-docs/components/guides/voice-read-button"
import { KOKORO_CHUNK_CHARS, speechChunks } from "@debate-ai/editor/kokoro"

function render(html: string): Element {
  const root = document.createElement("div")
  root.className = "synergy-slayer-doc"
  root.innerHTML = html
  document.body.replaceChildren(root)
  return root
}

describe("isFigureCaption", () => {
  it("matches the papers' figure captions", () => {
    expect(isFigureCaption("Figure 4: Treating prior questions as gateways.")).toBe(true)
    expect(isFigureCaption("  Fig. 12. A chart")).toBe(true)
  })

  it("leaves prose that mentions a figure alone", () => {
    expect(isFigureCaption("As Figure 4 shows, the gateway fails.")).toBe(false)
    expect(isFigureCaption("Figures of speech matter.")).toBe(false)
  })
})

describe("collectVoiceBlocks", () => {
  it("reads every passage in order and skips the figure and its caption", () => {
    const root = render(`
      <p><img src="https://i.imgur.com/x.png" alt="An image's alt text"></p>
      <p><em>Figure 4: Treating prior questions as gateways.</em></p>
      <h2>1. Original Sin</h2>
      <p>The <mark class="debate-hl">assumption</mark> was <strong>always</strong> wrong.</p>
      <figure><img src="y.png" alt=""><figcaption>A caption</figcaption></figure>
      <ol><li><p>First point.</p></li><li>Second point.</li></ol>
    `)
    expect(collectVoiceBlocks(root).map((b) => b.text)).toEqual([
      "1. Original Sin",
      "The assumption was always wrong.",
      "First point.",
      "Second point.",
    ])
  })

  it("returns the element each passage belongs to, for the outline", () => {
    const root = render(`<p id="a">Hello there.</p>`)
    const [block] = collectVoiceBlocks(root)
    expect(block?.element.id).toBe("a")
  })

  it("reads collapsed content too, such as a closed <details> card, but not aria-hidden text", () => {
    const root = render(`
      <details><summary>Shanahan 1993</summary><p>Card text.</p></details>
      <p aria-hidden="true">Decorative.</p>
      <p>Shown.</p>
    `)
    expect(collectVoiceBlocks(root).map((b) => b.text)).toEqual(["Shanahan 1993", "Card text.", "Shown."])
  })

  it("reads an open <details> body", () => {
    const root = render(`<details open><summary>Smith</summary><p>Card text.</p></details>`)
    expect(collectVoiceBlocks(root).map((b) => b.text)).toEqual(["Smith", "Card text."])
  })
})

describe("collectVoiceBlocks with highlightedOnly", () => {
  it("reads only the highlighted runs, joined with spaces, and skips blocks without any", () => {
    const root = render(`
      <h2>1. Original Sin</h2>
      <p><mark class="debate-hl">The assumption</mark> that debate needs critiques <mark class="debate-hl">was wrong</mark>.</p>
      <p>No highlights here.</p>
      <div class="debate-card"><p><u>underlined only</u> <mark>Card highlight</mark></p></div>
    `)
    expect(collectVoiceBlocks(root, { highlightedOnly: true }).map((b) => b.text)).toEqual([
      "The assumption was wrong",
      "Card highlight",
    ])
  })

  it("reads highlights inside a closed References card", () => {
    const root = render(`<details><summary>Smith 2020</summary><p>Not this <mark>but this</mark>.</p></details>`)
    expect(collectVoiceBlocks(root, { highlightedOnly: true }).map((b) => b.text)).toEqual(["but this"])
  })
})

describe("voicePieces", () => {
  it("cuts every passage into Kokoro-sized pieces without losing any text", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ")
    const root = render(`<p id="a">${long}</p><p id="b">Short.</p>`)
    const pieces = voicePieces(collectVoiceBlocks(root), (text) => speechChunks(text))
    expect(pieces.length).toBeGreaterThan(2)
    expect(pieces.every((p) => p.text.length <= KOKORO_CHUNK_CHARS)).toBe(true)
    expect(pieces.filter((p) => p.element.id === "a").map((p) => p.text).join(" ")).toBe(long)
    expect(pieces.at(-1)).toMatchObject({ text: "Short." })
  })
})
