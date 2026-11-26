// @vitest-environment jsdom
/**
 * @fileoverview "Round recording" mounted for real: joining the recorded
 * speeches, saving to the cloud, playing the joined MP3 with each speech's
 * webcam clip, and handing adjusted speech starts back to the manifest.
 *
 * The heavy collaborators — the audio joiner, the cloud upload and the IndexedDB
 * media store — are mocked at their module boundary (each has its own suite);
 * the manifest helpers run for real against localStorage. The two nested
 * dialogs are stubbed to buttons that call their props.
 */

import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RoundRecordingDialog } from "../src/recorder/RoundRecordingDialog"
import {
  loadRoundRecordingManifest,
  saveRoundRecordingManifest,
  type RoundRecordingManifest,
} from "../src/recorder/round-recording"
import { VIDEO_CLIP_SAVED_EVENT } from "../src/recorder/media-store"
import { click, fire, flush, mount, type Mounted } from "./helpers/mount"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const joinRoundRecording = vi.fn()
vi.mock("../src/recorder/round-recording-audio", async () => ({
  ...(await vi.importActual<typeof import("../src/recorder/round-recording-audio")>(
    "../src/recorder/round-recording-audio",
  )),
  joinRoundRecording: (...args: unknown[]) => joinRoundRecording(...args),
}))

const uploadRoundRecording = vi.fn()
vi.mock("../src/recorder/round-recording-cloud", () => ({
  uploadRoundRecording: (...args: unknown[]) => uploadRoundRecording(...args),
}))

const getMedia = vi.fn()
const putMedia = vi.fn()
vi.mock("../src/recorder/media-store", async () => ({
  ...(await vi.importActual<typeof import("../src/recorder/media-store")>("../src/recorder/media-store")),
  getMedia: (...args: unknown[]) => getMedia(...args),
  putMedia: (...args: unknown[]) => putMedia(...args),
}))

const startsDialogProps = vi.fn()
vi.mock("../src/recorder/SpeechStartsDialog", () => ({
  SpeechStartsDialog: (props: {
    children: ReactNode
    onSeek: (s: number) => void
    onChange: (key: string, s: number | null) => void
  }) => {
    startsDialogProps(props)
    return (
      <div data-testid="starts-dialog">
        <button onClick={() => props.onChange("1NC", 50)}>move 1NC</button>
        <button onClick={() => props.onSeek(30)}>seek 30</button>
        {props.children}
      </div>
    )
  },
}))

const docDialogProps = vi.fn()
vi.mock("../src/recorder/SpeechDocPlaybackDialog", () => ({
  SpeechDocPlaybackDialog: (props: { initialTime: number }) => {
    docDialogProps(props)
    return <div data-testid="doc-dialog">doc at {props.initialTime}</div>
  },
}))

const ITEMS = [
  { key: "1AC", label: "1AC" },
  { key: "1NC", label: "1NC" },
  { key: "2AC", label: "2AC" },
]

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

let view: Mounted | undefined
let audio: HTMLAudioElement

