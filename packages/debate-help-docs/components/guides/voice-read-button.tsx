"use client"
/**
 * @file voice-read-button.tsx
 * @description The "Voice" button on the Synergy Slayer of Critiques pages,
 * after the Underlining toggle. It reads the page aloud top to bottom,
 * paragraph by paragraph, scrolling to and outlining the passage being read.
 * With the Underlining toggle on it reads every underlined/highlighted word
 * on the page; off, it reads all the text. Figures are never read
 * (`voice-read-text.ts` picks the text). Escape or leaving the page stops it.
 *
 * **One menu, no split button.** Voice opens a menu (it is not a play button):
 * Pause / Resume (`voice-read-pause.ts`) and Stop, the two toggles below, and
 * a voice and speed for each part a read-aloud says (`voice-read-settings.tsx`,
 * the same settings as the editor's Read aloud player).
 *
 * **Follows along.** A ball glides under the word being said
 * (`voice-read-ball.ts`; engines give no per-word timing, so the word is
 * estimated from the clip's progress, `voice-read-words.ts`). While it reads,
 * clicking any text restarts from the start of that sentence.
 *
 * **Cloudflare by default.** Each paragraph is spoken by Cloudflare Workers
 * AI (`/api/tts` with `route: "cloudflare"`, Deepgram Aura, signed-in users),
 * in the Settings Cloudflare voice, else Asteria. The paragraph playing and the
 * next few are requested ahead so there are no gaps.
 *
 * **Options.** Two toggles in the menu, kept in this browser (`VOICE_OPTIONS_KEY`):
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
import { Check, ChevronDown, Loader2, Pause, Play, Square, Volume2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { createVoiceBall } from "./voice-read-ball"
import { PauseControl } from "./voice-read-pause"
import { blockFromWord, collectVoiceBlocks, type VoiceBlock } from "./voice-read-text"
import { VoiceQueue, type VoiceSource } from "./voice-read-queue"
import { VoiceSettings } from "./voice-read-settings"
import { activeWordIndex, locateWord, sentenceStart, wordAtCharacter } from "./voice-read-words"

/** The page content Voice reads (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx). */
const CONTENT_SELECTOR = ".synergy-slayer-doc"
/** Set on the passage being read; `styles/docs.css` outlines it. */
const READING_ATTRIBUTE = "data-voice-reading"
/** Set on `<html>` by the Marks menu's Highlighting switch (`highlight-toggle.tsx`); "off" means read everything. */
const HIGHLIGHT_ATTRIBUTE = "data-debate-highlights"

type Status = "idle" | "loading" | "reading"

/** Elements a click on must keep doing their own job, so they never restart the reading. */
const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, summary, label, [role=button], [data-voice-skip]"

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
export const DEFAULT_CLOUD_VOICE = "aura-asteria-en"

/** The Voice button's speed for a Settings read-aloud speed. */
export function voiceSpeed(settingsSpeed: number, fastSpeech: boolean): number {
  return Math.min(MAX_PLAYBACK_RATE, settingsSpeed * VOICE_SPEED_MULTIPLIER * (fastSpeech ? FAST_SPEECH_FACTOR : 1))
}

/** One piece Voice speaks, with the passage it belongs to. */
export interface VoicePiece {
  element: Element
  text: string
  block: VoiceBlock
  /** Index in `block.words` of this piece's first word. */
  firstWord: number
}

/** The words of `text`. */
function wordsIn(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/** `blocks` cut into pieces with `chunk`, in order (paragraphs, long ones split). */
export function voicePieces(blocks: VoiceBlock[], chunk: (text: string) => string[]): VoicePiece[] {
  return blocks.flatMap((block) => {
    let firstWord = block.first
    return chunk(block.text).map((text) => {
      const piece = { element: block.element, text, block, firstWord }
      firstWord += wordsIn(text).length
      return piece
    })
  })
}

/** Cloudflare Workers AI speech for `text` through the site's `/api/tts`, or null. */
export async function cloudflareSpeech(text: string, voice: string, signal: AbortSignal): Promise<Blob | null> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, provider: "deepgram", voice, route: "cloudflare" }),
    signal,
  })
  return res.ok && /^audio\//i.test(res.headers.get("content-type") ?? "") ? await res.blob() : null
}

