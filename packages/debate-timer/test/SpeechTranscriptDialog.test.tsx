// @vitest-environment jsdom
/**
 * @fileoverview The captions ticker's expand button opens the full transcript
 * in a modal, where words seek the recording and the AI button splits the
 * transcript into section headings.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioPlayerProvider } from "../src/recorder/audio-player"
import { SpeechCaptionsTicker } from "../src/recorder/SpeechCaptionsTicker"
import { spokenTranscriptKey } from "../src/recorder/spoken-words-store"
import { click, flush, mount, stubAudio, type Mounted } from "./helpers/mount"

const TRACK = { id: "debate-recording-1AC", src: "blob:/1ac" }
let restoreAudio: () => void
let view: Mounted | undefined

beforeEach(() => {
  localStorage.clear()
  restoreAudio = stubAudio()
  localStorage.setItem(
    spokenTranscriptKey("1AC"),
    JSON.stringify({
      text: "Framework first. Contention one economy",
      updatedAt: "2026-10-13T00:00:00Z",
      segments: [
        { text: "Framework first.", start: 0, end: 2 },
        { text: "Contention one economy", start: 2, end: 6 },
      ],
    }),
  )
})

afterEach(async () => {
  await view?.unmount()
  view = undefined
  restoreAudio()
  vi.unstubAllGlobals()
})

async function openTranscript() {
  view = await mount(
    <AudioPlayerProvider>
      <SpeechCaptionsTicker speechName="1AC" track={TRACK} durationSeconds={6} />
    </AudioPlayerProvider>,
  )
  await click(view.container.querySelector('[aria-label="Open 1AC full transcript"]')!)
  return document.querySelector('[role="dialog"]') as HTMLElement
}

describe("SpeechTranscriptDialog", () => {
  it("opens the full transcript in a modal", async () => {
    const dialog = await openTranscript()
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain("1AC transcript")
    expect(dialog.textContent).toContain("Contention")
  })

  it("splits the transcript into AI sections", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ text: '[{"title":"Framework","line":0},{"title":"Contention 1","line":1}]' })),
      ),
    )
    const dialog = await openTranscript()
    const button = [...dialog.querySelectorAll("button")].find((b) => b.textContent?.includes("Split into sections"))!
    await click(button)
    await flush(() => {})
    const nav = dialog.querySelector('nav[aria-label="Sections"]')
    expect(nav?.textContent).toContain("Framework")
    expect(nav?.textContent).toContain("Contention 1")
  })
})
