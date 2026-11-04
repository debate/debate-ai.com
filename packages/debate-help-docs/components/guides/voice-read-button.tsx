"use client"
/**
 * @file voice-read-button.tsx
 * @description The "Voice" button on the Synergy Slayer of Critiques pages,
 * after the Underlining toggle. It reads the whole page aloud in Kokoro, top
 * to bottom, scrolling to and outlining the passage being read. It reads all
 * the text whether or not the Underlining toggle is on (not just the
 * highlighted words). Figures are never read (`voice-read-text.ts` picks the
 * text). Pressing it again, Escape, or leaving the page stops it.
 *
 * **Kokoro is downloaded first, with progress.** On the first press the
 * Kokoro model (~90 MB) is downloaded into this browser and the button shows
 * "Downloading Kokoro 42%" with a fill bar; once it is cached later presses
 * start almost at once. If the download fails the reading goes on through the
 * site's `/api/tts` Kokoro.
 *
 * **Always Kokoro.** It uses the Kokoro voice picked in Settings → Sound &
 * speech, or Kokoro's default voice when Settings picks a non-Kokoro one,
 * through the card editor's read-aloud client (`@debate-ai/editor/read-voice`):
 * Kokoro in its Web Worker on this device, else the site's `/api/tts` asking
 * for Kokoro. No new API. The client is loaded on the first press.
 *
 * **Nothing is dropped.** The text is cut up front into Kokoro-sized pieces
 * (`speechChunks`, at most ~280 characters) and each piece is its own request,
 * so a long passage can't be cut off and a piece that fails is retried by the
 * next engine; only a piece no Kokoro could voice falls back to the browser's
 * speech. The next few pieces are generated while one plays, so there are no
 * gaps. All clips play through one `<audio>` element unlocked by the press, so
 * browsers that limit autoplay (Safari) keep playing after the first clip.
 *
 * Voice plays at `VOICE_SPEED_MULTIPLIER` times the Settings speed (the
 * default 2x becomes 1.4x), 70% of the Settings speed so a long page is easy
 * to follow.
 * A speed change in Settings applies live.
 */
import { useEffect, useRef, useState } from "react"
import { Loader2, Square, Volume2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { collectVoiceBlocks, type VoiceBlock } from "./voice-read-text"

/** The page content Voice reads (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx). */
const CONTENT_SELECTOR = ".synergy-slayer-doc"
/** Set on the passage being read; `styles/docs.css` outlines it. */
const READING_ATTRIBUTE = "data-voice-reading"

type Status = "idle" | "loading" | "downloading" | "reading"

/** Voice reads at this fraction of the Settings read-aloud speed (70%). */
export const VOICE_SPEED_MULTIPLIER = 0.7
/** Highest `playbackRate` browsers accept for audio (Chrome, Firefox, Safari). */
const MAX_PLAYBACK_RATE = 16
/** Pieces generated ahead of the one playing. */
const LOOKAHEAD = 3

/** The Voice button's speed for a Settings read-aloud speed. */
function voiceSpeed(settingsSpeed: number): number {
  return Math.min(MAX_PLAYBACK_RATE, settingsSpeed * VOICE_SPEED_MULTIPLIER)
}

/** One piece Voice speaks, with the passage it belongs to. */
interface VoicePiece {
  element: Element
  text: string
}

/** `blocks` cut into pieces of at most Kokoro's size, in order. */
export function voicePieces(blocks: VoiceBlock[], chunk: (text: string) => string[]): VoicePiece[] {
  return blocks.flatMap(({ element, text }) => chunk(text).map((piece) => ({ element, text: piece })))
}

/** A tiny silent WAV, played inside the click so later clips may autoplay. */
function silentWavUrl(): string {
  const samples = 800
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, "RIFF")
  view.setUint32(4, 36 + samples * 2, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true)
  view.setUint32(28, 16000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, "data")
  view.setUint32(40, samples * 2, true)
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }))
}

