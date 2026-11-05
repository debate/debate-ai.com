"use client"
/**
 * @file voice-read-button.tsx
 * @description The "Voice" button on the Synergy Slayer of Critiques pages,
 * after the Underlining toggle. It reads the page aloud top to bottom,
 * paragraph by paragraph, scrolling to and outlining the passage being read.
 * With the Underlining toggle on it reads every underlined/highlighted word
 * on the page; off, it reads all the text. Figures are never read
 * (`voice-read-text.ts` picks the text). Pressing it again, Escape, or leaving
 * the page stops it.
 *
 * **Cloudflare by default.** Each paragraph is spoken by Cloudflare Workers
 * AI (`/api/tts` with `route: "cloudflare"`, Deepgram Aura, signed-in users),
 * in the Settings Cloudflare voice, else Asteria. The paragraph playing and the
 * next few are requested ahead so there are no gaps.
 *
 * **Options menu.** The small chevron beside the button opens two toggles,
 * kept in this browser (`VOICE_OPTIONS_KEY`):
 * - **Local Kokoro**: Kokoro also runs on this device (its Web Worker) and
 *   races Cloudflare per paragraph (`voice-read-queue.ts`); whichever answers
 *   first plays. The first time, the ~90 MB model downloads with a percentage
 *   and fill bar on the button while Cloudflare already reads. Transformers.js
 *   keeps the model in the browser's Cache Storage (localStorage holds only
 *   5 MB), and we ask for persistent storage so it isn't evicted.
 * - **Fast speech**: 1.7 times faster (on by default).
 *
 * **Shared Kokoro cache.** Every paragraph is first looked up in the site's
 * R2 cache of Kokoro paragraphs (`/api/tts/cache`, in the Settings Kokoro
 * voice), which anyone can play, signed in or not. With Local Kokoro on,
 * Kokoro makes one whole paragraph at a time, the button shows
 * "Kokoro 3/12 42%" with a fill bar while it does, and a signed-in
 * reader's finished paragraphs are uploaded there for everyone after them.
 *
 * **Nothing is dropped.** A paragraph neither engine could voice, or a clip
 * that won't play, is spoken by the browser's own voice. All clips play
 * through one `<audio>` element unlocked by the press, so browsers that limit
 * autoplay (Safari) keep playing after the first clip.
 *
 * Voice plays at `VOICE_SPEED_MULTIPLIER` times the Settings speed, times
 * `FAST_SPEECH_FACTOR` with Fast speech on (the default 2x becomes about
 * 2.05x, or 1.2x without). Speed changes apply live.
 */
import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Loader2, Square, Volume2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { collectVoiceBlocks, type VoiceBlock } from "./voice-read-text"
import { VoiceQueue, type VoiceSource } from "./voice-read-queue"

/** The page content Voice reads (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx). */
const CONTENT_SELECTOR = ".synergy-slayer-doc"
/** Set on the passage being read; `styles/docs.css` outlines it. */
const READING_ATTRIBUTE = "data-voice-reading"
/** Set on `<html>` by the Underlining toggle (`highlight-toggle.tsx`); "off" means read everything. */
const HIGHLIGHT_ATTRIBUTE = "data-debate-highlights"

type Status = "idle" | "loading" | "reading"

/** Voice reads at this multiple of the Settings read-aloud speed: 70%, then 14% slower than that. */
export const VOICE_SPEED_MULTIPLIER = 0.7 * 0.86
/** Fast speech multiplies the speed by this. */
export const FAST_SPEECH_FACTOR = 1.7
/** Where the options menu's toggles are kept, in this browser. */
export const VOICE_OPTIONS_KEY = "debate-docs-voice-options"

/** The options menu's toggles. */
export interface VoiceOptions {
  /** Kokoro on this device races Cloudflare. Off: Cloudflare only. */
  localKokoro: boolean
  /** Read `FAST_SPEECH_FACTOR` times faster. */
  fastSpeech: boolean
}

export const DEFAULT_VOICE_OPTIONS: VoiceOptions = { localKokoro: false, fastSpeech: true }

/** The stored toggles, defaults filling anything missing or unreadable. */
export function readVoiceOptions(): VoiceOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(VOICE_OPTIONS_KEY) ?? "{}") as Partial<VoiceOptions>
    return {
      localKokoro: typeof raw.localKokoro === "boolean" ? raw.localKokoro : DEFAULT_VOICE_OPTIONS.localKokoro,
      fastSpeech: typeof raw.fastSpeech === "boolean" ? raw.fastSpeech : DEFAULT_VOICE_OPTIONS.fastSpeech,
    }
  } catch {
    return DEFAULT_VOICE_OPTIONS
  }
}

