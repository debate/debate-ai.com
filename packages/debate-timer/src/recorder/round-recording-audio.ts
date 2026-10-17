/// <reference path="./moonshine-js.d.ts" />
/**
 * @fileoverview Builds the joined round MP3 in the browser: decodes every
 * speech recording the timer saved (`debate-recording-{speech}`), lays them
 * end to end (optionally each after a Kokoro voice reading the speech's
 * name), encodes one MP3, and makes captions for it — from what the browser
 * heard while recording, or by transcribing the joined audio with Moonshine
 * on this device.
 *
 * Nothing here uploads; `round-recording-cloud.ts` does that, when the user
 * asks.
 *
 * @module recorder/round-recording-audio
 */

import {
  announcementText,
  layoutJoinedSpeeches,
  shiftSpeechCaptions,
  toWebVtt,
  type CaptionCue,
  type RoundRecordingManifest,
  type SpeechStartItem,
} from "./round-recording"
import { loadSpokenTranscript } from "./spoken-words-store"

/** Optional processing when joining. */
export interface JoinOptions {
  /** Read each speech's name in a Kokoro voice before it. */
  announcements?: boolean
  /** Captions from the browser's live transcription of each speech. */
  captions?: boolean
  /** Captions from transcribing the joined MP3 with Moonshine, on this device (replaces `captions`). */
  moonshine?: boolean
}

export interface JoinResult {
  mp3: Blob
  manifest: RoundRecordingManifest
  /** WebVTT captions, when captions or Moonshine were asked for and produced any. */
  vtt: string | null
}

/** Sample rate of the joined MP3 — plenty for speech, and keeps an hour-long round near 30 MB. */
export const JOINED_SAMPLE_RATE = 32000
const MP3_KBPS = 64
/** Moonshine works on 16 kHz mono windows of up to about 30 s. */
const MOONSHINE_RATE = 16000

/** The data URL the recorder saved for a speech, or null. */
function savedRecordingAudio(speechKey: string): string | null {
  try {
    const raw = localStorage.getItem(`debate-recording-${speechKey}`)
    return raw ? ((JSON.parse(raw) as { audio?: string }).audio ?? null) : null
  } catch {
    return null
  }
}

/** Speeches with a saved recording, in round order. */
export function recordedSpeeches(items: SpeechStartItem[]): SpeechStartItem[] {
  return items.filter((item) => savedRecordingAudio(item.key) !== null)
}

async function decode(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(data)
  } finally {
    void ctx.close()
  }
}

async function dataUrlBytes(url: string): Promise<ArrayBuffer> {
  return (await fetch(url)).arrayBuffer()
}

/**
 * A speech's name read aloud by the site's Kokoro voice (`POST /api/tts`), or
 * null when no voice answered — the join goes on without it.
 */
export async function speakAnnouncement(label: string, endpoint = "/api/tts"): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: announcementText(label), provider: "kokoro", voice: "af_heart" }),
    })
    if (!res.ok || !/^audio\//i.test(res.headers.get("content-type") ?? "")) return null
    return await decode(await res.arrayBuffer())
  } catch {
    return null
  }
}

/** Mixes buffers into one mono buffer at `sampleRate`, each starting at its `at` second. */
async function renderMono(
  parts: Array<{ buffer: AudioBuffer; at: number }>,
  durationSeconds: number,
  sampleRate: number,
): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(durationSeconds * sampleRate))
  const offline = new OfflineAudioContext(1, length, sampleRate)
  for (const { buffer, at } of parts) {
    const source = offline.createBufferSource()
    source.buffer = buffer
    source.connect(offline.destination)
    source.start(at)
  }
  return offline.startRendering()
}

/** Float samples (-1…1) as 16-bit PCM. */
export function toInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/** Encodes a mono buffer as MP3, yielding between blocks so the page stays responsive. */
export async function encodeMp3(buffer: AudioBuffer, onProgress?: (fraction: number) => void): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs")
  const encoder = new Mp3Encoder(1, buffer.sampleRate, MP3_KBPS)
  const pcm = toInt16(buffer.getChannelData(0))
  const chunks: Uint8Array[] = []
  // A multiple of the 1152-sample MP3 frame.
  const block = 1152 * 64
  for (let i = 0; i < pcm.length; i += block) {
    const out = encoder.encodeBuffer(pcm.subarray(i, i + block))
    if (out.length) chunks.push(new Uint8Array(out))
    onProgress?.(Math.min(1, (i + block) / pcm.length))
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  const tail = encoder.flush()
  if (tail.length) chunks.push(new Uint8Array(tail))
  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" })
}

/**
 * Cuts audio into windows of about `targetSeconds`, ending each at the
 * quietest 100 ms within `slackSeconds` of the target so words aren't split.
 * Returns `[startSample, endSample)` pairs covering every sample.
 */
export function splitOnQuiet(
  samples: Float32Array,
  sampleRate: number,
  targetSeconds = 20,
  slackSeconds = 5,
): Array<[number, number]> {
  const frame = Math.max(1, Math.round(sampleRate / 10))
  const windows: Array<[number, number]> = []
  let start = 0
  while (start < samples.length) {
    const target = start + Math.round(targetSeconds * sampleRate)
    if (target >= samples.length) {
      windows.push([start, samples.length])
      break
    }
    const from = Math.max(start + frame, target - Math.round(slackSeconds * sampleRate))
    const to = Math.min(samples.length - frame, target + Math.round(slackSeconds * sampleRate))
    let cut = target
    let quietest = Infinity
    for (let at = from; at <= to; at += frame) {
      let energy = 0
      for (let i = at; i < at + frame; i++) energy += samples[i] * samples[i]
      if (energy < quietest) {
        quietest = energy
        cut = at + (frame >> 1)
      }
    }
    windows.push([start, cut])
    start = cut
  }
  return windows
}

