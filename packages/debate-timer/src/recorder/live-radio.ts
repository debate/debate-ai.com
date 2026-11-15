/**
 * @fileoverview Live round radio: a round with **Live stream** on broadcasts
 * the speaker's voice while their speech timer runs, as short self-contained
 * audio segments, and anyone can tune in from the video library — live, or as
 * a replay afterwards.
 *
 * This module is the shared protocol: the stream id a round gets, the
 * `/api/live-rounds` shapes, where a listener joins a stream, and the
 * segmented recorder the broadcaster uses. The broadcaster (deciding *who*
 * goes on air) is `@debate-ai/round`'s `round/live-broadcast.ts`; the
 * listener is `@debate-ai/videos`' `components/videos/live/`; the server is
 * the app's `/api/live-rounds` (`lib/live-rounds/`).
 *
 * Why segments and not one long recording: a MediaRecorder's timeslice chunks
 * after the first have no container header and can't be played on their own.
 * Restarting the recorder every few seconds gives files that each decode
 * alone, so a listener can join mid-speech and play them one after another,
 * radio style, with nothing but an `<audio>` element.
 *
 * @module recorder/live-radio
 */

/** The API that stores and serves live round streams. */
export const LIVE_ROUNDS_ENDPOINT = "/api/live-rounds"

/** Length of one broadcast segment. Shorter = closer to live, more requests. */
export const LIVE_SEGMENT_MS = 5_000

/** Bitrate of the broadcast — speech only, so 32 kbps Opus is plenty (~4 MB/15 min). */
export const LIVE_AUDIO_BITS_PER_SECOND = 32_000

/** A segment newer than this means someone is speaking right now. */
export const ON_AIR_WINDOW_MS = 20_000

/** Largest segment the server takes (a 5 s segment is ~20 KB; this is generous). */
export const MAX_LIVE_SEGMENT_BYTES = 2 * 1024 * 1024

/** Stream ids: lowercase letters, digits and dashes, from the round's slug. */
const STREAM_ID = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/

export function isLiveStreamId(value: unknown): value is string {
  return typeof value === "string" && STREAM_ID.test(value)
}

/**
 * The stream id of a round: its slug ("2025-glenbrooks/lynbrook-bz-monta-ey")
 * flattened to "2025-glenbrooks-lynbrook-bz-monta-ey". Every participant opens
 * the round at the same `/debate/<slug>` link, so they all land on the same
 * stream. Null when the round has no usable slug.
 */
export function liveStreamIdForSlug(slug: string | null | undefined): string | null {
  const id = (slug ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "")
  return isLiveStreamId(id) ? id : null
}

/** Whether a stream is broadcasting, finished, or switched off by its round. */
export type LiveStreamStatus = "live" | "ended" | "off"

/** One stream as the video library lists it. */
export interface LiveRoundSummary {
  id: string
  title: string
  tournamentName: string
  roundLevel: string
  /** Aff and neg team labels as typed in the round (schools or debaters). */
  aff: string
  neg: string
  status: LiveStreamStatus
  /** The speech heard most recently, when a segment arrived within {@link ON_AIR_WINDOW_MS}. */
  onAirSpeech: string | null
  segmentCount: number
  /** Total broadcast audio, in milliseconds. */
  durationMs: number
  /** ISO time of the stream's creation and last change. */
  createdAt: string
  updatedAt: string
}

/** One stored segment of a stream. */
export interface LiveSegment {
  seq: number
  /** Speech name it belongs to ("1AC", "Aff Constructive"…). */
  speech: string
  durationMs: number
  /** ISO time it was received. */
  createdAt: string
}

/** `GET /api/live-rounds?id=…` — the stream and its segments after `after`. */
export interface LiveRoundDetail {
  stream: LiveRoundSummary
  segments: LiveSegment[]
}

/** What the round tells the server when Live stream is switched on or off. */
export interface LiveRoundRegistration {
  /** The round's slug; the server derives the stream id from it. */
  slug: string
  title: string
  tournamentName: string
  roundLevel: string
  aff: string
  neg: string
  /** Debater entries (emails or names) — the only accounts that may broadcast. */
  debaters: string[]
  /** Judges and spectators — with debaters, the only listeners of a private round. */
  invitees: string[]
  isPrivate: boolean
  enabled: boolean
}

/** The URL a segment streams from. */
export function liveSegmentUrl(id: string, seq: number, endpoint = LIVE_ROUNDS_ENDPOINT): string {
  return `${endpoint}/segment?id=${encodeURIComponent(id)}&seq=${seq}`
}

/** The library page that plays one stream. */
export function liveRoundPagePath(id: string): string {
  return `/videos/live/${encodeURIComponent(id)}`
}

/**
 * Where a listener starts. A replay starts at the top. A live stream starts at
 * the beginning of the speech being given right now — so a listener hears the
 * speech they tuned into from its first word, a few seconds behind live, rather
 * than joining mid-sentence; between speeches it starts at the newest segment.
 */
export function pickTuneInSeq(segments: readonly LiveSegment[], live: boolean): number {
  if (segments.length === 0) return 0
  if (!live) return segments[0].seq
  const last = segments[segments.length - 1]
  let start = segments.length - 1
  while (start > 0 && segments[start - 1].speech === last.speech) start--
  return segments[start].seq
}

/** The first segment of each speech, in broadcast order — the replay's chapter list. */
export function speechChapters(segments: readonly LiveSegment[]): Array<{ speech: string; seq: number }> {
  const chapters: Array<{ speech: string; seq: number }> = []
  for (const segment of segments) {
    if (chapters[chapters.length - 1]?.speech !== segment.speech) chapters.push({ speech: segment.speech, seq: segment.seq })
  }
  return chapters
}

