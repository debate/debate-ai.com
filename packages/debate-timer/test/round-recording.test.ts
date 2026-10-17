import { describe, expect, it } from "vitest"
import {
  adjustSpeechStart,
  announcementText,
  effectiveStarts,
  formatClock,
  layoutJoinedSpeeches,
  parseClock,
  shiftSpeechCaptions,
  speechAtTime,
  toWebVtt,
  type RoundRecordingManifest,
} from "../src/recorder/round-recording"
import { splitOnQuiet, toInt16 } from "../src/recorder/round-recording-audio"
import { safeFileName } from "../src/recorder/round-recording-cloud"

describe("layoutJoinedSpeeches", () => {
  it("lays speeches end to end with a gap", () => {
    const { speeches, durationSeconds } = layoutJoinedSpeeches(
      [
        { key: "1AC", label: "1AC", duration: 480 },
        { key: "1NC", label: "1NC", duration: 470 },
      ],
      1,
    )
    expect(speeches.map((s) => s.start)).toEqual([0, 481])
    expect(durationSeconds).toBe(951)
  })

  it("starts each speech after its announcement", () => {
    const { speeches } = layoutJoinedSpeeches(
      [
        { key: "1AC", label: "1AC", duration: 10, announcementSeconds: 2 },
        { key: "1NC", label: "1NC", duration: 10, announcementSeconds: 2 },
      ],
      1,
    )
    expect(speeches.map((s) => s.start)).toEqual([2, 15])
  })
})

function manifest(): RoundRecordingManifest {
  return {
    version: 1,
    roundId: "1",
    createdAt: "",
    durationSeconds: 100,
    speeches: [
      { key: "1AC", label: "1AC", start: 0, duration: 40 },
      { key: "1NC", label: "1NC", start: 41, duration: 59 },
    ],
    processing: { announcements: false, captions: false, moonshine: false },
    videos: [],
  }
}

describe("speech starts", () => {
  it("prefers adjusted starts and clamps them into the recording", () => {
    let m = adjustSpeechStart(manifest(), "1NC", 45)
    expect(effectiveStarts(m)).toEqual({ "1AC": 0, "1NC": 45 })
    m = adjustSpeechStart(m, "1NC", 500)
    expect(effectiveStarts(m)["1NC"]).toBe(100)
    m = adjustSpeechStart(m, "1NC", null)
    expect(effectiveStarts(m)["1NC"]).toBe(41)
  })

  it("finds the speech playing at a time", () => {
    const starts = { "1AC": 2, "1NC": 41 }
    expect(speechAtTime(starts, 1)).toBeNull()
    expect(speechAtTime(starts, 40)).toBe("1AC")
    expect(speechAtTime(starts, 41)).toBe("1NC")
  })
})

describe("clock text", () => {
  it("formats and parses times", () => {
    expect(formatClock(65)).toBe("1:05")
    expect(formatClock(3725)).toBe("1:02:05")
    expect(parseClock("1:05")).toBe(65)
    expect(parseClock("1:02:05")).toBe(3725)
    expect(parseClock("42")).toBe(42)
    expect(parseClock("1:xx")).toBeNull()
  })
})

describe("captions", () => {
  it("shifts each speech's segments to its place in the joined recording", () => {
    const cues = shiftSpeechCaptions([
      { start: 0, duration: 10, segments: [{ text: "hello", start: 1, end: 3 }] },
      { start: 11, duration: 10, segments: [{ text: "world", start: 0, end: 2 }, { text: "late", start: 12, end: 14 }] },
    ])
    expect(cues).toEqual([
      { start: 1, end: 3, text: "hello" },
      { start: 11, end: 13, text: "world" },
    ])
  })

  it("writes WebVTT", () => {
    const vtt = toWebVtt([{ start: 61.5, end: 63, text: "hi" }])
    expect(vtt).toContain("WEBVTT")
    expect(vtt).toContain("00:01:01.500 --> 00:01:03.000")
  })

  it("spells out speech codes for the announcer", () => {
    expect(announcementText("1AC")).toBe("1 A C")
    expect(announcementText("Pro Summary")).toBe("Pro Summary")
  })
})

describe("audio helpers", () => {
  it("cuts windows at the quietest point near the target", () => {
    const rate = 100
    const samples = new Float32Array(rate * 50).fill(0.5)
    // A silent stretch at 22 s.
    samples.fill(0, 22 * rate, 22 * rate + 10)
    const windows = splitOnQuiet(samples, rate, 20, 5)
    expect(windows[0][0]).toBe(0)
    expect(windows[0][1]).toBeGreaterThanOrEqual(22 * rate)
    expect(windows[0][1]).toBeLessThanOrEqual(22 * rate + 10)
    expect(windows.at(-1)?.[1]).toBe(samples.length)
  })

  it("converts float samples to 16-bit PCM", () => {
    expect(Array.from(toInt16(new Float32Array([0, 1, -1, 2])))).toEqual([0, 32767, -32768, 32767])
  })

  it("makes upload names safe", () => {
    expect(safeFileName("video-1AC-Jane Doe.webm")).toBe("video-1AC-Jane-Doe.webm")
  })
})
