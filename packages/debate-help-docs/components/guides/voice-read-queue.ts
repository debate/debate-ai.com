/**
 * @file voice-read-queue.ts
 * @description The audio behind the Synergy Slayer "Voice" button
 * (`voice-read-button.tsx`): every paragraph of the page is voiced by two
 * engines racing each other, and the first to answer wins that paragraph.
 *
 * - **Kokoro in the browser** works through the whole page in order, one
 *   Kokoro-sized piece (`speechChunks`) at a time, running up to
 *   `kokoroAhead` paragraphs ahead of the one playing, so it is fed all the
 *   text and never sits idle while a clip plays.
 * - **Cloudflare Workers AI** (`/api/tts`, Deepgram Aura) is asked for the
 *   paragraph playing and the next `cloudAhead`, one request per paragraph.
 *
 * - **The shared cache** (`cached`, R2 behind `/api/tts/cache`) is asked
 *   first for each paragraph Cloudflare would be asked for. A hit plays at
 *   once and neither engine works on that paragraph; a miss hands it to
 *   Cloudflare as before. Kokoro, meanwhile, makes whole paragraphs (the
 *   button passes `kokoroChunks: (t) => [t]`) so each finished one can be
 *   uploaded to that cache for the next reader.
 *
 * A paragraph belongs to whichever engine delivers audio for it first; the
 * other's work on it is dropped (Kokoro skips it, Cloudflare's request is
 * aborted). When an engine fails it is out for the rest of the page, and a
 * paragraph neither engine could voice is handed back as `missing` text so
 * the button speaks it with the browser's voice: nothing is skipped.
 */

export type VoiceSource = "kokoro" | "cloudflare" | "cache"

/** One clip and the text it speaks (for the browser fallback when it won't play). */
export interface VoiceClip {
  blob: Blob
  text: string
  source: VoiceSource
}

export interface VoiceEngines {
  /** One Kokoro clip for a piece of at most Kokoro's size; throws when Kokoro can't. Null: no Kokoro. */
  kokoro: ((text: string) => Promise<Blob>) | null
  /** `text` cut into Kokoro-sized pieces. */
  kokoroChunks: (text: string) => string[]
  /** Cloudflare's speech for a whole paragraph, or null when it gave none. Null: no Cloudflare. */
  cloud: ((text: string, signal: AbortSignal) => Promise<Blob | null>) | null
  /** A paragraph someone already voiced, from the shared cache, or null on a miss. Omitted: no cache. */
  cached?: ((text: string, signal: AbortSignal) => Promise<Blob | null>) | null
}

export interface VoiceQueueOptions {
  /** Paragraphs Kokoro may run ahead of the one playing. */
  kokoroAhead?: number
  /** Paragraphs past the one playing that Cloudflare is asked for. */
  cloudAhead?: number
}

/** One paragraph's audio as it arrives. */
export class VoiceUnit {
  source: VoiceSource | null = null
  readonly clips: VoiceClip[] = []
  /** Text no engine voiced, for the browser's speech. */
  readonly missing: string[] = []
  done = false
  kokoroOut = false
  cloudOut = false
  cloudStarted = false
  readonly cloudController = new AbortController()
  private waiters: Array<() => void> = []

  constructor(readonly text: string) {}

  /** Who voices the paragraph (read fresh, after an await). */
  owner(): VoiceSource | null {
    return this.source
  }

  /** Claims the paragraph for `source`; false when the other engine has it. */
  claim(source: VoiceSource): boolean {
    if (this.done && this.source !== source) return false
    if (this.source && this.source !== source) return false
    if (!this.source) {
      this.source = source
      if (source === "kokoro") this.cloudController.abort()
    }
    return true
  }

  push(clip: VoiceClip): void {
    this.clips.push(clip)
    this.notify()
  }

  finish(): void {
    if (this.done) return
    this.done = true
    this.notify()
  }

  /** An engine gave up on this paragraph; when both have and neither voiced it, its text is missing. */
  out(source: VoiceSource): void {
    if (source === "kokoro") this.kokoroOut = true
    else this.cloudOut = true
    if (!this.source && this.kokoroOut && this.cloudOut && !this.done) {
      this.missing.push(this.text)
      this.finish()
    }
  }

  private notify(): void {
    const waiters = this.waiters
    this.waiters = []
    waiters.forEach((wake) => wake())
  }

  /** The clips in order as they arrive, ending when the paragraph is done or `signal` aborts. */
  async *read(signal: AbortSignal): AsyncGenerator<VoiceClip, void, void> {
    let next = 0
    while (!signal.aborted) {
      if (next < this.clips.length) {
        yield this.clips[next++]!
        continue
      }
      if (this.done) return
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve)
        signal.addEventListener("abort", () => resolve(), { once: true })
      })
    }
  }
}

/** Voices `texts` (one per paragraph) with both engines; see the module doc. */
export class VoiceQueue {
  readonly units: VoiceUnit[]
  private playingIndex = 0
  private windowWaiters: Array<() => void> = []
  private cloudDead = false
  private cloudWorked = false
  private readonly kokoroAhead: number
  private readonly cloudAhead: number

