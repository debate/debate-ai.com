"use client"
/**
 * @file voice-read-button.tsx
 * @description The "Voice" button on the Synergy Slayer of Critiques pages,
 * after the Underlining toggle. It reads the whole page aloud, every passage
 * except the figures (`voice-read-text.ts` picks the text), top to bottom,
 * scrolling to and outlining the passage being read. While the Underlining
 * toggle is on it reads only the highlighted words (falling back to all text
 * on a page with no highlights). Pressing it again,
 * Escape, or leaving the page stops it.
 *
 * It speaks with the reader's own read-aloud voice and speed from Settings →
 * Sound & speech, through the same client the card editor's Read aloud uses
 * (`@debate-ai/editor/read-voice`): Kokoro in a Web Worker on this device,
 * else the site's `/api/tts` (Cloudflare Workers AI / QwkSearch), else the
 * browser's built-in speech. No new API. The client is loaded on the first
 * press, so docs pages don't download it until someone listens. A speed
 * change in Settings applies live, as it does for cards.
 */
import { useEffect, useRef, useState } from "react"
import { Loader2, Square, Volume2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { buttonVariants } from "../ui/button"
import { collectVoiceBlocks } from "./voice-read-text"

/** The page content Voice reads (`SYNERGY_SLAYER_CLASS` in routes/docs-page.tsx). */
const CONTENT_SELECTOR = ".synergy-slayer-doc"
/** Set on the passage being read; `styles/docs.css` outlines it. */
const READING_ATTRIBUTE = "data-voice-reading"
/** Set on `<html>` by the Underlining toggle (`highlight-toggle.tsx`); "off" means read everything. */
const HIGHLIGHT_ATTRIBUTE = "data-debate-highlights"

type ReadVoiceModule = typeof import("@debate-ai/editor/read-voice")
type SpeechAudio = Awaited<ReturnType<ReadVoiceModule["fetchModelSpeech"]>>

type Status = "idle" | "loading" | "reading"

/** Resolves when `signal` aborts (never rejects). */
function aborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve()
    else signal.addEventListener("abort", () => resolve(), { once: true })
  })
}

/** Plays one clip at `speed` until it ends, fails, or `signal` aborts. */
async function playClip(
  blob: Blob,
  speed: () => number,
  onAudio: (audio: HTMLAudioElement | null) => void,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.playbackRate = speed()
  onAudio(audio)
  try {
    const done = new Promise<void>((resolve) => {
      audio.addEventListener("ended", () => resolve(), { once: true })
      audio.addEventListener("error", () => resolve(), { once: true })
    })
    await audio.play()
    await Promise.race([done, aborted(signal)])
  } catch {
    // Autoplay blocked or the clip would not decode: go on to the next one.
  } finally {
    audio.pause()
    onAudio(null)
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

/** Reads the Synergy Slayer page aloud in the reader's Settings voice. */
export function VoiceReadButton() {
  const [status, setStatus] = useState<Status>("idle")
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
    const highlightsOn = document.documentElement.getAttribute(HIGHLIGHT_ATTRIBUTE) !== "off"
    let blocks = highlightsOn ? collectVoiceBlocks(root, { highlightedOnly: true }) : []
    if (blocks.length === 0) blocks = collectVoiceBlocks(root)
    if (blocks.length === 0) return

    const ctrl = new AbortController()
    controller.current = ctrl
    const { signal } = ctrl
    setStatus("loading")

    let current: HTMLAudioElement | null = null
    let marked: Element | null = null
    let speedListener: [event: string, listener: () => void] | null = null
    try {
      const voice = await import("@debate-ai/editor/read-voice")
      const choice = voice.readVoiceChoice(voice.readStoredVoiceId())
      let speed = voice.readStoredSpeed()
      const onSpeed = () => {
        speed = voice.readStoredSpeed()
        if (current) current.playbackRate = speed
      }
      speedListener = [voice.READ_SPEED_CHANGE_EVENT, onSpeed]
      window.addEventListener(voice.READ_SPEED_CHANGE_EVENT, onSpeed)

      // Model audio for a passage; the next one is fetched while this one plays.
      const fetchAudio = (text: string): Promise<SpeechAudio> =>
        choice === "browser"
          ? Promise.resolve(null)
          : voice.fetchModelSpeech(text, choice, { signal }).catch(() => null)

      let next = fetchAudio(blocks[0]!.text)
      for (let i = 0; i < blocks.length && !signal.aborted; i++) {
        const { element, text } = blocks[i]!
        const audio = await next
        if (signal.aborted) break
        next = i + 1 < blocks.length ? fetchAudio(blocks[i + 1]!.text) : Promise.resolve(null)

        marked?.removeAttribute(READING_ATTRIBUTE)
        element.setAttribute(READING_ATTRIBUTE, "")
        marked = element
        element.scrollIntoView({ block: "center", behavior: "smooth" })
        setStatus("reading")

        const onAudio = (a: HTMLAudioElement | null) => {
          current = a
        }
        if (audio === null) {
          await speakWithBrowser(text, speed, signal)
        } else if (audio instanceof Blob) {
          await playClip(audio, () => speed, onAudio, signal)
        } else {
          for await (const clip of audio) {
            if (signal.aborted) break
            await playClip(clip, () => speed, onAudio, signal)
          }
        }
      }
    } catch (error) {
      if (!signal.aborted) console.warn("[voice] Reading the page aloud failed.", error)
    } finally {
      if (speedListener) window.removeEventListener(...speedListener)
      marked?.removeAttribute(READING_ATTRIBUTE)
      if (controller.current === ctrl) {
        controller.current = null
        setStatus("idle")
      }
    }
  }

  const active = status !== "idle"
  return (
    <button
      type="button"
      aria-pressed={active}
      title={active ? "Stop reading aloud (Esc)" : "Read this page aloud in your Settings voice: only the highlighted words while Underlining is on (figures skipped)"}
      className={cn(
        buttonVariants({
          size: "sm",
          className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
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
      {status === "loading" ? <Loader2 className="animate-spin" /> : status === "reading" ? <Square /> : <Volume2 />}
      {active ? "Stop voice" : "Voice"}
    </button>
  )
}
