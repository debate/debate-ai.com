// @vitest-environment jsdom
/**
 * @fileoverview Joining a round's speech recordings into one MP3, against
 * small Web Audio stand-ins: decoding is a lookup of fake buffers, and the
 * offline render really mixes their samples, so the layout, announcements,
 * captions and the manifest can all be checked from the output. The MP3
 * encoder is the real lamejs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const moonshine = vi.hoisted(() => ({ generate: vi.fn(async () => " words "), loaded: 0 }))
vi.mock("@moonshine-ai/moonshine-js", () => ({
  MoonshineModel: class {
    constructor(public path: string) {}
    async loadModel() {
      moonshine.loaded++
    }
    generate = moonshine.generate
  },
}))
vi.mock("../src/recorder/moonshine-model-cache", () => ({
  MOONSHINE_MODEL_PATH: "model/base",
  withMoonshineCache: (fn: () => unknown) => fn(),
}))
const transcripts = vi.hoisted(() => new Map<string, { segments: unknown[] }>())
vi.mock("../src/recorder/spoken-words-store", () => ({
  loadSpokenTranscript: (key: string) => transcripts.get(key) ?? null,
}))

import {
  encodeMp3,
  joinRoundRecording,
  JOINED_SAMPLE_RATE,
  recordedSpeeches,
  speakAnnouncement,
  splitOnQuiet,
  toInt16,
  transcribeWithMoonshine,
} from "../src/recorder/round-recording-audio"

/** A mono AudioBuffer stand-in. */
function fakeBuffer(samples: Float32Array, sampleRate: number): AudioBuffer {
  return {
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => samples,
  } as unknown as AudioBuffer
}

/** Decoded audio by the bytes' first value: `[n]` decodes to n seconds of a tone at 1 kHz. */
function decodeFake(data: ArrayBuffer): AudioBuffer {
  const seconds = new Uint8Array(data)[0] ?? 1
  const samples = new Float32Array(seconds * 1000).fill(0.5)
  return fakeBuffer(samples, 1000)
}

class FakeAudioContext {
  async decodeAudioData(data: ArrayBuffer) {
    if (new Uint8Array(data)[0] === 255) throw new Error("undecodable")
    return decodeFake(data)
  }
  async close() {}
}

/** Mixes each source into the output at its start time, resampling by nearest sample. */
class FakeOfflineAudioContext {
  sources: Array<{ buffer: AudioBuffer | null; at: number }> = []
  destination = {}
  constructor(
    public channels: number,
    public length: number,
    public sampleRate: number,
  ) {}
  createBufferSource() {
    const source = { buffer: null as AudioBuffer | null, at: 0, connect() {}, start: (at: number) => (source.at = at) }
    this.sources.push(source)
    return source
  }
  async startRendering() {
    const out = new Float32Array(this.length)
    for (const { buffer, at } of this.sources) {
      if (!buffer) continue
      const data = buffer.getChannelData(0)
      const first = Math.round(at * this.sampleRate)
      const count = Math.round(buffer.duration * this.sampleRate)
      for (let i = 0; i < count && first + i < out.length; i++) {
        out[first + i] += data[Math.min(data.length - 1, Math.floor((i / this.sampleRate) * buffer.sampleRate))]
      }
    }
    return fakeBuffer(out, this.sampleRate)
  }
}

/** Saves a recording whose data URL decodes to `seconds` of tone. */
function saveRecording(key: string, seconds: number) {
  localStorage.setItem(`debate-recording-${key}`, JSON.stringify({ audio: `data:audio/webm;base64,${btoa(String.fromCharCode(seconds))}` }))
}

const items = [
  { key: "1AC", label: "1AC" },
  { key: "CX1", label: "CX of 1AC" },
  { key: "1NC", label: "1NC" },
]

let ttsResponse: () => Response