/** A tiny silent WAV, played inside the click so later clips may autoplay. */
export function silentWavUrl(): string {
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

/** What `playClip` and `speakWithBrowser` report to and take from the reader. */
export interface SpeechHooks {
  /** Holds the clip while paused. */
  pause?: PauseControl
  /** How far through the clip it is, 0 to 1 (`playClip`). */
  onProgress?: (fraction: number) => void
  /** The character of the text being spoken (`speakWithBrowser`). */
  onBoundary?: (charIndex: number) => void
}

/** Plays one clip on `audio` at `speed`; false when it would not play. */
export async function playClip(
  audio: HTMLAudioElement,
  blob: Blob,
  speed: number,
  signal: AbortSignal,
  hooks: SpeechHooks = {},
): Promise<boolean> {
  await hooks.pause?.whenResumed(signal)
  if (signal.aborted) return true
  const url = URL.createObjectURL(blob)
  let frame = 0
  try {
    const done = new Promise<boolean>((resolve) => {
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
    })
    audio.src = url
    // Loading a new source resets playbackRate to defaultPlaybackRate.
    audio.defaultPlaybackRate = speed
    audio.playbackRate = speed
    hooks.pause?.attachAudio(audio)
    hooks.onProgress?.(0)
    for (;;) {
      try {
        await audio.play()
        break
      } catch (error) {
        // Pausing while the clip was starting interrupts play(); wait, then start it again.
        if (!hooks.pause?.paused || signal.aborted || (error as Error).name !== "AbortError") throw error
        await hooks.pause.whenResumed(signal)
        if (signal.aborted) return true
      }
    }
    if (hooks.pause?.paused) audio.pause()
    if (hooks.onProgress && typeof requestAnimationFrame === "function") {
      const tick = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) hooks.onProgress?.(audio.currentTime / audio.duration)
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    return await Promise.race([done, aborted(signal).then(() => true)])
  } catch (error) {
    if (!signal.aborted) console.warn("[voice] A clip would not play; using the browser voice for it.", error)
    return signal.aborted
  } finally {
    if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame)
    hooks.pause?.attachAudio(null)
    audio.onended = null
    audio.onerror = null
    audio.pause()
    URL.revokeObjectURL(url)
  }
}

/** Speaks `text` with the browser's built-in voice at `rate`. */
export async function speakWithBrowser(text: string, rate: number, signal: AbortSignal, hooks: SpeechHooks = {}): Promise<void> {
  await hooks.pause?.whenResumed(signal)
  if (signal.aborted || typeof window === "undefined" || !("speechSynthesis" in window)) return
  const synth = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = Math.min(10, Math.max(0.1, rate))
  const done = new Promise<void>((resolve) => {
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
  })
  utterance.onboundary = (event) => hooks.onBoundary?.(event.charIndex)
  hooks.onBoundary?.(0)
  hooks.pause?.attachSpeech(true)
  synth.speak(utterance)
  try {
    await Promise.race([done, aborted(signal)])
  } finally {
    hooks.pause?.attachSpeech(false)
  }
  if (signal.aborted) synth.cancel()
}

/** The caret position under the point (`x`, `y`) of the page, or null. */
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y)
    return position ? { node: position.offsetNode, offset: position.offset } : null
  }
  const range = doc.caretRangeFromPoint?.(x, y)
  return range ? { node: range.startContainer, offset: range.startOffset } : null
}

/** What Voice reads under `root`: the highlighted words while Underlining is on, else all the text. */
function collectBlocks(root: Element): VoiceBlock[] {
  const highlightsOn = document.documentElement.getAttribute(HIGHLIGHT_ATTRIBUTE) !== "off"
  const highlighted = highlightsOn ? collectVoiceBlocks(root, { highlightedOnly: true }) : []
  return highlighted.length > 0 ? highlighted : collectVoiceBlocks(root)
}

