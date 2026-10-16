// @vitest-environment jsdom
/**
 * @fileoverview The speech menu's "Select YouTube Start" modal: a pasted
 * link loads the preview, a search lists the site's videos, the start point
 * is saved for the speech, and "Suggest all speeches" places every speech of
 * the format from the video's captions (falling back to caption gaps when the
 * AI is unavailable).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { YouTubeSpeechDialog } from "../src/dialogs/YouTubeSpeechDialog"
import { loadSpeechMediaClip } from "@debate/timer/src/recorder/youtube-speech-segments"
import { readSpeechStarts } from "@debate/videos/src/state/speechStartMarks"
import { buttonByText, cleanup, click, flush, mount, typeInto } from "./dom-helpers"

/** Captions for an LD round: each speech is continuous talk, with a minute of quiet between. */
function ldCaptions() {
  const lengths = [360, 180, 420, 180, 240, 360, 180]
  const snippets: Array<{ text: string; start: number; duration: number }> = []
  let cursor = 30
  for (const length of lengths) {
    for (let t = cursor; t < cursor + length; t += 4) snippets.push({ text: "words", start: t, duration: 4 })
    cursor += length + 60
  }
  return snippets
}

const fetchMock = vi.fn(async (url: string) => {
  if (url.startsWith("/api/videos")) {
    return new Response(
      JSON.stringify({ videos: [["abcdefghijk", "TOC Finals LD", "2025-04-28", "Debate Channel", 100, "", 3]] }),
    )
  }
  if (url.startsWith("/api/transcript")) {
    return new Response(JSON.stringify({ videoId: "abcdefghijk", snippets: ldCaptions() }))
  }
  // /api/reason-ai — not signed in.
  return new Response(JSON.stringify({ error: "Sign in to use AI." }), { status: 401 })
})

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  fetchMock.mockClear()
})

const input = () => document.querySelector('input[aria-label="YouTube link or search"]') as HTMLInputElement
/** The speech editor's rows: each speech's label and typed start. */
const editorRows = () =>
  [...document.querySelectorAll('ol[aria-label="Speeches"] > li')].map((li) => ({
    label: li.querySelector("span")?.textContent,
    start: (li.querySelector('input[aria-label="Start time"]') as HTMLInputElement).value,
    stop: (li.querySelector('input[aria-label="Stop time"]') as HTMLInputElement).value,
  }))
const submit = async () => {
  await click(input().form?.querySelector('button[type="submit"]'))
  await flush(6)
}

describe("YouTubeSpeechDialog", () => {
  it("loads a pasted link into the preview and saves the start for this speech", async () => {
    await mount(<YouTubeSpeechDialog open onOpenChange={() => {}} speechName="AC" />)
    await typeInto(input(), "https://youtu.be/abcdefghijk?t=95")
    await submit()

    const iframe = document.querySelector("iframe") as HTMLIFrameElement
    expect(iframe.src).toContain("/embed/abcdefghijk")
    expect(iframe.src).toContain("start=95")

    await click(buttonByText("Save for AC"))
    expect(loadSpeechMediaClip("AC")).toMatchObject({ source: { kind: "youtube", videoId: "abcdefghijk" }, start: 95 })
  })

  it("searches the site's videos and suggests every speech of the video's format", async () => {
    await mount(<YouTubeSpeechDialog open onOpenChange={() => {}} speechName="AC" />)
    await typeInto(input(), "toc finals")
    await submit()
    expect(fetchMock.mock.calls[0][0]).toContain("/api/videos?q=toc+finals")

    await click([...document.querySelectorAll("li button")].find((b) => b.textContent?.includes("TOC Finals LD")))
    await click(buttonByText("Suggest all speeches with AI"))
    await flush(10)

    const rows = editorRows()
    // LD (picked from the video's style): AC, CX, NC, CX, 1AR, NR, 2AR.
    expect(rows).toHaveLength(7)
    expect(rows[0]).toMatchObject({ label: "AC", start: "0:30" })
    expect(rows[1].label).toBe("CX after AC")
    expect(document.body.textContent).toContain("AI unavailable: Sign in to use AI.")

    await click(buttonByText("Save all 7"))
    expect(loadSpeechMediaClip("NC")).toMatchObject({ source: { videoId: "abcdefghijk" }, start: 30 + 360 + 60 + 180 + 60 })
    // The watch page's speech marks for the same video now agree.
    expect(Object.values(readSpeechStarts("abcdefghijk"))).toContain(30)
  })

  it("labels the round's joined MP3 with its known starts", async () => {
    const onSaveAll = vi.fn()
    const segments = [
      { key: "AC", name: "AC", start: 0, end: 355, expectedSeconds: 360 },
      { key: "CX after AC", name: "CX", start: 360, end: 540, expectedSeconds: 180 },
    ]
    await mount(
      <YouTubeSpeechDialog
        open
        onOpenChange={() => {}}
        speechName="AC"
        roundAudio={{ url: "https://files.example/round.mp3", title: "Joined round", segments, onSaveAll }}
      />,
    )
    await click(buttonByText("Round audio (MP3)"))
    await click(buttonByText("Joined round"))

    expect((document.querySelector("audio") as HTMLAudioElement).src).toBe("https://files.example/round.mp3")
    expect(editorRows()).toEqual([
      { label: "AC", start: "0:00", stop: "5:55" },
      { label: "CX after AC", start: "6:00", stop: "9:00" },
    ])
    await click(buttonByText("Save all 2"))
    expect(onSaveAll).toHaveBeenCalledWith(segments)
    expect(loadSpeechMediaClip("CX after AC")).toMatchObject({
      source: { kind: "audio", url: "https://files.example/round.mp3" },
      start: 360,
      end: 540,
    })
  })
})