/** Resolves when `signal` aborts (never rejects). */
function aborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve()
    else signal.addEventListener("abort", () => resolve(), { once: true })
  })
}

/** Plays one clip on `audio` at `speed`; false when it would not play. */
async function playClip(audio: HTMLAudioElement, blob: Blob, speed: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return true
  const url = URL.createObjectURL(blob)
  try {
    const done = new Promise<boolean>((resolve) => {
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
    })
    audio.src = url
    // Loading a new source resets playbackRate to defaultPlaybackRate.
    audio.defaultPlaybackRate = speed
    audio.playbackRate = speed
    await audio.play()
    return await Promise.race([done, aborted(signal).then(() => true)])
  } catch (error) {
    if (!signal.aborted) console.warn("[voice] A clip would not play; using the browser voice for it.", error)
    return signal.aborted
  } finally {
    audio.onended = null
    audio.onerror = null
    audio.pause()
    URL.revokeObjectURL(url)
  }
}

/** Speaks `text` with the browser's built-in voice at `rate`. */
async function speakWithBrowser(text: string, rate: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted || typeof window === "undefined" || !("speechSynthesis" in window)) return
  const synth = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = Math.min(10, Math.max(0.1, rate))
  const done = new Promise<void>((resolve) => {
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
  })
  synth.speak(utterance)
  await Promise.race([done, aborted(signal)])
  if (signal.aborted) synth.cancel()
}

