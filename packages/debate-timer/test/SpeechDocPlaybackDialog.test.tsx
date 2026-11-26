// @vitest-environment jsdom
/**
 * @fileoverview "Speech doc playback" mounted with the real doc/caption/outline
 * logic: the doc loads per speech, the card being read is marked from the
 * audio's clock, tabs and timestamps seek the audio, and the outline comes from
 * the doc, the transcript or the AI.
 *
 * The doc, VTT and speech starts are small fixtures with known times, so every
 * assertion about "what is being read at 8s" follows from the data below.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SpeechDocPlaybackDialog } from "../src/recorder/SpeechDocPlaybackDialog"
import type { RoundRecordingManifest } from "../src/recorder/round-recording"
import { appendSpokenSegment } from "../src/recorder/spoken-words-store"
import { speechOutlineKey } from "../src/recorder/speech-doc-sync"
import { click, fire, flush, mount, type Mounted } from "./helpers/mount"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const MANIFEST: RoundRecordingManifest = {
  version: 1,
  roundId: "r1",
  createdAt: "2026-10-13T00:00:00Z",
  durationSeconds: 130,
  speeches: [
    { key: "1AC", label: "1AC", start: 0, duration: 60 },
    { key: "1NC", label: "1NC", start: 65, duration: 60 },
  ],
  processing: { announcements: false, captions: true, moonshine: false },
  videos: [],
}

const VTT = `WEBVTT

00:00:00.000 --> 00:00:04.000
Our plan funds renewable energy.

00:00:04.000 --> 00:00:09.000
Solvency shows warming ends quickly.

00:01:05.000 --> 00:01:10.000
Negative responds with topicality.
`

const DOC_1AC = `<h1>Plan</h1>
<p><mark>Plan funds renewable energy</mark></p>
<h2>Solvency</h2>
<p><mark>Solvency shows warming ends quickly</mark></p>`

let view: Mounted | undefined
let audio: HTMLAudioElement

beforeEach(() => {
  localStorage.clear()
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.scrollTo = vi.fn() as never
})

afterEach(async () => {
  await view?.unmount()
  view = undefined
  vi.unstubAllGlobals()
})

type Props = Partial<React.ComponentProps<typeof SpeechDocPlaybackDialog>>

async function open(props: Props = {}) {
  view = await mount(
    <SpeechDocPlaybackDialog
      open
      onOpenChange={() => {}}
      roundId="r1"
      manifest={MANIFEST}
      audioUrl="blob:joined"
      vtt={VTT}
      {...props}
    />,
  )
  audio = document.querySelector("audio") as HTMLAudioElement
  return view
}

/** jsdom's media element has no clock, so give it one and fire the event the dialog listens to. */
async function setTime(seconds: number, event = "timeupdate") {
  Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: seconds })
  await fire(audio, event)
}

const q = (selector: string) => document.querySelector(selector) as HTMLElement
const text = () => document.body.textContent ?? ""
const tab = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-label="Speeches"] button')).find((b) =>
    b.textContent?.startsWith(label),
  )!

