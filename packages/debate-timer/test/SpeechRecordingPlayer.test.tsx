// @vitest-environment jsdom
/**
 * @fileoverview `SpeechRecordingPlayer` and the rest of the speech menu: the
 * saved-recording row, its captions toggle, deleting, reacting to the
 * recorder's events, the menu's timer/recording/webcam items, audio-file
 * upload and the helpers that save and share a recording.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  SpeechRecordingMenu,
  SpeechRecordingPlayer,
  saveSpeechAudioFile,
  shareRecording,
} from "../src/recorder/SpeechRecordingPlayer"
import { RECORD_VIDEO_EVENT, RECORD_VIDEO_KEY } from "../src/recorder/media-store"
import { appendSpokenSegment, spokenTranscriptKey } from "../src/recorder/spoken-words-store"
import { click, flush, mount, pointerDown, stubAudio, type Mounted } from "./helpers/mount"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const AUDIO = "data:audio/webm;base64,AAAA"
const RECORDING_KEY = "debate-recording-1AC"

function saveRecording(extra: Record<string, unknown> = {}) {
  localStorage.setItem(
    RECORDING_KEY,
    JSON.stringify({ speechName: "1AC", speechLabel: "1AC", recordedAt: "2026-10-13T00:00:00Z", audio: AUDIO, ...extra }),
  )
}

let view: Mounted | undefined
let restoreAudio: () => void
let getUserMedia: ReturnType<typeof vi.fn>
const trackStop = vi.fn()

beforeEach(() => {
  localStorage.clear()
  restoreAudio = stubAudio()
  trackStop.mockClear()
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream)
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue([
        { deviceId: "mic-1", kind: "audioinput", label: "Built-in Mic", groupId: "g1" },
        { deviceId: "mic-2", kind: "audioinput", label: "Headset", groupId: "g2" },
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never
  // The progress slider measures itself.
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause = vi.fn()
})

afterEach(async () => {
  await view?.unmount()
  view = undefined
  restoreAudio()
  vi.restoreAllMocks()
})

const menuItem = (text: string) =>
  Array.from(document.body.querySelectorAll<HTMLElement>("[role=menuitem]")).find((i) => i.textContent?.includes(text))

async function openMenu() {
  const buttons = view!.container.querySelectorAll("button")
  await pointerDown(buttons[buttons.length - 1]!)
  await flush(() => {})
}

describe("SpeechRecordingPlayer", () => {
  it("renders nothing until the speech has a recording", async () => {
    view = await mount(<SpeechRecordingPlayer speechName="1AC" />)
    expect(view.container.innerHTML).toBe("")
  })

  it("shows a stored recording with its saved duration and loads it into the player", async () => {
    saveRecording({ durationSeconds: 312.4 })
    view = await mount(<SpeechRecordingPlayer speechName="1AC" className="custom" />)

    expect(view.container.textContent).toContain("5:12")
    expect(view.container.firstElementChild!.className).toContain("custom")
    expect(view.container.querySelector("button[aria-label='Play']")).toBeTruthy()
  })

  it("ignores a corrupt stored recording", async () => {
    localStorage.setItem(RECORDING_KEY, "{not json")
    view = await mount(<SpeechRecordingPlayer speechName="1AC" />)
    expect(view.container.innerHTML).toBe("")
  })

  it("switches recording when the speech changes", async () => {
    saveRecording({ durationSeconds: 61 })
    view = await mount(<SpeechRecordingPlayer speechName="1AC" />)
    expect(view.container.textContent).toContain("1:01")

    await view.rerender(<SpeechRecordingPlayer speechName="1NC" />)
    expect(view.container.innerHTML).toBe("")
  })

  it("remembers whether captions were left on", async () => {
    saveRecording({ durationSeconds: 60 })
    view = await mount(<SpeechRecordingPlayer speechName="1AC" />)
    const toggle = () => view!.container.querySelector<HTMLButtonElement>("button[title$='captions']")!
    expect(toggle().getAttribute("aria-pressed")).toBe("false")
    expect(toggle().title).toBe("Show captions")

    await click(toggle())
    expect(toggle().getAttribute("aria-pressed")).toBe("true")
    expect(toggle().title).toBe("Hide captions")
    expect(localStorage.getItem("debate-recording-captions")).toBe("1")

    await view.unmount()
    view = await mount(<SpeechRecordingPlayer speechName="1AC" />)
    expect(toggle().getAttribute("aria-pressed")).toBe("true")

    await click(toggle())
    expect(localStorage.getItem("debate-recording-captions")).toBe("0")
  })

  it("deletes the recording and its transcript once the user confirms", async () => {
    saveRecording({ durationSeconds: 60 })
    appendSpokenSegment("1AC", "some words", { start: 0, end: 2 })
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true)
    view = await mount(<SpeechRecordingPlayer speechName="1AC" />)
    await openMenu()

    await click(menuItem("Delete Recording")!)
    expect(localStorage.getItem(RECORDING_KEY)).not.toBeNull()

    await openMenu()
    await click(menuItem("Delete Recording")!)

    expect(confirm).toHaveBeenCalledTimes(3)
    expect(localStorage.getItem(RECORDING_KEY)).toBeNull()
    expect(localStorage.getItem(spokenTranscriptKey("1AC"))).toBeNull()
    expect(view.container.innerHTML).toBe("")
  })

  it("picks up a recording saved while it is mounted", async () => {
    view = await mount(<SpeechRecordingPlayer speechName="1AC" />)
    expect(view.container.innerHTML).toBe("")

    saveRecording({ durationSeconds: 90 })
    await flush(() => {
      window.dispatchEvent(new CustomEvent("debate-recording-saved"))
    })

    expect(view.container.textContent).toContain("1:30")
  })

  it("stays mounted but empty while its speech is being recorded", async () => {
    view = await mount(<SpeechRecordingPlayer speechName="1AC" />)

    await flush(() => {
      window.dispatchEvent(new CustomEvent("debate-recording-started", { detail: { speechName: "1NC" } }))
    })
    expect(view.container.innerHTML).toBe("")

    await flush(() => {
      window.dispatchEvent(new CustomEvent("debate-recording-started", { detail: { speechName: "1AC" } }))
    })
    expect(view.container.firstElementChild).not.toBeNull()
    expect(view.container.firstElementChild!.children).toHaveLength(0)

    await flush(() => {
      window.dispatchEvent(new CustomEvent("debate-recording-saved"))
    })
    expect(view.container.innerHTML).toBe("")
  })

  it("hides the inline menu when asked", async () => {
    saveRecording({ durationSeconds: 60 })
    view = await mount(<SpeechRecordingPlayer speechName="1AC" hideInlineMenu />)
    expect(view.container.querySelectorAll("button")).toHaveLength(2)

    await view.unmount()
    view = await mount(<SpeechRecordingPlayer speechName="1AC" />)
    expect(view.container.querySelectorAll("button")).toHaveLength(3)
  })

  it("leaves an external progress container empty and reports not playing while idle", async () => {
    saveRecording({ durationSeconds: 60 })
    const portal = document.createElement("div")
    document.body.append(portal)
    const onPlayingChange = vi.fn()
    view = await mount(
      <SpeechRecordingPlayer
        speechName="1AC"
        progressBarPortalRef={{ current: portal }}
        onPlayingChange={onPlayingChange}
      />,
    )

    expect(onPlayingChange).toHaveBeenLastCalledWith(false)
    expect(portal.children).toHaveLength(0)
    portal.remove()
  })
})

describe("SpeechRecordingMenu items", () => {
  function renderMenu(props: Partial<React.ComponentProps<typeof SpeechRecordingMenu>> = {}) {
    return mount(<SpeechRecordingMenu speechName="1AC" {...props} />)
  }

  it("runs the timer actions the host supplies", async () => {
    const onResetSpeechTime = vi.fn()
    const onSwitchToCrossX = vi.fn()
    const onResetPrepTimers = vi.fn()
    view = await renderMenu({ onResetSpeechTime, onSwitchToCrossX, onResetPrepTimers })

    await openMenu()
    await click(menuItem("Reset Speech Timer")!)
    await openMenu()
    await click(menuItem("Set Timer Cross-X")!)
    await openMenu()
    await click(menuItem("Reset Prep Timers")!)

    expect(onResetSpeechTime).toHaveBeenCalledTimes(1)
    expect(onSwitchToCrossX).toHaveBeenCalledTimes(1)
    expect(onResetPrepTimers).toHaveBeenCalledTimes(1)
  })

  it("lists host actions and upload actions, and runs them", async () => {
    const first = vi.fn()
    const second = vi.fn()
    view = await renderMenu({
      actions: [{ key: "ai", label: "Summarize speech", onSelect: first }],
      uploadActions: [{ key: "yt", label: "Select YouTube Start", onSelect: second }],
    })

    await openMenu()
    await click(menuItem("Summarize speech")!)
    await openMenu()
    await click(menuItem("Select YouTube Start")!)

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("toggles whether audio is recorded", async () => {
    const onRecordingEnabledChange = vi.fn()
    view = await renderMenu({ recordingEnabled: true, onRecordingEnabledChange })
    await openMenu()
    await click(menuItem("Don't record audio")!)
    expect(onRecordingEnabledChange).toHaveBeenLastCalledWith(false)

    await view.unmount()
    view = await renderMenu({ recordingEnabled: false, onRecordingEnabledChange })
    await openMenu()
    await click(menuItem("Don't record audio")!)
    expect(onRecordingEnabledChange).toHaveBeenLastCalledWith(true)
  })

  it("toggles webcam recording through the shared setting", async () => {
    view = await renderMenu()
    await openMenu()
    await click(menuItem("Record webcam video")!)
    expect(localStorage.getItem(RECORD_VIDEO_KEY)).toBe("1")

    await flush(() => {
      window.dispatchEvent(new Event(RECORD_VIDEO_EVENT))
    })
    await openMenu()
    await click(menuItem("Record webcam video")!)
    expect(localStorage.getItem(RECORD_VIDEO_KEY)).toBe("0")
  })

  it("picks a playback speed, marking the current one", async () => {
    const onPlaybackRateChange = vi.fn()
    view = await renderMenu({ playbackRate: 0.5, onPlaybackRateChange })
    await openMenu()

    await click(menuItem("Playback Speed")!)
    await flush(() => {})
    const normal = Array.from(document.body.querySelectorAll<HTMLElement>("[role=menuitem]")).find(
      (i) => i.textContent === "Normal",
    )!
    await click(normal)

    expect(onPlaybackRateChange).toHaveBeenCalledWith(1)
  })

  it("opens the round recording dialog from the menu", async () => {
    view = await renderMenu({ roundRecording: { roundId: "r1", items: [{ key: "1AC", label: "1AC" }] } })
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    await openMenu()
    await click(menuItem("Join round recording")!)

    expect(document.querySelector('[role="dialog"]')!.textContent).toContain("Round recording")
  })

  it("lists the microphones, marks the selected one, and reports a pick", async () => {
    const onMicDeviceChange = vi.fn()
    view = await renderMenu({ micDeviceId: "mic-2", onMicDeviceChange })

    await openMenu()
    await flush(() => {})

    expect(menuItem("Built-in Mic")).toBeTruthy()
    expect(menuItem("Headset")!.className).toContain("font-medium")
    expect(document.body.textContent).toContain("Currently: Headset")
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: "mic-2" } } })

    await click(menuItem("Built-in Mic")!)
    expect(onMicDeviceChange).toHaveBeenCalledWith("mic-1")
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: { deviceId: { exact: "mic-1" } } })
  })

  it("stops the preview microphone when the menu closes", async () => {
    view = await renderMenu()
    await openMenu()
    await flush(() => {})
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })

    await flush(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })

    expect(trackStop).toHaveBeenCalled()
  })

  it("carries on when microphone permission is denied", async () => {
    getUserMedia.mockRejectedValue(new Error("denied"))
    view = await renderMenu()
    await openMenu()
    await flush(() => {})
    expect(menuItem("Upload Speech Audio")).toBeTruthy()
    expect(document.body.textContent).toContain("Microphone Input")
  })

  it("says so when there are no microphones", async () => {
    ;(navigator.mediaDevices.enumerateDevices as ReturnType<typeof vi.fn>).mockResolvedValue([])
    view = await renderMenu({ triggerLabel: "Mic & recording" })
    expect(view.container.textContent).toContain("Mic & recording")

    await openMenu()
    await flush(() => {})

    expect(menuItem("No microphones found")).toBeTruthy()
    expect(document.body.textContent).toContain("Currently: Microphone")
  })

  it("passes a chosen audio file to the saver and alerts on a rejected one", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    view = await renderMenu()
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!

    const notAudio = new File(["x"], "notes.txt", { type: "text/plain" })
    Object.defineProperty(input, "files", { configurable: true, value: [notAudio] })
    await flush(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(alertSpy).toHaveBeenCalledWith("Please select an audio file")
  })

  it("ignores a cleared file chooser", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    view = await renderMenu()
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, "files", { configurable: true, value: [] })

    await flush(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(alertSpy).not.toHaveBeenCalled()
  })

  it("opens the file chooser from Upload Speech Audio", async () => {
    view = await renderMenu()
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!
    const clickSpy = vi.spyOn(input, "click")

    await openMenu()
    await click(menuItem("Upload Speech Audio")!)

    expect(clickSpy).toHaveBeenCalled()
  })
})

describe("saveSpeechAudioFile", () => {
  it("rejects a file that is not audio", async () => {
    await expect(saveSpeechAudioFile(new File(["x"], "a.png", { type: "image/png" }), "1AC")).rejects.toThrow(
      "Please select an audio file",
    )
  })

  it("stores an audio file the way a live recording is stored and announces it", async () => {
    class MetadataAudio {
      duration = 42
      onloadedmetadata: (() => void) | null = null
      constructor() {
        setTimeout(() => this.onloadedmetadata?.(), 0)
      }
    }
    ;(globalThis as { Audio?: unknown }).Audio = MetadataAudio
    const saved = vi.fn()
    window.addEventListener("debate-recording-saved", saved)

    await saveSpeechAudioFile(new File(["abc"], "speech.mp3", { type: "audio/mpeg" }), "1AC", "1AC — Ana")

    const stored = JSON.parse(localStorage.getItem(RECORDING_KEY)!)
    expect(stored).toMatchObject({ speechName: "1AC", speechLabel: "1AC — Ana", durationSeconds: 42 })
    expect(stored.audio).toMatch(/^data:audio\/mpeg;base64,/)
    expect(saved).toHaveBeenCalledTimes(1)
    window.removeEventListener("debate-recording-saved", saved)
  })

  it("rejects when the file cannot be read", async () => {
    class FailingReader {
      onerror: (() => void) | null = null
      onload: unknown = null
      readAsDataURL() {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    vi.stubGlobal("FileReader", FailingReader)

    await expect(
      saveSpeechAudioFile(new File(["x"], "a.mp3", { type: "audio/mpeg" }), "1AC"),
    ).rejects.toThrow("Couldn't read that file.")
    vi.unstubAllGlobals()
  })
})

describe("shareRecording", () => {
  it("reports how many participants it reached", async () => {
    vi.useFakeTimers()
    const one = shareRecording(["a@x.com"], "1AC", AUDIO)
    const two = shareRecording(["a@x.com", "b@x.com"], "1AC", AUDIO)
    await vi.advanceTimersByTimeAsync(500)

    expect(await one).toEqual({ success: true, message: "Shared with 1 participant" })
    expect(await two).toEqual({ success: true, message: "Shared with 2 participants" })
    vi.useRealTimers()
  })
})