/** Rough check for a window with no speech in it, which Moonshine would hallucinate over. */
function isSilent(samples: Float32Array): boolean {
  let energy = 0
  for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i]
  return Math.sqrt(energy / Math.max(1, samples.length)) < 0.005
}

/**
 * Transcribes a buffer with Moonshine on this device, window by window.
 * The model (tens of MB) downloads from Moonshine's CDN the first time.
 */
export async function transcribeWithMoonshine(
  buffer: AudioBuffer,
  onProgress?: (fraction: number) => void,
): Promise<CaptionCue[]> {
  const mono16k = await renderMono([{ buffer, at: 0 }], buffer.duration, MOONSHINE_RATE)
  const samples = mono16k.getChannelData(0)
  const { MoonshineModel } = await import("@moonshine-ai/moonshine-js")
  const model = new MoonshineModel("model/base")
  await model.loadModel()
  const windows = splitOnQuiet(samples, MOONSHINE_RATE)
  const cues: CaptionCue[] = []
  for (let i = 0; i < windows.length; i++) {
    const [from, to] = windows[i]
    const slice = samples.subarray(from, to)
    if (!isSilent(slice)) {
      const text = (await model.generate(slice)).trim()
      if (text) cues.push({ start: from / MOONSHINE_RATE, end: to / MOONSHINE_RATE, text })
    }
    onProgress?.((i + 1) / windows.length)
  }
  return cues
}

/** What the join is doing, for the dialog's progress line. */
export type JoinStage = "loading" | "announcing" | "mixing" | "encoding" | "captioning"

/**
 * Joins every recorded speech of a round into one MP3, in round order.
 *
 * @param items - The round's speeches in order; ones with no recording are skipped.
 * @throws When no speech of the round has a recording.
 */
export async function joinRoundRecording({
  roundId,
  items,
  options = {},
  previous,
  onProgress,
}: {
  roundId: string
  items: SpeechStartItem[]
  options?: JoinOptions
  /** The last manifest for the round, so webcam clips carry over. */
  previous?: RoundRecordingManifest | null
  onProgress?: (stage: JoinStage, fraction: number) => void
}): Promise<JoinResult> {
  const recorded = recordedSpeeches(items)
  if (recorded.length === 0) throw new Error("Record at least one speech first.")

  const decoded: Array<{ item: SpeechStartItem; buffer: AudioBuffer; announcement: AudioBuffer | null }> = []
  for (let i = 0; i < recorded.length; i++) {
    const item = recorded[i]
    onProgress?.("loading", i / recorded.length)
    const buffer = await decode(await dataUrlBytes(savedRecordingAudio(item.key) as string))
    let announcement: AudioBuffer | null = null
    if (options.announcements) {
      onProgress?.("announcing", i / recorded.length)
      announcement = await speakAnnouncement(item.label)
    }
    decoded.push({ item, buffer, announcement })
  }

  const layout = layoutJoinedSpeeches(
    decoded.map(({ item, buffer, announcement }) => ({
      ...item,
      duration: buffer.duration,
      // Half a second after the name, before the speaker starts.
      ...(announcement ? { announcementSeconds: announcement.duration + 0.5 } : {}),
    })),
  )

  onProgress?.("mixing", 0)
  const parts = decoded.flatMap(({ buffer, announcement }, i) => {
    const speech = layout.speeches[i]
    const out = [{ buffer, at: speech.start }]
    if (announcement && speech.announcementSeconds) out.push({ buffer: announcement, at: speech.start - speech.announcementSeconds })
    return out
  })
  const joined = await renderMono(parts, layout.durationSeconds, JOINED_SAMPLE_RATE)

  onProgress?.("encoding", 0)
  const mp3 = await encodeMp3(joined, (f) => onProgress?.("encoding", f))

  let cues: CaptionCue[] = []
  if (options.moonshine) {
    onProgress?.("captioning", 0)
    cues = await transcribeWithMoonshine(joined, (f) => onProgress?.("captioning", f))
  } else if (options.captions) {
    cues = shiftSpeechCaptions(
      layout.speeches.map((speech) => ({
        start: speech.start,
        duration: speech.duration,
        segments: loadSpokenTranscript(speech.key)?.segments ?? [],
      })),
    )
  }

  const keys = new Set(layout.speeches.map((s) => s.key))
  const manifest: RoundRecordingManifest = {
    version: 1,
    roundId,
    createdAt: new Date().toISOString(),
    durationSeconds: layout.durationSeconds,
    speeches: layout.speeches,
    processing: {
      announcements: !!options.announcements,
      captions: !!options.captions || !!options.moonshine,
      moonshine: !!options.moonshine,
    },
    // Re-joining moves every speech, so earlier adjustments no longer apply.
    videos: (previous?.videos ?? []).filter((clip) => keys.has(clip.speechKey)),
  }
  return { mp3, manifest, vtt: cues.length ? toWebVtt(cues) : null }
}