describe("SpeechDocPlaybackDialog", () => {
  it("lists each speech with its start, in the order they are played", async () => {
    await open({ manifest: { ...MANIFEST, speeches: [...MANIFEST.speeches].reverse() } })

    const tabs = Array.from(document.querySelectorAll('[aria-label="Speeches"] button')).map((b) => b.textContent)
    expect(tabs).toEqual(["1AC 0:00", "1NC 1:05"])
  })

  it("says docs are unavailable when the host gives no loader", async () => {
    await open()
    expect(text()).toContain("Speech docs aren't available here.")
  })

  it("loads the doc of every speech and tells a speech with no doc apart", async () => {
    const loadSpeechDoc = vi.fn(async (key: string) => (key === "1AC" ? DOC_1AC : null))
    await open({ loadSpeechDoc })

    expect(loadSpeechDoc).toHaveBeenCalledWith("1AC")
    expect(loadSpeechDoc).toHaveBeenCalledWith("1NC")
    const doc = q('[aria-label="Speech doc"]')
    expect(doc.textContent).toContain("1AC speech doc")
    expect(doc.textContent).toContain("Plan funds renewable energy")
    expect(doc.textContent).toContain("card estimated by matching the transcript")

    await setTime(66)
    expect(q('[aria-label="Speech doc"]').textContent).toContain("1NC speech doc")
    expect(text()).toContain("This speech has no speech doc.")
  })

  it("treats a doc that fails to load as having none", async () => {
    await open({ loadSpeechDoc: vi.fn().mockRejectedValue(new Error("offline")) })
    expect(text()).toContain("This speech has no speech doc.")
  })

  it("estimates by reading pace when the recording has no captions", async () => {
    await open({ vtt: null, loadSpeechDoc: async () => DOC_1AC })
    expect(q('[aria-label="Speech doc"]').textContent).toContain("card estimated from reading pace")
    expect(text()).toContain("No captions. Join the recording with captions turned on.")
  })

  it("shows the caption being said and marks the card being read", async () => {
    await open({ loadSpeechDoc: async () => DOC_1AC })

    await setTime(6)

    const captions = q('[aria-label="Captions and outline"]')
    expect(captions.textContent).toContain("1AC · 0:06")
    expect(captions.textContent).toContain("Solvency shows warming ends quickly.")
    expect(captions.textContent).toContain("Reading: Solvency")
    const active = document.querySelector('article[data-active="true"]')!
    expect(active.textContent).toContain("Solvency shows warming ends quickly")
  })

  it("says captions start when the speech does, before the first word", async () => {
    await open({ vtt: "WEBVTT\n\n00:00:30.000 --> 00:00:35.000\nLate start.\n" })
    await setTime(1)
    expect(text()).toContain("Captions start when the speech does.")
  })

  it("falls back to each speech's live transcript when there is no VTT", async () => {
    appendSpokenSegment("1AC", "Spoken live words here", { start: 0, end: 4 })
    await open({ vtt: null })

    await setTime(3)

    expect(q('[aria-label="Captions and outline"]').textContent).toContain("Spoken")
    expect(text()).not.toContain("No captions.")
  })

  it("seeks and plays when a speech tab is clicked", async () => {
    await open({ loadSpeechDoc: async () => DOC_1AC })

    await click(tab("1NC"))

    expect(audio.currentTime).toBe(65)
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    expect(q('[aria-label="Captions and outline"]').textContent).toContain("1NC · 1:05")
  })

  it("keeps showing the picked speech's doc once Follow along is off", async () => {
    await open({ loadSpeechDoc: async (key) => (key === "1AC" ? DOC_1AC : null) })
    const follow = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    await click(follow)
    expect(follow.checked).toBe(false)

    await click(tab("1AC"))
    await setTime(66)

    expect(q('[aria-label="Speech doc"]').textContent).toContain("1AC speech doc")
    expect(q('[aria-label="Captions and outline"]').textContent).toContain("1NC")
  })

  it("seeks to a card's timestamp", async () => {
    await open({ loadSpeechDoc: async () => DOC_1AC })

    const stamps = Array.from(document.querySelectorAll<HTMLButtonElement>('button[title="Play from here"]'))
    expect(stamps.length).toBe(2)
    await click(stamps[1])

    expect(audio.currentTime).toBeGreaterThan(0)
    expect(q('[aria-label="Captions and outline"]').textContent).toContain(`0:0${Math.floor(audio.currentTime)}`)
  })

  it("builds the outline from the doc's headings and reveals it as it is spoken", async () => {
    await open({ loadSpeechDoc: async () => DOC_1AC })
    const outline = () => q("ol:not([aria-label])")
    expect(text()).toContain("from the speech doc")
    expect(outline().textContent).toContain("Plan")
    expect(outline().textContent).not.toContain("Solvency")

    await setTime(8)
    expect(outline().textContent).toContain("Solvency")

    await setTime(0)
    const reveal = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).at(-1)!
    await click(reveal)
    expect(outline().textContent).toContain("Solvency")
  })

  it("falls back to signposts from the transcript when the speech has no doc", async () => {
    await open({ vtt: "WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nFirst, the economy collapses.\n" })
    expect(text()).toContain("signposts in the transcript")
  })

  it("says there is nothing to outline when there is neither doc nor transcript", async () => {
    await open({ vtt: null })
    expect(text()).toContain("Nothing to outline yet.")
    expect(document.querySelector<HTMLButtonElement>('button[title^="Summarize"]')!.disabled).toBe(true)
  })

  it("replaces the outline with an AI summary and remembers it", async () => {
    const reply = JSON.stringify([
      { level: 1, text: "Funding plan", line: 0 },
      { level: 2, text: "Warming solvency", line: 1 },
    ])
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: reply }) })
    vi.stubGlobal("fetch", fetchMock)
    await open({ loadSpeechDoc: async () => DOC_1AC })

    await click(q('button[title^="Summarize"]'))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(text()).toContain("AI summary of the transcript")
    await setTime(8)
    expect(q("ol:not([aria-label])").textContent).toContain("Funding plan")
    expect(q("ol:not([aria-label])").textContent).toContain("Warming solvency")
    expect(localStorage.getItem(speechOutlineKey("r1", "1AC"))).toContain("Funding plan")
  })

  it("reuses a saved AI outline without asking again", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    // The version is the first line's start, the line count and the last line's start:
    // the VTT's two cues in the 1AC window make two lines, starting at 0s and 4s.
    localStorage.setItem(
      speechOutlineKey("r1", "1AC"),
      JSON.stringify({ version: "0:2:4", items: [{ level: 1, text: "Saved outline", start: 0 }] }),
    )
    await open()

    expect(text()).toContain("Saved outline")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows the reason when the AI outline fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: "Too many requests" }) }),
    )
    await open()

    await click(q('button[title^="Summarize"]'))

    expect(q('[role="alert"]').textContent).toBe("Too many requests")
  })

  it("falls back to a generic message for an unreadable failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network down"))
    await open()

    await click(q('button[title^="Summarize"]'))

    expect(q('[role="alert"]').textContent).toBe("Could not outline the speech.")
  })

  it("starts the audio at the requested time once its metadata loads", async () => {
    await open({ initialTime: 62 })
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 0 })

    await fire(audio, "loadedmetadata")

    expect(audio.currentTime).toBe(62)
    expect(q('[aria-label="Captions and outline"]').textContent).toContain("1AC · 1:02")
  })

  it("follows the audio's clock after a seek", async () => {
    await open()
    await setTime(70, "seeked")
    expect(q('[aria-label="Captions and outline"]').textContent).toContain("1NC · 1:10")
  })

  it("renders nothing while closed", async () => {
    await open({ open: false })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