/** Reads the Synergy Slayer page aloud in Kokoro. */
export function VoiceReadButton() {
  const [status, setStatus] = useState<Status>("idle")
  /** Kokoro download progress, 0 to 1, while `status` is "downloading" (null before the first report). */
  const [progress, setProgress] = useState<number | null>(null)
  const controller = useRef<AbortController | null>(null)

  const stop = () => {
    controller.current?.abort()
    controller.current = null
  }

  // Leaving the page stops the reading.
  useEffect(() => stop, [])

  useEffect(() => {
    if (status === "idle") return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [status])

  const read = async () => {
    const root = document.querySelector(CONTENT_SELECTOR)
    if (!root) return
    // The entire page, every passage, whatever the Underlining toggle says.
    const blocks = collectVoiceBlocks(root)
    if (blocks.length === 0) return

    const ctrl = new AbortController()
    controller.current = ctrl
    const { signal } = ctrl
    setStatus("loading")

    // Unlock one audio element inside the click; every clip plays through it.
    const audio = new Audio()
    const silence = silentWavUrl()
    audio.src = silence
    audio.play().catch(() => {})

    let marked: Element | null = null
    let speedListener: [event: string, listener: () => void] | null = null
    try {
      const [voice, kokoro] = await Promise.all([
        import("@debate-ai/editor/read-voice"),
        import("@debate-ai/editor/kokoro"),
      ])
      // Always Kokoro: the Settings voice when it is a Kokoro one, else Kokoro's default.
      const storedId = voice.readStoredVoiceId()
      const choice = voice.readVoiceChoice(
        voice.readVoiceEngine(storedId) === "kokoro" ? storedId : voice.DEFAULT_READ_VOICE_ID,
      )
      if (choice === "browser") throw new Error("No Kokoro voice")

      // Download Kokoro into this browser first, showing its progress. Cached
      // models resolve almost at once; a failed download falls back to the
      // site's Kokoro (`/api/tts`) inside `fetchModelSpeech`.
      if (kokoro.kokoroInBrowserSupported()) {
        setProgress(null)
        setStatus("downloading")
        try {
          await Promise.race([
            kokoro.downloadKokoro((fraction) => {
              if (!signal.aborted) setProgress(fraction)
            }),
            aborted(signal),
          ])
        } catch (error) {
          if (!signal.aborted) console.warn("[voice] Downloading Kokoro failed; using the site's Kokoro.", error)
        }
        if (signal.aborted) return
        setStatus("loading")
      }

      let speed = voiceSpeed(voice.readStoredSpeed())
      const onSpeed = () => {
        speed = voiceSpeed(voice.readStoredSpeed())
        audio.defaultPlaybackRate = speed
        audio.playbackRate = speed
      }
      speedListener = [voice.READ_SPEED_CHANGE_EVENT, onSpeed]
      window.addEventListener(voice.READ_SPEED_CHANGE_EVENT, onSpeed)

      const pieces = voicePieces(blocks, (text) => kokoro.speechChunks(text))

      // Every clip of one piece, or null when no Kokoro could voice it.
      const synthesize = async (text: string): Promise<Blob[] | null> => {
        try {
          const speech = await voice.fetchModelSpeech(text, choice, { signal })
          if (!speech) return null
          if (speech instanceof Blob) return [speech]
          const clips: Blob[] = []
          for await (const clip of speech) clips.push(clip)
          return clips.length ? clips : null
        } catch (error) {
          if (!signal.aborted) console.warn("[voice] Kokoro could not voice a passage.", error)
          return null
        }
      }
      const jobs: Promise<Blob[] | null>[] = []
      const startJobs = (upTo: number) => {
        for (let j = jobs.length; j <= Math.min(upTo, pieces.length - 1); j++) jobs.push(synthesize(pieces[j]!.text))
      }

      for (let i = 0; i < pieces.length && !signal.aborted; i++) {
        startJobs(i + LOOKAHEAD)
        const { element, text } = pieces[i]!
        const clips = await jobs[i]!
        if (signal.aborted) break

        if (marked !== element) {
          marked?.removeAttribute(READING_ATTRIBUTE)
          element.setAttribute(READING_ATTRIBUTE, "")
          marked = element
          element.scrollIntoView({ block: "center", behavior: "smooth" })
        }
        setStatus("reading")

        let played = clips !== null
        for (const clip of clips ?? []) {
          if (signal.aborted) break
          if (!(await playClip(audio, clip, speed, signal))) played = false
        }
        // Nothing is skipped: a piece Kokoro couldn't voice or play is spoken by the browser.
        if (!played && !signal.aborted) await speakWithBrowser(text, speed, signal)
      }
    } catch (error) {
      if (!signal.aborted) console.warn("[voice] Reading the page aloud failed.", error)
    } finally {
      if (speedListener) window.removeEventListener(...speedListener)
      audio.pause()
      audio.removeAttribute("src")
      URL.revokeObjectURL(silence)
      marked?.removeAttribute(READING_ATTRIBUTE)
      if (controller.current === ctrl) {
        controller.current = null
        setStatus("idle")
        setProgress(null)
      }
    }
  }

  const active = status !== "idle"
  const percent = progress === null ? null : Math.round(progress * 100)
  const label =
    status === "downloading"
      ? percent === null
        ? "Downloading Kokoro…"
        : `Downloading Kokoro ${percent}%`
      : active
        ? "Stop voice"
        : "Voice"
  return (
    <button
      type="button"
      aria-pressed={active}
      title={
        active
          ? "Stop reading aloud (Esc)"
          : "Read this entire page aloud in Kokoro (downloaded to this browser the first time; figures skipped)"
      }
      className={cn(
        buttonVariants({
          size: "sm",
          className: "relative gap-2 overflow-hidden [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
        }),
        active && "bg-fd-accent",
      )}
      onClick={() => {
        if (active) {
          stop()
          setStatus("idle")
        } else {
          void read()
        }
      }}
    >
      {status === "downloading" && (
        <span
          role="progressbar"
          aria-label="Kokoro download"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          className="pointer-events-none absolute inset-y-0 left-0 bg-fd-primary/20 transition-[width] duration-200"
          style={{ width: `${percent ?? 0}%` }}
        />
      )}
      {status === "loading" || status === "downloading" ? (
        <Loader2 className="animate-spin" />
      ) : status === "reading" ? (
        <Square />
      ) : (
        <Volume2 />
      )}
      <span className="relative tabular-nums">{label}</span>
    </button>
  )
}