/** The stored voice's Cloudflare speaker, else the default one. */
export function cloudSpeaker(voice: typeof import("@debate-ai/editor/read-voice"), part?: "tag" | "author" | "text"): string {
  const id = voice.readStoredVoiceId(part)
  const choice = voice.readVoiceChoice(id)
  return voice.readVoiceEngine(id) === "cloudflare" && choice !== "browser" ? choice.voice : DEFAULT_CLOUD_VOICE
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
  const [paused, setPaused] = useState(false)
  const pauseRef = useRef<PauseControl | null>(null)
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

  const stopAndReset = () => {
    stop()
    setStatus("idle")
    setPaused(false)
    setProgress(null)
    setParagraphProgress(null)
    setEngine(null)
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

  // The menu closes on a click outside it or Escape.
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
    if (status === "idle" || menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stopAndReset()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [status, menuOpen])

  // While reading, a click on any text restarts the reading from the start of its sentence.
  useEffect(() => {
    if (status === "idle") return
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || event.button !== 0 || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (menuRef.current?.contains(target) || target.closest(INTERACTIVE_SELECTOR)) return
      if (window.getSelection()?.isCollapsed === false) return
      const root = document.querySelector(contentSelector)
      if (!root?.contains(target)) return
      const caret = caretAt(event.clientX, event.clientY)
      if (caret) void read(caret)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
    // `read` only uses refs and stable setters, so the listener needn't change with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, contentSelector])

  /**
   * Reads the page from the top, or from the start of the sentence at `from`
   * (a click on the text, which replaces the reading in progress).
   */
  const read = async (from?: { node: Node; offset: number }) => {
    const root = document.querySelector(contentSelector)
    if (!root) return
    let blocks = collectBlocks(root)
    if (from) {
      const at = locateWord(blocks, from.node, from.offset)
      if (!at) return
      const block = blocks[at.block]!
      const start = sentenceStart(block.words.map((word) => word.text), at.word)
      blocks = [blockFromWord(block, start), ...blocks.slice(at.block + 1)]
    }
    if (blocks.length === 0) return

    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    const { signal } = ctrl
    const pause = new PauseControl()
    pauseRef.current = pause
    setPaused(false)
    setStatus("loading")
    setEngine(null)
    const ball = createVoiceBall()

    // Unlock one audio element inside the click; every clip plays through it.
    const audio = new Audio()
    const silence = silentWavUrl()
    audio.src = silence
    audio.play().catch(() => {})

    let marked = null as Element | null
    let speedListener: [event: string, listener: () => void] | null = null
    let onSpeed: (() => void) | null = null
    try {
      const [voice, kokoro, paragraphs] = await Promise.all([
        import("@debate-ai/editor/read-voice"),
        import("@debate-ai/editor/kokoro"),
        import("@debate-ai/editor/kokoro-paragraphs"),
      ])
      const sharedCache = paragraphs.defaultKokoroAudioCache()
      // Read at each paragraph, so a voice picked in the menu takes over from the next one.
      const kokoroVoice = () => {
        const storedId = voice.readStoredVoiceId()
        const choice = voice.readVoiceChoice(
          voice.readVoiceEngine(storedId) === "kokoro" ? storedId : voice.DEFAULT_READ_VOICE_ID,
        )
        return choice === "browser" ? "af_heart" : choice.voice
      }

      const currentSpeed = () => voiceSpeed(voice.readStoredSpeed(), optionsRef.current.fastSpeech)
      let speed = currentSpeed()
      const applyNewSpeed = () => {
        speed = currentSpeed()
        audio.defaultPlaybackRate = speed
        audio.playbackRate = speed
      }
      onSpeed = applyNewSpeed
      applySpeed.current = applyNewSpeed
      speedListener = [voice.READ_SPEED_CHANGE_EVENT, applyNewSpeed]
      window.addEventListener(voice.READ_SPEED_CHANGE_EVENT, applyNewSpeed)

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
                const blob = await paragraphs.kokoroParagraphAudio(text, kokoroVoice(), {
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
          cloud: (text, cloudSignal) => cloudflareSpeech(text, cloudSpeaker(voice), cloudSignal),
          // Anyone can play a paragraph another reader's Kokoro already made.
          cached: (text, cacheSignal) => sharedCache.get(text, kokoroVoice(), cacheSignal),
        },
        signal,
      )
      queue.start()

      const outline = (element: Element) => {
        if (marked === element) return
        marked?.removeAttribute(READING_ATTRIBUTE)
        element.setAttribute(READING_ATTRIBUTE, "")
        marked = element
        element.scrollIntoView({ block: "center", behavior: "smooth" })
      }

      for (let i = 0; i < pieces.length && !signal.aborted; i++) {
        queue.playing(i)
        const piece = pieces[i]!
        const unit = queue.units[i]!
        /** Index in the passage's words of the next word to be spoken. */
        let cursor = piece.firstWord
        /** Words of `text` are the next ones spoken; the ball follows them. */
        const follow = (text: string) => {
          const words = wordsIn(text)
          const first = cursor
          cursor += words.length
          return {
            onProgress: (fraction: number) => ball.show(piece.block.words[first + activeWordIndex(words, fraction)]),
            onBoundary: (charIndex: number) => ball.show(piece.block.words[first + wordAtCharacter(words, charIndex)]),
          }
        }
        let shown = false
        for await (const clip of unit.read(signal)) {
          if (!shown) {
            shown = true
            outline(piece.element)
            setEngine(clip.source)
            setStatus("reading")
          }
          const hooks = { pause, ...follow(clip.text) }
          // A clip that won't play is spoken by the browser instead.
          if (!(await playClip(audio, clip.blob, speed, signal, hooks)) && !signal.aborted) {
            await speakWithBrowser(clip.text, speed, signal, hooks)
          }
        }
        // Text neither engine voiced is spoken by the browser: nothing is skipped.
        for (const text of unit.missing) {
          if (signal.aborted) break
          outline(piece.element)
          setStatus("reading")
          await speakWithBrowser(text, speed, signal, { pause, ...follow(text) })
        }
      }
    } catch (error) {
      if (!signal.aborted) console.warn("[voice] Reading the page aloud failed.", error)
    } finally {
      ctrl.abort()
      if (applySpeed.current === onSpeed) applySpeed.current = null
      if (speedListener) window.removeEventListener(...speedListener)
      ball.destroy()
      audio.pause()
      audio.removeAttribute("src")
      URL.revokeObjectURL(silence)
      marked?.removeAttribute(READING_ATTRIBUTE)
      pause.reset()
      if (pauseRef.current === pause) pauseRef.current = null
      if (controller.current === ctrl) controller.current = null
      if (controller.current === null) {
        setStatus("idle")
        setPaused(false)
        setProgress(null)
        setParagraphProgress(null)
        setEngine(null)
      }
    }
  }

  /** Starts the reading, or pauses / resumes the one in progress. */
  const playPause = () => {
    const pause = pauseRef.current
    if (status === "idle" || !pause) {
      void read()
      return
    }
    if (pause.paused) pause.resume()
    else pause.pause()
    setPaused(pause.paused)
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
    : paused
      ? "Paused"
      : percent !== null
        ? `Kokoro ${percent}%`
        : paragraphProgress !== null
          ? `Kokoro ${paragraphProgress.index + 1}/${paragraphProgress.count} ${paragraphPercent}%`
          : engineName
            ? `Voice · ${engineName}`
            : "Voice"

  return (
    <div ref={menuRef} className="relative inline-flex">
      <button
        type="button"
        aria-pressed={active}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        title={
          active
            ? `Voice: ${paused ? "paused" : "reading"}. Open the menu to pause, stop or change voices${
                percent !== null
                  ? ` · downloading Kokoro ${percent}%`
                  : paragraphProgress !== null
                    ? ` · Kokoro is making paragraph ${paragraphProgress.index + 1} of ${paragraphProgress.count}: ${paragraphPercent}%`
                    : ""
              }`
            : "Voice: read this page aloud, and choose the voices and speeds"
        }
        className={cn(
          buttonVariants({
            size: "sm",
            className: "relative gap-2 overflow-hidden [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
          }),
          (active || menuOpen) && "bg-fd-accent text-fd-accent-foreground hover:bg-fd-accent/80",
        )}
        onClick={() => setMenuOpen((open) => !open)}
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
        {status === "loading" ? <Loader2 className="animate-spin" /> : paused ? <Pause /> : <Volume2 />}
        <span className="relative tabular-nums">{label}</span>
        <ChevronDown className="relative -mr-1" />
      </button>
      {menuOpen && (
        <div
          role="dialog"
          aria-label="Voice"
          data-voice-menu=""
          className="absolute left-0 top-full z-50 mt-1 max-h-[75vh] w-80 overflow-y-auto rounded-lg border bg-fd-popover p-2 text-sm text-fd-popover-foreground shadow-lg"
        >
          <div className="flex gap-1.5">
            <button
              type="button"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "flex-1 justify-center gap-2")}
              onClick={playPause}
            >
              {status === "loading" ? <Loader2 className="animate-spin" /> : active && !paused ? <Pause /> : <Play />}
              {!active ? "Read this page" : paused ? "Resume" : "Pause"}
            </button>
            {active && (
              <button
                type="button"
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-2")}
                onClick={stopAndReset}
              >
                <Square />
                Stop
              </button>
            )}
          </div>
          <p className="mt-1.5 px-0.5 text-xs text-fd-muted-foreground">
            While it reads, click any text to restart from the start of that sentence.
          </p>
          <div className="mt-1.5 border-t pt-1.5">
            {(
              [
                ["localKokoro", "Local Kokoro", "Also run Kokoro on this device (~90 MB, downloaded once); the faster of it and Cloudflare reads each paragraph"],
                ["fastSpeech", "Fast speech", `Read ${FAST_SPEECH_FACTOR}× faster`],
              ] as const
            ).map(([key, name, hint]) => (
              <button
                key={key}
                type="button"
                role="checkbox"
                aria-checked={options[key]}
                className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-fd-accent"
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
          <VoiceSettings />
        </div>
      )}
    </div>
  )
}