beforeEach(() => {
  localStorage.clear()
  transcripts.clear()
  moonshine.generate.mockClear()
  moonshine.loaded = 0
  vi.stubGlobal("AudioContext", FakeAudioContext)
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext)
  ttsResponse = () => new Response(new Uint8Array([1]), { headers: { "content-type": "audio/wav" } })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("data:")) {
        const bytes = Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0))
        return new Response(bytes)
      }
      expect(init?.method).toBe("POST")
      return ttsResponse()
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("recordedSpeeches", () => {
  it("keeps only speeches with a readable saved recording, in order", () => {
    saveRecording("1NC", 1)
    saveRecording("1AC", 1)
    localStorage.setItem("debate-recording-CX1", "{not json")
    expect(recordedSpeeches(items).map((i) => i.key)).toEqual(["1AC", "1NC"])
    localStorage.setItem("debate-recording-CX1", JSON.stringify({}))
    expect(recordedSpeeches(items).map((i) => i.key)).toEqual(["1AC", "1NC"])
  })
})

describe("toInt16", () => {
  it("scales and clamps to 16-bit PCM", () => {
    expect(Array.from(toInt16(new Float32Array([0, 1, -1, 2, -2, 0.5])))).toEqual([0, 32767, -32768, 32767, -32768, 16383])
  })
})

describe("encodeMp3", () => {
  it("encodes a mono buffer to an MP3 blob, reporting progress up to 1", async () => {
    const samples = new Float32Array(JOINED_SAMPLE_RATE / 2).map((_, i) => Math.sin(i / 10) * 0.3)
    const progress: number[] = []
    const mp3 = await encodeMp3(fakeBuffer(samples, JOINED_SAMPLE_RATE), (f) => progress.push(f))
    expect(mp3.type).toBe("audio/mpeg")
    expect(mp3.size).toBeGreaterThan(0)
    const head = new Uint8Array(await mp3.arrayBuffer()).subarray(0, 2)
    expect(head[0]).toBe(0xff)
    expect(head[1] & 0xe0).toBe(0xe0)
    expect(progress.at(-1)).toBe(1)
  })
})

describe("splitOnQuiet", () => {
  it("returns one window when the audio is shorter than the target", () => {
    expect(splitOnQuiet(new Float32Array(500), 100, 10)).toEqual([[0, 500]])
  })

  it("cuts at the quietest frame near the target and covers every sample", () => {
    const rate = 100
    const samples = new Float32Array(rate * 50).fill(0.5)
    // A quiet patch at 22 s, inside the 20 s ± 5 s search range.
    samples.fill(0, 22 * rate, 22 * rate + 10)
    const windows = splitOnQuiet(samples, rate, 20, 5)
    expect(windows[0][0]).toBe(0)
    expect(windows[0][1]).toBe(22 * rate + 5)
    for (let i = 1; i < windows.length; i++) expect(windows[i][0]).toBe(windows[i - 1][1])
    expect(windows.at(-1)![1]).toBe(samples.length)
  })
})

describe("speakAnnouncement", () => {
  it("decodes the voice's audio", async () => {
    const buffer = await speakAnnouncement("1AC")
    expect(buffer?.duration).toBe(1)
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({ text: "1 A C", provider: "kokoro" })
  })

  it("is null when the voice fails, answers with something other than audio, or cannot be decoded", async () => {
    ttsResponse = () => new Response("nope", { status: 503 })
    expect(await speakAnnouncement("1AC")).toBeNull()
    ttsResponse = () => new Response("{}", { headers: { "content-type": "application/json" } })
    expect(await speakAnnouncement("1AC")).toBeNull()
    ttsResponse = () => new Response(new Uint8Array([255]), { headers: { "content-type": "audio/wav" } })
    expect(await speakAnnouncement("1AC")).toBeNull()
  })
})

