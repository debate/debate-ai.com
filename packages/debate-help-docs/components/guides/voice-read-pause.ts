/**
 * @file voice-read-pause.ts
 * @description Play/pause for the Voice reader (`voice-read-button.tsx`):
 * pausing holds whatever is playing (the `<audio>` clip, or the browser's own
 * speech) and keeps the reader from starting the next clip until it resumes.
 */

/** Resolves when `signal` aborts. */
function aborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve()
    else signal.addEventListener("abort", () => resolve(), { once: true })
  })
}

export class PauseControl {
  paused = false
  private audio: HTMLAudioElement | null = null
  private speaking = false
  private waiters: Array<() => void> = []

  /** The `<audio>` element now playing a clip, or null when none is. */
  attachAudio(audio: HTMLAudioElement | null): void {
    this.audio = audio
  }

  /** Whether the browser's own speech is speaking. */
  attachSpeech(speaking: boolean): void {
    this.speaking = speaking
  }

  pause(): void {
    if (this.paused) return
    this.paused = true
    this.audio?.pause()
    if (this.speaking && typeof window !== "undefined") window.speechSynthesis?.pause()
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.audio?.play().catch(() => {})
    if (this.speaking && typeof window !== "undefined") window.speechSynthesis?.resume()
    const waiters = this.waiters
    this.waiters = []
    waiters.forEach((wake) => wake())
  }

  /** Clears a pause without playing anything (a new reading starts, or the reading ends). */
  reset(): void {
    this.paused = false
    this.audio = null
    this.speaking = false
    const waiters = this.waiters
    this.waiters = []
    waiters.forEach((wake) => wake())
  }

  /** Resolves at once when not paused, else when resumed (or `signal` aborts). */
  async whenResumed(signal: AbortSignal): Promise<void> {
    while (this.paused && !signal.aborted) {
      await Promise.race([new Promise<void>((resolve) => this.waiters.push(resolve)), aborted(signal)])
    }
  }
}
