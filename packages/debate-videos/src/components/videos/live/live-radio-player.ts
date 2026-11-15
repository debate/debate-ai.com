/**
 * @fileoverview Plays a live round stream (`@debate-ai/timer`'s
 * `recorder/live-radio.ts`) radio style: its segments one after another
 * through two `<audio>` elements — one playing, the next one preloading — so
 * the hand-off between 5-second segments is as short as the browser allows.
 *
 * When playback catches up with a live stream it waits, and carries on the
 * moment new segments arrive ({@link LiveRadioPlayer.addSegments}). A segment
 * that fails to load is skipped. Framework-free so it can be tested with fake
 * audio elements; `useLiveRadio` wraps it for React.
 *
 * @module components/videos/live/live-radio-player
 */

import { liveSegmentUrl, pickTuneInSeq, type LiveSegment } from "@debate-ai/timer/src/recorder/live-radio"

/** The slice of HTMLAudioElement the player drives. */
export interface AudioLike {
  src: string
  preload: string
  paused: boolean
  play(): Promise<void> | void
  pause(): void
  addEventListener(type: "ended" | "error", listener: () => void): void
  removeEventListener(type: "ended" | "error", listener: () => void): void
}

export type LiveRadioPlayState = "idle" | "playing" | "waiting" | "paused" | "finished"

export interface LiveRadioSnapshot {
  state: LiveRadioPlayState
  /** The segment playing (or paused on), or null before the first play. */
  seq: number | null
  /** Its speech. */
  speech: string | null
}

export interface LiveRadioPlayerOptions {
  streamId: string
  createAudio: () => AudioLike
  onChange: (snapshot: LiveRadioSnapshot) => void
  segmentUrl?: (id: string, seq: number) => string
}

export class LiveRadioPlayer {
  private segments: LiveSegment[] = []
  private live = false
  private state: LiveRadioPlayState = "idle"
  private seq: number | null = null
  private readonly audios: [AudioLike, AudioLike]
  private active = 0
  /** Which seq each audio element holds, so a preloaded one is reused. */
  private loaded: [number | null, number | null] = [null, null]
  private readonly segmentUrl: (id: string, seq: number) => string
  private readonly handlers: Array<{ ended: () => void; error: () => void }>

  constructor(private readonly options: LiveRadioPlayerOptions) {
    this.segmentUrl = options.segmentUrl ?? ((id, seq) => liveSegmentUrl(id, seq))
    this.audios = [options.createAudio(), options.createAudio()]
    this.handlers = this.audios.map((audio, index) => {
      const ended = () => this.handleEnded(index)
      const error = () => this.handleError(index)
      audio.preload = "auto"
      audio.addEventListener("ended", ended)
      audio.addEventListener("error", error)
      return { ended, error }
    })
  }

  get snapshot(): LiveRadioSnapshot {
    return { state: this.state, seq: this.seq, speech: this.segmentAt(this.seq)?.speech ?? null }
  }

  /** Whether the stream is still being broadcast — decides between waiting and finishing at the end. */
  setLive(live: boolean): void {
    this.live = live
    if (!live && this.state === "waiting") this.set("finished", this.seq)
  }

  /** Adds newly fetched segments (any order, duplicates ignored); resumes a waiting player. */
  addSegments(segments: readonly LiveSegment[]): void {
    const known = new Set(this.segments.map((s) => s.seq))
    const fresh = segments.filter((s) => !known.has(s.seq))
    if (fresh.length === 0) return
    this.segments = [...this.segments, ...fresh].sort((a, b) => a.seq - b.seq)
    if (this.state === "waiting") {
      const next = this.nextSeq(this.seq)
      if (next !== null) this.playSeq(next)
    } else if (this.state === "playing") {
      this.preloadAfter(this.seq)
    }
  }

  /** Starts (from the tune-in point), or resumes where it paused. */
  play(): void {
    if (this.state === "playing" || this.state === "waiting") return
    if (this.state === "paused" && this.seq !== null) {
      this.set("playing", this.seq)
      void Promise.resolve(this.audios[this.active].play()).catch(() => this.set("paused", this.seq))
      return
    }
    if (this.segments.length === 0) {
      this.set(this.live ? "waiting" : "finished", null)
      return
    }
    const start = this.state === "finished" || this.seq === null ? pickTuneInSeq(this.segments, this.live) : this.seq
    this.playSeq(this.state === "finished" ? this.segments[0].seq : start)
  }

  pause(): void {
    if (this.state !== "playing" && this.state !== "waiting") return
    this.audios[this.active].pause()
    this.set("paused", this.seq)
  }

  /** Jumps to a segment (a speech's first, from the chapter list). */
  jumpTo(seq: number): void {
    if (!this.segmentAt(seq)) return
    this.playSeq(seq)
  }

  /** Jumps to the newest speech of a live stream. */
  goLive(): void {
    if (this.segments.length === 0) return
    this.playSeq(pickTuneInSeq(this.segments, true))
  }

  destroy(): void {
    this.audios.forEach((audio, index) => {
      audio.removeEventListener("ended", this.handlers[index].ended)
      audio.removeEventListener("error", this.handlers[index].error)
      audio.pause()
      audio.src = ""
    })
  }

  private segmentAt(seq: number | null): LiveSegment | undefined {
    return seq === null ? undefined : this.segments.find((s) => s.seq === seq)
  }

  private nextSeq(after: number | null): number | null {
    const next = this.segments.find((s) => after === null || s.seq > after)
    return next ? next.seq : null
  }

  private set(state: LiveRadioPlayState, seq: number | null): void {
    this.state = state
    this.seq = seq
    this.options.onChange(this.snapshot)
  }

  private load(index: number, seq: number): void {
    if (this.loaded[index] === seq) return
    this.loaded[index] = seq
    this.audios[index].src = this.segmentUrl(this.options.streamId, seq)
  }

  private preloadAfter(seq: number | null): void {
    const next = this.nextSeq(seq)
    if (next !== null) this.load(1 - this.active, next)
  }

  private playSeq(seq: number): void {
    this.audios[this.active].pause()
    // Use the element that already holds this segment, if the preload did.
    const index = this.loaded[1 - this.active] === seq ? 1 - this.active : this.active
    this.active = index
    this.load(index, seq)
    this.set("playing", seq)
    void Promise.resolve(this.audios[index].play()).catch(() => {
      // Autoplay refused (no user gesture yet): show as paused, ready to resume.
      if (this.seq === seq && this.state === "playing") this.set("paused", seq)
    })
    this.preloadAfter(seq)
  }

  private advance(): void {
    const next = this.nextSeq(this.seq)
    if (next !== null) this.playSeq(next)
    else this.set(this.live ? "waiting" : "finished", this.seq)
  }

  private handleEnded(index: number): void {
    if (index === this.active && this.state === "playing") this.advance()
  }

  private handleError(index: number): void {
    // A failed preload is forgotten and loaded again when it's reached;
    // the playing segment failing skips to the next one.
    if (index !== this.active) {
      this.loaded[index] = null
      return
    }
    if (this.state !== "playing" || this.loaded[index] !== this.seq) return
    this.loaded[index] = null
    this.advance()
  }
}