function storeVoiceOptions(options: VoiceOptions): void {
  try {
    localStorage.setItem(VOICE_OPTIONS_KEY, JSON.stringify(options))
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}
/** Highest `playbackRate` browsers accept for audio (Chrome, Firefox, Safari). */
const MAX_PLAYBACK_RATE = 16
/** Longest paragraph sent to Cloudflare at once; longer ones are split at sentences. */
const PARAGRAPH_CHARS = 1500
/** Cloudflare voice when Settings picks a non-Cloudflare one. */
const DEFAULT_CLOUD_VOICE = "aura-asteria-en"

/** The Voice button's speed for a Settings read-aloud speed. */
export function voiceSpeed(settingsSpeed: number, fastSpeech: boolean): number {
  return Math.min(MAX_PLAYBACK_RATE, settingsSpeed * VOICE_SPEED_MULTIPLIER * (fastSpeech ? FAST_SPEECH_FACTOR : 1))
}

/** One piece Voice speaks, with the passage it belongs to. */
interface VoicePiece {
  element: Element
  text: string
}

/** `blocks` cut into pieces with `chunk`, in order (paragraphs, long ones split). */
export function voicePieces(blocks: VoiceBlock[], chunk: (text: string) => string[]): VoicePiece[] {
  return blocks.flatMap(({ element, text }) => chunk(text).map((piece) => ({ element, text: piece })))
}

/** Cloudflare Workers AI speech for `text` through the site's `/api/tts`, or null. */
async function cloudflareSpeech(text: string, voice: string, signal: AbortSignal): Promise<Blob | null> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, provider: "deepgram", voice, route: "cloudflare" }),
    signal,
  })
  return res.ok && /^audio\//i.test(res.headers.get("content-type") ?? "") ? await res.blob() : null
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