beforeEach(() => {
  localStorage.clear()
  getMedia.mockResolvedValue(null)
  putMedia.mockResolvedValue(undefined)
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:url-${++n}`)
  URL.revokeObjectURL = vi.fn()
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause = vi.fn()
})

afterEach(async () => {
  await view?.unmount()
  view = undefined
  for (const mock of [joinRoundRecording, uploadRoundRecording, getMedia, putMedia, startsDialogProps, docDialogProps]) {
    mock.mockReset()
  }
})

function recordSpeech(key: string) {
  localStorage.setItem(`debate-recording-${key}`, JSON.stringify({ audio: "data:audio/webm;base64,AAAA" }))
}

async function open(props: Partial<React.ComponentProps<typeof RoundRecordingDialog>> = {}) {
  view = await mount(
    <RoundRecordingDialog open onOpenChange={() => {}} roundId="r1" items={ITEMS} {...props} />,
  )
  audio = document.querySelector("audio") as HTMLAudioElement
  return view
}

/** Opens the dialog on a round that has already been joined and stored. */
async function openJoined(manifest: RoundRecordingManifest = MANIFEST) {
  saveRoundRecordingManifest(manifest)
  getMedia.mockImplementation(async (key: string) => (key === "round-audio:r1" ? new Blob(["mp3"]) : key === "round-captions:r1" ? "WEBVTT" : null))
  const opened = await open()
  audio = document.querySelector("audio") as HTMLAudioElement
  return opened
}

const btn = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
    (b.textContent ?? "").includes(label),
  )!
const exactBtn = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === label)!
const text = () => document.body.textContent ?? ""

describe("RoundRecordingDialog", () => {
  it("counts the speeches that have a recording", async () => {
    recordSpeech("1AC")
    recordSpeech("2AC")
    await open()
    expect(text()).toContain("2 of 3 speeches recorded.")
  })

  it("will not join when nothing is recorded", async () => {
    await open()
    expect(btn("Join speeches").disabled).toBe(true)
    expect(btn("Save to cloud").disabled).toBe(true)
    expect(btn("Adjust speech starts").disabled).toBe(true)
    expect(btn("Play with speech doc").disabled).toBe(true)
  })

  it("renders nothing while closed", async () => {
    await open({ open: false })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it("joins with the chosen options and stores the result", async () => {
    recordSpeech("1AC")
    const result = { mp3: new Blob(["mp3"]), vtt: "WEBVTT", manifest: MANIFEST }
    joinRoundRecording.mockResolvedValue(result)
    await open()

    const [announce, captions, moonshine] = Array.from(document.querySelectorAll<HTMLInputElement>('fieldset input[type="checkbox"]'))
    expect([announce.checked, captions.checked, moonshine.checked]).toEqual([false, true, false])
    await click(announce)
    await click(captions)
    await click(btn("Join speeches"))

    expect(joinRoundRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        roundId: "r1",
        items: ITEMS,
        options: { announcements: true, captions: false, moonshine: false },
        previous: null,
      }),
    )
    expect(putMedia).toHaveBeenCalledWith("round-audio:r1", result.mp3)
    expect(putMedia).toHaveBeenCalledWith("round-captions:r1", "WEBVTT")
    expect(loadRoundRecordingManifest("r1")).toEqual(MANIFEST)
    expect(text()).toContain("Joined 2 speeches · 2:10")
    expect(btn("Re-join speeches")).toBeTruthy()
    expect(document.querySelector<HTMLAnchorElement>("a[download]")!.getAttribute("download")).toBe("round-r1.mp3")
    expect(document.querySelector("audio")!.getAttribute("src")).toMatch(/^blob:url-/)
  })

  it("stores empty captions when the join produced none", async () => {
    recordSpeech("1AC")
    joinRoundRecording.mockResolvedValue({ mp3: new Blob(["mp3"]), vtt: null, manifest: MANIFEST })
    await open()

    await click(btn("Join speeches"))

    expect(putMedia).toHaveBeenCalledWith("round-captions:r1", "")
    expect(document.querySelector("audio track")).toBeNull()
    expect(document.querySelector("ol li")!.textContent).toBe("1AC 0:00")
    expect(document.querySelectorAll("ol li")).toHaveLength(2)
  })

  it("shows progress by stage while joining, then clears it", async () => {
    recordSpeech("1AC")
    let finish!: (value: unknown) => void
    joinRoundRecording.mockImplementation(
      ({ onProgress }: { onProgress: (stage: string, fraction: number) => void }) =>
        new Promise((resolve) => {
          onProgress("encoding", 0.5)
          finish = resolve
        }),
    )
    await open()

    await click(btn("Join speeches"))
    expect(document.querySelector('[role="status"]')!.textContent).toContain("Encoding MP3 · 50%")
    expect(btn("Join speeches").disabled).toBe(true)
    expect(document.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true)

    await flush(() => finish({ mp3: new Blob(["mp3"]), vtt: null, manifest: MANIFEST }))
    expect(document.querySelector('[role="status"]')).toBeNull()
  })

  it("reports a failed join and keeps going", async () => {
    recordSpeech("1AC")
    joinRoundRecording.mockRejectedValueOnce(new Error("Out of memory"))
    await open()
    await click(btn("Join speeches"))
    expect(document.querySelector('[role="alert"]')!.textContent).toBe("Out of memory")

    joinRoundRecording.mockRejectedValueOnce("???")
    await click(btn("Join speeches"))
    expect(document.querySelector('[role="alert"]')!.textContent).toBe("Could not join the recordings.")
    expect(btn("Join speeches").disabled).toBe(false)
  })

  it("loads a saved join: players, speech buttons and the captions track", async () => {
    await openJoined()

    expect(audio.getAttribute("src")).toMatch(/^blob:url-/)
    expect(audio.querySelector("track")!.getAttribute("src")).toMatch(/^blob:url-/)
    const jumps = Array.from(document.querySelectorAll("ol button")).map((b) => b.textContent)
    expect(jumps).toEqual(["1AC 0:00", "1NC 1:05"])
    expect(text()).toContain("captions")
    expect(btn("Adjust speech starts").disabled).toBe(false)
  })

  it("jumps the audio to a speech and marks the one playing", async () => {
    await openJoined()
    const [first, second] = Array.from(document.querySelectorAll<HTMLButtonElement>("ol button"))
    expect(first.className).toContain("bg-primary")

    await click(second)

    expect(audio.currentTime).toBe(65)
    expect(second.className).toContain("bg-primary")
    expect(first.className).not.toContain("bg-primary")
  })

  it("follows the audio clock as it plays", async () => {
    await openJoined()
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 70 })
    await fire(audio, "timeupdate")

    const second = document.querySelectorAll<HTMLButtonElement>("ol button")[1]
    expect(second.className).toContain("bg-primary")
  })

  it("uses the adjusted starts the manifest carries", async () => {
    await openJoined({ ...MANIFEST, adjustedStarts: { "1NC": 80 } })
    const jumps = Array.from(document.querySelectorAll("ol button")).map((b) => b.textContent)
    expect(jumps).toEqual(["1AC 0:00", "1NC 1:20"])
  })

  it("saves a moved speech start into the stored manifest", async () => {
    await openJoined()

    await click(btn("Adjust speech starts"))
    await click(btn("move 1NC"))

    expect(loadRoundRecordingManifest("r1")!.adjustedStarts).toEqual({ "1NC": 50 })
    const jumps = Array.from(document.querySelectorAll("ol button")).map((b) => b.textContent)
    expect(jumps).toContain("1NC 0:50")
  })

  it("seeks the audio from the starts dialog and plays or pauses it from there", async () => {
    await openJoined()
    await click(btn("Adjust speech starts"))

    await click(btn("seek 30"))
    expect(audio.currentTime).toBe(30)

    await click(exactBtn("Play"))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    await click(exactBtn("Pause"))
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  })

  it("opens speech doc playback at the playhead, pausing the audio first", async () => {
    await openJoined()
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 12 })
    await fire(audio, "timeupdate")

    await click(btn("Play with speech doc"))

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    expect(document.querySelector('[data-testid="doc-dialog"]')!.textContent).toBe("doc at 12")
  })

  it("passes the host's speech doc loader through", async () => {
    const loadSpeechDoc = vi.fn()
    saveRoundRecordingManifest(MANIFEST)
    getMedia.mockImplementation(async (key: string) => (key === "round-audio:r1" ? new Blob(["mp3"]) : null))
    await open({ loadSpeechDoc })

    await click(btn("Play with speech doc"))

    expect(docDialogProps).toHaveBeenCalledWith(expect.objectContaining({ loadSpeechDoc, vtt: null }))
  })

  it("uploads to the cloud, stores the remote keys and relabels the button", async () => {
    await openJoined()
    const saved = { ...MANIFEST, remote: { manifest: "rounds/r1/manifest.json" } }
    uploadRoundRecording.mockImplementation(
      async (_m: unknown, _mp3: unknown, _vtt: unknown, onProgress: (f: number) => void) => {
        onProgress(0.25)
        return saved
      },
    )

    await click(btn("Save to cloud"))

    expect(uploadRoundRecording).toHaveBeenCalledWith(MANIFEST, expect.any(Blob), "WEBVTT", expect.any(Function))
    expect(text()).toContain("Saved to the cloud.")
    expect(loadRoundRecordingManifest("r1")!.remote).toEqual({ manifest: "rounds/r1/manifest.json" })
    expect(btn("Save to cloud again")).toBeTruthy()
  })

  it("reports a failed upload", async () => {
    await openJoined()
    uploadRoundRecording.mockRejectedValueOnce(new Error("R2 is down"))
    await click(btn("Save to cloud"))
    expect(document.querySelector('[role="alert"]')!.textContent).toBe("R2 is down")

    uploadRoundRecording.mockRejectedValueOnce(null)
    await click(btn("Save to cloud"))
    expect(document.querySelector('[role="alert"]')!.textContent).toBe("Could not save to the cloud.")
  })

  it("shows the webcam clips of the speech playing, and picks up new ones", async () => {
    localStorage.setItem(
      "debate-video-clips",
      JSON.stringify([{ id: "c1", speechKey: "1AC", participant: "Ana", recordedAt: "x" }]),
    )
    getMedia.mockImplementation(async (key: string) => {
      if (key === "round-audio:r1") return new Blob(["mp3"])
      if (key === "clip:c1" || key === "clip:c2") return new Blob(["video"])
      return null
    })
    saveRoundRecordingManifest(MANIFEST)
    await open()

    expect(document.querySelector("figcaption")!.textContent).toBe("Ana")
    expect(document.querySelector("video")!.getAttribute("src")).toMatch(/^blob:url-/)

    localStorage.setItem(
      "debate-video-clips",
      JSON.stringify([
        { id: "c1", speechKey: "1AC", participant: "Ana", recordedAt: "x" },
        { id: "c2", speechKey: "1AC", participant: "Ben", recordedAt: "y" },
        { id: "c3", speechKey: "1NC", participant: "Cy", recordedAt: "z" },
      ]),
    )
    await flush(() => {
      window.dispatchEvent(new Event(VIDEO_CLIP_SAVED_EVENT))
    })
    expect(Array.from(document.querySelectorAll("figcaption")).map((f) => f.textContent)).toEqual(["Ana", "Ben"])

    await click(document.querySelectorAll<HTMLButtonElement>("ol button")[1])
    expect(Array.from(document.querySelectorAll("figcaption")).map((f) => f.textContent)).toEqual(["Cy"])
  })

  it("keeps a clip's video in step with the audio: playing, paused and seeking", async () => {
    localStorage.setItem(
      "debate-video-clips",
      JSON.stringify([{ id: "c1", speechKey: "1AC", participant: "Ana", recordedAt: "x" }]),
    )
    getMedia.mockImplementation(async (key: string) => (key === "round-audio:r1" || key === "clip:c1" ? new Blob(["x"]) : null))
    saveRoundRecordingManifest(MANIFEST)
    await open()
    const video = document.querySelector("video") as HTMLVideoElement
    Object.defineProperty(video, "paused", { configurable: true, writable: true, value: true })
    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 0 })

    await fire(audio, "play")
    expect(video.play).toHaveBeenCalled()

    Object.defineProperty(video, "paused", { configurable: true, writable: true, value: false })
    await fire(audio, "pause")
    expect(video.pause).toHaveBeenCalled()

    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 20 })
    await fire(audio, "timeupdate")
    expect(video.currentTime).toBe(20)
  })

  it("does not create a video for a clip whose blob is missing, and revokes URLs on unmount", async () => {
    localStorage.setItem(
      "debate-video-clips",
      JSON.stringify([{ id: "c1", speechKey: "1AC", participant: "Ana", recordedAt: "x" }]),
    )
    getMedia.mockImplementation(async (key: string) => (key === "round-audio:r1" ? new Blob(["x"]) : null))
    saveRoundRecordingManifest(MANIFEST)
    const opened = await open()
    expect(document.querySelector("video")).toBeNull()
    expect(document.querySelector("figcaption")!.textContent).toBe("Ana")

    await opened.unmount()
    view = undefined
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it("closes through onOpenChange", async () => {
    const onOpenChange = vi.fn()
    await open({ onOpenChange })
    await click(document.querySelector('[aria-label="Close"]')!)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