describe("transcribeWithMoonshine", () => {
  it("transcribes each window with speech and skips silent ones", async () => {
    const rate = 16000
    const samples = new Float32Array(rate * 30)
    samples.fill(0.3, 0, rate * 10)
    const progress: number[] = []
    const cues = await transcribeWithMoonshine(fakeBuffer(samples, rate), (f) => progress.push(f))
    expect(moonshine.loaded).toBe(1)
    expect(cues).toHaveLength(1)
    expect(cues[0]).toMatchObject({ start: 0, text: "words" })
    expect(progress.at(-1)).toBe(1)
  })

  it("drops windows the model returns nothing for", async () => {
    moonshine.generate.mockResolvedValueOnce("   ")
    const samples = new Float32Array(16000).fill(0.3)
    expect(await transcribeWithMoonshine(fakeBuffer(samples, 16000))).toEqual([])
  })
})

describe("joinRoundRecording", () => {
  it("refuses a round with nothing recorded", async () => {
    await expect(joinRoundRecording({ roundId: "r", items })).rejects.toThrow("Record at least one speech first.")
  })

  it("lays the recorded speeches end to end and builds the manifest", async () => {
    saveRecording("1AC", 2)
    saveRecording("1NC", 3)
    const stages = new Set<string>()
    const { mp3, manifest, vtt } = await joinRoundRecording({
      roundId: "round-1",
      items,
      previous: {
        videos: [
          { speechKey: "1AC", url: "a" },
          { speechKey: "CX1", url: "gone" },
        ],
      } as never,
      onProgress: (stage) => stages.add(stage),
    })
    expect(mp3.type).toBe("audio/mpeg")
    expect(vtt).toBeNull()
    expect(manifest).toMatchObject({
      version: 1,
      roundId: "round-1",
      processing: { announcements: false, captions: false, moonshine: false },
    })
    expect(manifest.speeches.map((s) => s.key)).toEqual(["1AC", "1NC"])
    expect(manifest.speeches[1].start).toBeGreaterThanOrEqual(manifest.speeches[0].start + 2)
    expect(manifest.durationSeconds).toBeGreaterThanOrEqual(5)
    expect(manifest.videos).toEqual([{ speechKey: "1AC", url: "a" }])
    expect([...stages]).toEqual(["loading", "mixing", "encoding"])
  })

  it("reads each speech's name before it when announcements are on", async () => {
    saveRecording("1AC", 2)
    const stages: string[] = []
    const { manifest } = await joinRoundRecording({
      roundId: "r",
      items,
      options: { announcements: true },
      onProgress: (stage) => stages.push(stage),
    })
    expect(stages).toContain("announcing")
    expect(manifest.processing.announcements).toBe(true)
    expect(manifest.speeches[0].announcementSeconds).toBe(1.5)
    expect(manifest.speeches[0].start).toBeGreaterThanOrEqual(1.5)
  })

  it("goes on without an announcement the voice could not give", async () => {
    saveRecording("1AC", 1)
    ttsResponse = () => new Response("down", { status: 500 })
    const { manifest } = await joinRoundRecording({ roundId: "r", items, options: { announcements: true } })
    expect(manifest.speeches[0].announcementSeconds ?? 0).toBe(0)
  })

  it("shifts the live captions onto the joined timeline", async () => {
    saveRecording("1AC", 2)
    saveRecording("1NC", 2)
    transcripts.set("1NC", { segments: [{ text: "Next off", start: 0.5, end: 1.5 }] })
    const { vtt, manifest } = await joinRoundRecording({ roundId: "r", items, options: { captions: true } })
    expect(manifest.processing).toMatchObject({ captions: true, moonshine: false })
    const second = manifest.speeches[1].start
    expect(vtt).toMatch(/^WEBVTT/)
    expect(vtt).toContain("Next off")
    expect(vtt).toContain(`00:00:0${(second + 0.5).toFixed(3)}`)
  })

  it("captions with Moonshine instead when asked", async () => {
    saveRecording("1AC", 2)
    const stages: string[] = []
    const { vtt, manifest } = await joinRoundRecording({
      roundId: "r",
      items,
      options: { moonshine: true, captions: true },
      onProgress: (stage) => stages.push(stage),
    })
    expect(stages).toContain("captioning")
    expect(manifest.processing).toEqual({ announcements: false, captions: true, moonshine: true })
    expect(vtt).toContain("words")
  })
})