/** "12:05" from milliseconds. */
export function formatBroadcastLength(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`
}

/** The Opus/WebM type the browser can record, else whatever it defaults to. */
export function pickLiveMimeType(isSupported: (type: string) => boolean): string | undefined {
  for (const type of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"]) {
    try {
      if (isSupported(type)) return type
    } catch {
      // keep looking
    }
  }
  return undefined
}

/** A finished segment, ready to upload. */
export interface RecordedSegment {
  blob: Blob
  durationMs: number
}

/** Just the MediaRecorder surface the segmenter drives, so tests can fake it. */
export interface SegmentRecorderLike {
  state: string
  mimeType?: string
  ondataavailable: ((event: { data: Blob }) => void) | null
  onstop: (() => void) | null
  start(): void
  stop(): void
}

export interface SegmentedRecorderOptions {
  /** Builds a recorder on the shared mic stream. */
  createRecorder: () => SegmentRecorderLike
  /** Called with each finished segment, in order. */
  onSegment: (segment: RecordedSegment) => void
  segmentMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

/**
 * Records one microphone stream as back-to-back self-contained segments:
 * a recorder runs for `segmentMs`, stops (emitting its file) and a fresh one
 * starts at once. `stop()` ends the current segment early and emits it.
 */
export class SegmentedRecorder {
  private recorder: SegmentRecorderLike | null = null
  private timer: unknown = null
  private running = false
  private readonly segmentMs: number
  private readonly now: () => number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void

  constructor(private readonly options: SegmentedRecorderOptions) {
    this.segmentMs = options.segmentMs ?? LIVE_SEGMENT_MS
    this.now = options.now ?? (() => Date.now())
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  get isRunning(): boolean {
    return this.running
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.next()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timer !== null) this.clearTimer(this.timer)
    this.timer = null
    const recorder = this.recorder
    this.recorder = null
    if (recorder && recorder.state !== "inactive") recorder.stop()
  }

  private next(): void {
    if (!this.running) return
    const recorder = this.options.createRecorder()
    const chunks: Blob[] = []
    const startedAt = this.now()
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      const durationMs = Math.max(0, this.now() - startedAt)
      if (chunks.length > 0) {
        const type = recorder.mimeType || chunks[0].type || "audio/webm"
        this.options.onSegment({ blob: new Blob(chunks, { type }), durationMs })
      }
    }
    this.recorder = recorder
    recorder.start()
    this.timer = this.setTimer(() => {
      this.timer = null
      const current = this.recorder
      // Start the next file first so the gap between segments is as short as possible.
      this.recorder = null
      this.next()
      if (current && current.state !== "inactive") current.stop()
    }, this.segmentMs)
  }
}

/**
 * Uploads segments strictly one at a time, in the order they were recorded —
 * the server numbers them on arrival, so order on the wire is order on air.
 * A failed upload is retried twice, then dropped so the stream keeps going.
 */
export class SegmentUploadQueue {
  private chain: Promise<void> = Promise.resolve()
  private failures = 0

  constructor(private readonly upload: (segment: RecordedSegment & { speech: string }) => Promise<void>) {}

  /** Segments that were given up on after retries. */
  get failed(): number {
    return this.failures
  }

  push(segment: RecordedSegment & { speech: string }): Promise<void> {
    this.chain = this.chain.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.upload(segment)
          return
        } catch {
          // retry
        }
      }
      this.failures++
    })
    return this.chain
  }

  /** Resolves once everything queued so far has been sent (or given up on). */
  drain(): Promise<void> {
    return this.chain
  }
}

/** Sends one segment to the stream. Throws on a non-2xx answer. */
export async function uploadLiveSegment(
  id: string,
  segment: RecordedSegment & { speech: string },
  endpoint = LIVE_ROUNDS_ENDPOINT,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const url = `${endpoint}?id=${encodeURIComponent(id)}&speech=${encodeURIComponent(segment.speech)}&durationMs=${Math.round(segment.durationMs)}`
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": (segment.blob.type || "audio/webm").split(";")[0] },
    body: segment.blob,
  })
  const data = (await res.json().catch(() => ({}))) as { seq?: number; error?: string }
  if (!res.ok || typeof data.seq !== "number") throw new Error(data.error ?? `Segment upload failed (${res.status}).`)
  return data.seq
}

/** Switches a round's stream on or off. Never throws; returns the stream id or null. */
export async function registerLiveRound(
  registration: LiveRoundRegistration,
  endpoint = LIVE_ROUNDS_ENDPOINT,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registration),
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return isLiveStreamId(data.id) ? data.id : null
  } catch {
    return null
  }
}

/** Reads one stream (and its segments after `after`), or null when it can't be read. */
export async function fetchLiveRound(
  id: string,
  after = -1,
  endpoint = LIVE_ROUNDS_ENDPOINT,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveRoundDetail | null> {
  try {
    const res = await fetchImpl(`${endpoint}?id=${encodeURIComponent(id)}&after=${after}`, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as LiveRoundDetail
  } catch {
    return null
  }
}

/** Lists the public streams for the library: live ones first, then replays. */
export async function fetchLiveRounds(
  endpoint = LIVE_ROUNDS_ENDPOINT,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveRoundSummary[]> {
  try {
    const res = await fetchImpl(endpoint, { cache: "no-store" })
    if (!res.ok) return []
    const data = (await res.json()) as { streams?: LiveRoundSummary[] }
    return Array.isArray(data.streams) ? data.streams : []
  } catch {
    return []
  }
}