/** Reads the Synergy Slayer page (or reading mode's section) aloud: Cloudflare, racing local Kokoro when that's on. */
export function VoiceReadButton({
  contentSelector = CONTENT_SELECTOR,
}: {
  /** What to read; reading mode (`reading-mode.tsx`) points it at its whole section. */
  contentSelector?: string
} = {}) {
  const [options, setOptions] = useState<VoiceOptions>(DEFAULT_VOICE_OPTIONS)
  const optionsRef = useRef<VoiceOptions>(DEFAULT_VOICE_OPTIONS)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  /** Re-applies the speed to the reading in progress. */
  const applySpeed = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  /** Kokoro download progress, 0 to 1, while it downloads (null otherwise). */
  const [progress, setProgress] = useState<number | null>(null)
  /** How far local Kokoro is through the paragraph it is making (null when it isn't making one). */
  const [paragraphProgress, setParagraphProgress] = useState<{ index: number; count: number; fraction: number } | null>(
    null,
  )
  /** The engine voicing the paragraph playing. */
  const [engine, setEngine] = useState<VoiceSource | null>(null)
  const controller = useRef<AbortController | null>(null)

  const stop = () => {
    controller.current?.abort()
    controller.current = null
  }

  // Leaving the page stops the reading.
  useEffect(() => stop, [])

  useEffect(() => {
    const stored = readVoiceOptions()
    optionsRef.current = stored
    setOptions(stored)
  }, [])

  const setOption = (key: keyof VoiceOptions, value: boolean) => {
    const next = { ...optionsRef.current, [key]: value }
    optionsRef.current = next
    setOptions(next)
    storeVoiceOptions(next)
    if (key === "fastSpeech") applySpeed.current?.()
  }

  // The options menu closes on a click outside it or Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    if (status === "idle") return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !menuRef.current?.querySelector("[role=menu]")) stop()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [status])

  const read = async () => {
    const root = document.querySelector(contentSelector)
    if (!root) return
    // Underlining on: every underlined word on the page. Off: all the text.
    const highlightsOn = document.documentElement.getAttribute(HIGHLIGHT_ATTRIBUTE) !== "off"
    let blocks = highlightsOn ? collectVoiceBlocks(root, { highlightedOnly: true }) : []
    if (blocks.length === 0) blocks = collectVoiceBlocks(root)
    if (blocks.length === 0) return

    const ctrl = new AbortController()
    controller.current = ctrl
    const { signal } = ctrl
    setStatus("loading")
    setEngine(null)

    // Unlock one audio element inside the click; every clip plays through it.
    const audio = new Audio()
    const silence = silentWavUrl()
    audio.src = silence
    audio.play().catch(() => {})

    let marked: Element | null = null
    let speedListener: [event: string, listener: () => void] | null = null
    try {
      const [voice, kokoro, paragraphs] = await Promise.all([
        import("@debate-ai/editor/read-voice"),
        import("@debate-ai/editor/kokoro"),
        import("@debate-ai/editor/kokoro-paragraphs"),
      ])
      const sharedCache = paragraphs.defaultKokoroAudioCache()
      const storedId = voice.readStoredVoiceId()
      const kokoroChoice = voice.readVoiceChoice(
        voice.readVoiceEngine(storedId) === "kokoro" ? storedId : voice.DEFAULT_READ_VOICE_ID,
      )
      const kokoroVoice = kokoroChoice === "browser" ? "af_heart" : kokoroChoice.voice
      const storedChoice = voice.readVoiceChoice(storedId)
      const cloudVoice =
        voice.readVoiceEngine(storedId) === "cloudflare" && storedChoice !== "browser"
          ? storedChoice.voice
          : DEFAULT_CLOUD_VOICE

      const currentSpeed = () => voiceSpeed(voice.readStoredSpeed(), optionsRef.current.fastSpeech)
      let speed = currentSpeed()
      const onSpeed = () => {
        speed = currentSpeed()
        audio.defaultPlaybackRate = speed
        audio.playbackRate = speed
      }
      applySpeed.current = onSpeed
      speedListener = [voice.READ_SPEED_CHANGE_EVENT, onSpeed]
      window.addEventListener(voice.READ_SPEED_CHANGE_EVENT, onSpeed)

      // Local Kokoro: download it with visible progress, without holding up Cloudflare.
      const kokoroSupported = optionsRef.current.localKokoro && kokoro.kokoroInBrowserSupported()
      if (kokoroSupported) {
        // Keep the ~90 MB model (Cache Storage) from being evicted.
        navigator.storage?.persist?.().catch(() => {})
        setProgress(0)
        kokoro
          .downloadKokoro((fraction) => {
            if (!signal.aborted) setProgress(fraction)
          })
          .catch((error: unknown) => {
            if (!signal.aborted) console.warn("[voice] Downloading Kokoro failed; Cloudflare reads instead.", error)
          })
          .finally(() => {
            if (!signal.aborted) setProgress(null)
          })
      }

      // Paragraph by paragraph; a very long one is split at sentences.
      const pieces = voicePieces(blocks, (text) => kokoro.speechChunks(text, PARAGRAPH_CHARS))
      const texts = pieces.map((piece) => piece.text)
      // Kokoro works through the paragraphs in order, so the next match after the last one is the one it's on.
      let kokoroAt = -1
      const kokoroIndex = (text: string) => {
        for (let i = kokoroAt + 1; i < texts.length; i++) {
          if (texts[i] === text) return (kokoroAt = i)
        }
        return kokoroAt
      }
      const queue = new VoiceQueue(
        texts,
        {
          // Whole paragraphs, with a percentage each, uploaded to the shared cache when done.
          kokoro: kokoroSupported
            ? async (text) => {
                const index = kokoroIndex(text)
                const blob = await paragraphs.kokoroParagraphAudio(text, kokoroVoice, {
                  signal,
                  cache: sharedCache,
                  lookup: false,
                  onProgress: (fraction) => {
                    if (signal.aborted) return
                    setParagraphProgress(fraction < 1 ? { index, count: texts.length, fraction } : null)
                  },
                })
                if (!blob) throw new Error("Voice stopped")
                return blob
              }
            : null,
          kokoroChunks: (text) => [text],
          cloud: (text, cloudSignal) => cloudflareSpeech(text, cloudVoice, cloudSignal),
          // Anyone can play a paragraph another reader's Kokoro already made.
          cached: (text, cacheSignal) => sharedCache.get(text, kokoroVoice, cacheSignal),
        },
        signal,
      )
      queue.start()

      for (let i = 0; i < pieces.length && !signal.aborted; i++) {
        queue.playing(i)
        const { element } = pieces[i]!
        const unit = queue.units[i]!
        let shown = false
        for await (const clip of unit.read(signal)) {
          if (!shown) {
            shown = true
            if (marked !== element) {
              marked?.removeAttribute(READING_ATTRIBUTE)
              element.setAttribute(READING_ATTRIBUTE, "")
              marked = element
              element.scrollIntoView({ block: "center", behavior: "smooth" })
            }
            setEngine(clip.source)
            setStatus("reading")
          }
          // A clip that won't play is spoken by the browser instead.
          if (!(await playClip(audio, clip.blob, speed, signal)) && !signal.aborted) {
            await speakWithBrowser(clip.text, speed, signal)
          }
        }
        // Text neither engine voiced is spoken by the browser: nothing is skipped.
        for (const text of unit.missing) {
          if (signal.aborted) break
          if (marked !== element) {
            marked?.removeAttribute(READING_ATTRIBUTE)
            element.setAttribute(READING_ATTRIBUTE, "")
            marked = element
            element.scrollIntoView({ block: "center", behavior: "smooth" })
          }
          setStatus("reading")
          await speakWithBrowser(text, speed, signal)
        }
      }
    } catch (error) {
      if (!signal.aborted) console.warn("[voice] Reading the page aloud failed.", error)
    } finally {
      ctrl.abort()
      applySpeed.current = null
      if (speedListener) window.removeEventListener(...speedListener)
      audio.pause()
      audio.removeAttribute("src")
      URL.revokeObjectURL(silence)
      marked?.removeAttribute(READING_ATTRIBUTE)
      if (controller.current === ctrl) controller.current = null
      if (controller.current === null) {
        setStatus("idle")
        setProgress(null)
        setParagraphProgress(null)
        setEngine(null)
      }
    }
  }

  const active = status !== "idle"
  const percent = progress === null ? null : Math.round(progress * 100)
  const paragraphPercent = paragraphProgress === null ? null : Math.round(paragraphProgress.fraction * 100)
  /** The fill bar: the model download first, then the paragraph Kokoro is making. */
  const barPercent = percent ?? paragraphPercent
  const engineName =
    engine === "kokoro" ? "Kokoro" : engine === "cloudflare" ? "Cloudflare" : engine === "cache" ? "Kokoro (shared)" : null
  const label = !active
    ? "Voice"
    : percent !== null
      ? `Stop · Kokoro ${percent}%`
      : paragraphProgress !== null
        ? `Stop · Kokoro ${paragraphProgress.index + 1}/${paragraphProgress.count} ${paragraphPercent}%`
        : engineName
          ? `Stop voice · ${engineName}`
          : "Stop voice"

  return (
    <div ref={menuRef} className="relative inline-flex">
    <button
      type="button"
      aria-pressed={active}
      title={
        active
          ? `Stop reading aloud (Esc)${
              percent !== null
                ? ` · downloading Kokoro ${percent}%`
                : paragraphProgress !== null
                  ? ` · Kokoro is making paragraph ${paragraphProgress.index + 1} of ${paragraphProgress.count}: ${paragraphPercent}%`
                  : ""
            }`
          : "Read this page aloud paragraph by paragraph: the underlined words while Underlining is on, else all the text (figures skipped)"
      }
      className={cn(
        buttonVariants({
          size: "sm",
          className: "relative gap-2 overflow-hidden rounded-r-none [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
        }),
        active && "bg-fd-accent text-fd-accent-foreground hover:bg-fd-accent/80",
      )}
      onClick={() => {
        if (active) {
          stop()
          setStatus("idle")
          setProgress(null)
          setParagraphProgress(null)
          setEngine(null)
        } else {
          void read()
        }
      }}
    >
      {active && barPercent !== null && (
        <span
          role="progressbar"
          aria-label={percent !== null ? "Kokoro download" : "Kokoro paragraph"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={barPercent}
          className="pointer-events-none absolute inset-y-0 left-0 bg-fd-primary/20 transition-[width] duration-200"
          style={{ width: `${barPercent}%` }}
        />
      )}
      {status === "loading" ? <Loader2 className="animate-spin" /> : status === "reading" ? <Square /> : <Volume2 />}
      <span className="relative tabular-nums">{label}</span>
    </button>
    <button
      type="button"
      aria-label="Voice options"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      title="Voice options: Local Kokoro, Fast speech"
      className={cn(
        buttonVariants({
          size: "sm",
          className: "rounded-l-none border-l-0 px-1.5 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
        }),
        menuOpen && "bg-fd-accent text-fd-accent-foreground hover:bg-fd-accent/80",
      )}
      onClick={() => setMenuOpen((open) => !open)}
    >
      <ChevronDown />
    </button>
    {menuOpen && (
      <div
        role="menu"
        aria-label="Voice options"
        className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-fd-popover p-1 text-sm text-fd-popover-foreground shadow-lg"
      >
        {(
          [
            ["localKokoro", "Local Kokoro", "Also run Kokoro on this device (~90 MB, downloaded once); the faster of it and Cloudflare reads each paragraph"],
            ["fastSpeech", "Fast speech", `Read ${FAST_SPEECH_FACTOR}× faster`],
          ] as const
        ).map(([key, name, hint]) => (
          <button
            key={key}
            type="button"
            role="menuitemcheckbox"
            aria-checked={options[key]}
            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-fd-accent"
            onClick={() => setOption(key, !options[key])}
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border">
              {options[key] && <Check className="size-3" />}
            </span>
            <span>
              <span className="block font-medium">{name}</span>
              <span className="block text-xs text-fd-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    )}
    </div>
  )
}
