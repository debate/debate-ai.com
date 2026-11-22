/**
 * @file card-voice.ts
 * @description Speaks one citation hover card for its read-aloud button
 * (`citation-card.tsx`), with the same engines as the page's Voice button
 * (`voice-read-button.tsx`): Cloudflare Workers AI (`/api/tts`, signed-in
 * readers, the Settings Cloudflare voice), the browser's own voice for
 * anything Cloudflare can't voice, at the Voice button's speed (Settings
 * speed, Fast speech option). The speech modules load only on the first
 * press, so nothing here reaches the server bundle.
 *
 * One reading at a time: starting another card, or the References panel's
 * Read all (`references-panel.tsx`), stops the one reading.
 */
import { cardVoiceTexts } from "./card-voice-text"
import { VoiceQueue } from "./voice-read-queue"
import {
  DEFAULT_CLOUD_VOICE,
  cloudflareSpeech,
  playClip,
  readVoiceOptions,
  silentWavUrl,
  speakWithBrowser,
  voiceSpeed,
} from "./voice-read-button"

/** Longest piece sent to Cloudflare at once; longer card text is split at sentences. */
const PIECE_CHARS = 1500

let current: AbortController | null = null

/** Stops the card reading, if any. */
export function stopCardVoice(): void {
  current?.abort()
  current = null
}

/** One card the voice reads: an optional paragraph first, then the cite tag and the underlined text. */
export interface CardReading {
  /** Read before the card, as written: the page paragraph that introduces it (References panel). */
  intro?: string
  /** The cite tag, `Shanahan 93`. */
  spoken?: string
  /** The card markup. */
  card?: string
}

/**
 * Reads a card aloud: `spoken` (`Shanahan 93`) once, then its underlined
 * text. Resolves when it finishes or is stopped. Call it inside the click, so
 * the audio element is unlocked for browsers that limit autoplay.
 */
export function readCardAloud(spoken: string | undefined, cardHtml: string | undefined, signal: AbortSignal): Promise<void> {
  return readCardsAloud([{ spoken, card: cardHtml }], signal)
}

/**
 * Reads several cards in a row, each as `readCardAloud` does with its `intro`
 * paragraph first (the References panel's "Read all"). `onCard` hears the
 * index of the card the voice moved on to, so the panel can follow along.
 */
export async function readCardsAloud(
  cards: CardReading[],
  signal: AbortSignal,
  onCard?: (index: number) => void,
): Promise<void> {
  stopCardVoice()
  const ctrl = new AbortController()
  current = ctrl
  const stopAll = () => ctrl.abort()
  signal.addEventListener("abort", stopAll, { once: true })
  const own = ctrl.signal

  const audio = new Audio()
  const silence = silentWavUrl()
  audio.src = silence
  audio.play().catch(() => {})
  try {
    const texts = cards.map((card) => {
      const intro = card.intro?.replace(/\s+/g, " ").trim()
      return [...(intro ? [intro] : []), ...cardVoiceTexts(card.spoken, card.card)]
    })
    if (texts.every((list) => list.length === 0)) return
    const [voice, kokoro] = await Promise.all([import("@debate-ai/editor/read-voice"), import("@debate-ai/editor/kokoro")])
    if (own.aborted) return
    const storedId = voice.readStoredVoiceId()
    const storedChoice = voice.readVoiceChoice(storedId)
    const cloudVoice =
      voice.readVoiceEngine(storedId) === "cloudflare" && storedChoice !== "browser" ? storedChoice.voice : DEFAULT_CLOUD_VOICE
    const speed = voiceSpeed(voice.readStoredSpeed(), readVoiceOptions().fastSpeech)

    /** Each piece, and the card it belongs to. */
    const pieces: string[] = []
    const owners: number[] = []
    texts.forEach((list, cardIndex) => {
      for (const piece of list.flatMap((text) => kokoro.speechChunks(text, PIECE_CHARS))) {
        pieces.push(piece)
        owners.push(cardIndex)
      }
    })
    const queue = new VoiceQueue(
      pieces,
      { kokoro: null, kokoroChunks: (text) => [text], cloud: (text, cloudSignal) => cloudflareSpeech(text, cloudVoice, cloudSignal) },
      own,
    )
    queue.start()
    let lastCard = -1
    for (let i = 0; i < pieces.length && !own.aborted; i++) {
      queue.playing(i)
      if (owners[i] !== lastCard) {
        lastCard = owners[i]!
        onCard?.(lastCard)
      }
      const unit = queue.units[i]!
      for await (const clip of unit.read(own)) {
        if (!(await playClip(audio, clip.blob, speed, own)) && !own.aborted) await speakWithBrowser(clip.text, speed, own)
      }
      for (const text of unit.missing) {
        if (own.aborted) break
        await speakWithBrowser(text, speed, own)
      }
    }
  } catch (error) {
    if (!own.aborted) console.warn("[voice] Reading the card aloud failed.", error)
  } finally {
    signal.removeEventListener("abort", stopAll)
    ctrl.abort()
    audio.pause()
    audio.removeAttribute("src")
    URL.revokeObjectURL(silence)
    if (current === ctrl) current = null
  }
}