  constructor(
    texts: string[],
    private readonly engines: VoiceEngines,
    private readonly signal: AbortSignal,
    options: VoiceQueueOptions = {},
  ) {
    this.units = texts.map((text) => new VoiceUnit(text))
    this.kokoroAhead = options.kokoroAhead ?? 6
    this.cloudAhead = options.cloudAhead ?? 3
    if (!engines.kokoro) this.units.forEach((unit) => unit.out("kokoro"))
    if (!engines.cloud) {
      this.cloudDead = true
      // With a cache, a paragraph is only out of Cloudflare's hands once the cache missed too.
      if (!engines.cached) this.units.forEach((unit) => unit.out("cloudflare"))
    }
    signal.addEventListener("abort", () => {
      this.units.forEach((unit) => unit.cloudController.abort())
      this.wakeWindow()
    })
  }

  /** Starts Kokoro on the whole page and Cloudflare on the first paragraphs. */
  start(): void {
    if (this.engines.kokoro) void this.runKokoro(this.engines.kokoro)
    this.playing(0)
  }

  /** The player moved on to paragraph `index`. */
  playing(index: number): void {
    this.playingIndex = index
    this.wakeWindow()
    for (let i = index; i <= Math.min(this.units.length - 1, index + this.cloudAhead); i++) this.startCloud(i)
  }

  private wakeWindow(): void {
    const waiters = this.windowWaiters
    this.windowWaiters = []
    waiters.forEach((wake) => wake())
  }

  /** Waits until Kokoro may work on paragraph `index` (or the reading stops). */
  private async inWindow(index: number): Promise<void> {
    while (!this.signal.aborted && index > this.playingIndex + this.kokoroAhead) {
      await new Promise<void>((resolve) => this.windowWaiters.push(resolve))
    }
  }

  private async runKokoro(generate: (text: string) => Promise<Blob>): Promise<void> {
    for (let i = 0; i < this.units.length; i++) {
      await this.inWindow(i)
      if (this.signal.aborted) return
      const unit = this.units[i]!
      if (unit.source === "cloudflare" || unit.done) continue
      const pieces = this.engines.kokoroChunks(unit.text)
      for (let p = 0; p < pieces.length; p++) {
        if (this.signal.aborted) return
        if (unit.owner() === "cloudflare") break
        let blob: Blob
        try {
          blob = await generate(pieces[p]!)
        } catch (error) {
          if (this.signal.aborted) return
          console.warn("[voice] Kokoro stopped; Cloudflare or the browser reads the rest.", error)
          // Kokoro is out for the rest of the page.
          if (unit.source === "kokoro") {
            unit.missing.push(pieces.slice(p).join(" "))
            unit.finish()
          } else {
            unit.out("kokoro")
          }
          for (let j = i + 1; j < this.units.length; j++) this.units[j]!.out("kokoro")
          return
        }
        if (this.signal.aborted) return
        if (!unit.claim("kokoro")) break
        unit.push({ blob, text: pieces[p]!, source: "kokoro" })
      }
      if (unit.source === "kokoro") unit.finish()
      else if (unit.source === null) unit.out("kokoro")
    }
  }

  private startCloud(index: number): void {
    const unit = this.units[index]!
    if (unit.cloudStarted || unit.source || unit.done) return
    const cached = this.engines.cached
    if (!cached) {
      this.askCloud(unit)
      return
    }
    unit.cloudStarted = true
    void cached(unit.text, unit.cloudController.signal)
      .catch(() => null)
      .then((blob) => {
        if (this.signal.aborted) return
        if (blob && unit.claim("cache")) {
          unit.push({ blob, text: unit.text, source: "cache" })
          unit.finish()
          return
        }
        if (unit.source || unit.done) return
        this.askCloud(unit)
      })
  }

  /** Cloudflare's turn at a paragraph (after the cache missed, when there is one). */
  private askCloud(unit: VoiceUnit): void {
    if (this.cloudDead) {
      unit.out("cloudflare")
      return
    }
    unit.cloudStarted = true
    const cloud = this.engines.cloud!
    void cloud(unit.text, unit.cloudController.signal).then(
      (blob) => this.cloudAnswered(unit, blob),
      (error: unknown) => {
        if (!unit.cloudController.signal.aborted) console.warn("[voice] Cloudflare could not voice a paragraph.", error)
        this.cloudAnswered(unit, null)
      },
    )
  }

  private cloudAnswered(unit: VoiceUnit, blob: Blob | null): void {
    if (this.signal.aborted) return
    if (blob && unit.claim("cloudflare")) {
      this.cloudWorked = true
      unit.push({ blob, text: unit.text, source: "cloudflare" })
      unit.finish()
      return
    }
    if (blob || unit.cloudController.signal.aborted) return
    // Never answered (signed out, or no Workers AI here): stop asking for the rest of the page.
    if (!this.cloudWorked && !this.cloudDead) {
      this.cloudDead = true
      // With a cache, each later paragraph still asks it first and drops out of Cloudflare's hands on a miss.
      if (!this.engines.cached) {
        this.units.forEach((other) => {
          if (!other.cloudStarted) other.out("cloudflare")
        })
      }
    }
    unit.out("cloudflare")
  }
}
