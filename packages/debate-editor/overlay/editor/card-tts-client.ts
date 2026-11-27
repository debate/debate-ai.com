/**
 * @fileoverview The model voices behind the card hover **Read aloud** button
 * (`card-hover-actions.ts`): fetches the card's speech as audio from a
 * text-to-speech model instead of the browser's built-in `speechSynthesis`.
 *
 * - **The site first.** `POST /api/tts` (apps/debate-ai.com) speaks through
 *   QwkSearch's Kokoro / Deepgram voices or Cloudflare Workers AI, whichever
 *   the server has and the voice prefers.
 * - **QwkSearch straight from the browser** when the site answers `429`
 *   (its shared QwkSearch guest allowance, 10 a day, is spent) or has no
 *   `/api/tts` (the editor embedded somewhere else): the visitor then uses
 *   their own guest allowance.
 * - **`null`** when neither gave audio — the caller falls back to the
 *   browser's built-in speech, so Read aloud always reads.
 *
 * Kokoro voices are made one paragraph at a time with a percentage per
 * paragraph, served from the site's shared R2 cache when another reader
 * already made that paragraph, and uploaded there when a signed-in reader
 * makes a new one (`kokoro-paragraph-audio.ts`).
 *
 * The reader picks an engine and a voice (`READ_VOICE_OPTIONS`, grouped by
 * `READ_VOICE_ENGINES`): Kokoro in the browser first, Cloudflare Workers AI's
 * Deepgram Aura voices through `/api/tts`, or the browser's speech. The pick
 * is kept in this browser (`storeVoiceId`) and shared by the card buttons'
 * read-aloud player (gear button) and Settings → Sound & speech. The tag /
 * author / year and the highlighted text each have their own voice and speed
 * (`ReadVoicePart`). Whatever the engine, a failure falls through the order
 * above.
 *
 * @module editor/card-tts-client
 */

import { kokoroInBrowserSupported, loadKokoro } from './kokoro-browser-tts.js';
import { streamKokoroParagraphs, type ParagraphProgress } from './kokoro-paragraph-audio.js';

export type { ParagraphProgress } from './kokoro-paragraph-audio.js';

export type ModelVoiceProvider = 'kokoro' | 'deepgram';

/** A model voice the reader can pick in the Read aloud settings. */
export interface ModelVoice {
  provider: ModelVoiceProvider;
  /** The provider's voice id; `''` lets the provider choose. */
  voice: string;
}

/** The voice setting: a model voice, or the browser's own speech. */
export type ReadVoiceChoice = ModelVoice | 'browser';

/** Where a voice is spoken: Kokoro on this device, Cloudflare Workers AI on the site's server, or the browser's own speech. */
export type ReadVoiceEngine = 'kokoro' | 'cloudflare' | 'browser';

/** The engines, in the order the voice lists group them. */
export const READ_VOICE_ENGINES: ReadonlyArray<{ id: ReadVoiceEngine; label: string; description: string }> = [
  {
    id: 'kokoro',
    label: 'Kokoro (on this device)',
    description: 'Runs in your browser after a one-time ~90 MB download: no server, no daily limit.',
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare Workers AI',
    description:
      "Deepgram Aura voices on the site's Cloudflare Workers AI, with nothing to download. Needs you signed in; signed out, QwkSearch's free allowance reads instead.",
  },
  { id: 'browser', label: 'Browser built-in', description: "Your browser's own speech voice." },
];

const KOKORO_VOICES: ReadonlyArray<[voice: string, name: string]> = [
  ['af_heart', 'Heart'],
  ['af_bella', 'Bella'],
  ['af_nicole', 'Nicole'],
  ['af_sarah', 'Sarah'],
  ['af_kore', 'Kore'],
  ['af_aoede', 'Aoede'],
  ['am_michael', 'Michael'],
  ['am_fenrir', 'Fenrir'],
  ['am_puck', 'Puck'],
  ['bf_emma', 'Emma (British)'],
  ['bf_isabella', 'Isabella (British)'],
  ['bm_george', 'George (British)'],
  ['bm_fable', 'Fable (British)'],
];

/** Workers AI's Deepgram Aura speakers (`AURA_SPEAKERS` in apps/debate-web/lib/tts/voice.ts). */
const AURA_VOICES: readonly string[] = [
  'asteria',
  'luna',
  'stella',
  'athena',
  'hera',
  'orion',
  'arcas',
  'perseus',
  'angus',
  'orpheus',
  'helios',
  'zeus',
];

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The choices the voice lists offer, grouped by `engine`, Kokoro first (the
 * default). Cloudflare voices keep the `deepgram:` ids they were saved under
 * before the engine picker existed; `/api/tts` speaks them on Cloudflare
 * first, then QwkSearch.
 */
export const READ_VOICE_OPTIONS: ReadonlyArray<{
  id: string;
  label: string;
  engine: ReadVoiceEngine;
  choice: ReadVoiceChoice;
}> = [
  ...KOKORO_VOICES.map(([voice, name]) => ({
    id: `kokoro:${voice}`,
    label: `Kokoro · ${name}`,
    engine: 'kokoro' as const,
    choice: { provider: 'kokoro' as const, voice },
  })),
  ...AURA_VOICES.map((name) => ({
    id: `deepgram:aura-${name}-en`,
    label: `Cloudflare · ${titleCase(name)}`,
    engine: 'cloudflare' as const,
    choice: { provider: 'deepgram' as const, voice: `aura-${name}-en` },
  })),
  { id: 'browser', label: 'Browser built-in', engine: 'browser', choice: 'browser' },
];

export const DEFAULT_READ_VOICE_ID = 'kokoro:af_heart';

/** The choice for a stored id; unknown ids get the default (Kokoro). */
export function readVoiceChoice(id: string | null | undefined): ReadVoiceChoice {
  const found = READ_VOICE_OPTIONS.find((o) => o.id === id) ?? READ_VOICE_OPTIONS.find((o) => o.id === DEFAULT_READ_VOICE_ID)!;
  return found.choice;
}

/** The engine of a stored voice id (unknown ids: Kokoro, the default). */
export function readVoiceEngine(id: string | null | undefined): ReadVoiceEngine {
  return (READ_VOICE_OPTIONS.find((o) => o.id === id) ?? READ_VOICE_OPTIONS.find((o) => o.id === DEFAULT_READ_VOICE_ID)!).engine;
}

/** The first voice of `engine`, which switching to it in Settings picks. */
export function firstVoiceOf(engine: ReadVoiceEngine): string {
  return READ_VOICE_OPTIONS.find((o) => o.engine === engine)?.id ?? DEFAULT_READ_VOICE_ID;
}

/**
 * The three parts of a card that Read aloud can speak in different voices and
 * at different speeds, in reading order: `tag` is the card's tag, `author` is
 * the author's last name and the year, `text` is the highlighted (or
 * underlined) card text. `text` keeps the storage keys the single voice
 * setting used before the split, so a voice picked then still reads the
 * evidence. `tag` keeps the keys of the combined tag-author-year part it
 * replaced, and `author` follows `tag` until the reader picks something for
 * it, so a reader who had set that combined part hears no change.
 */
export type ReadVoicePart = 'tag' | 'author' | 'text';

export const READ_VOICE_PARTS: ReadonlyArray<{ id: ReadVoicePart; label: string; description: string }> = [
  { id: 'tag', label: 'Tag', description: "The card's tag." },
  { id: 'author', label: 'Author & year', description: "The author's last name and the year." },
  { id: 'text', label: 'Highlighted text', description: 'The highlighted card text (or the underlined text when nothing is highlighted).' },
];

/** Where the voice choice (a `READ_VOICE_OPTIONS` id) is kept, in this browser only. */
export const READ_VOICE_STORAGE_KEY = 'pmd-card-actions-read-voice';
/** Where the tag voice is kept (the key of the former tag-author-year voice); unset, it follows `READ_VOICE_STORAGE_KEY`. */
export const READ_TAG_VOICE_STORAGE_KEY = 'pmd-card-actions-read-voice-cite';
/** Where the author & year voice is kept; unset, it follows the tag's. */
export const READ_AUTHOR_VOICE_STORAGE_KEY = 'pmd-card-actions-read-voice-author';

/** Fired on `window` when a voice choice changes (`detail`: the id; listeners re-read both parts), so open editors and Settings stay in step. */
export const READ_VOICE_CHANGE_EVENT = 'pmd-read-voice-change';

function storageGet(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice still holds for this page.
  }
}

function validVoiceId(raw: string | null): string | null {
  return READ_VOICE_OPTIONS.some((o) => o.id === raw) ? (raw as string) : null;
}

/**
 * The stored voice id for `part` (the highlighted text by default), or the
 * default when none (or an unknown one) is stored. The tag falls back to the
 * highlighted text's voice, and the author & year to the tag's.
 */
export function readStoredVoiceId(part: ReadVoicePart = 'text'): string {
  const text = validVoiceId(storageGet(READ_VOICE_STORAGE_KEY)) ?? DEFAULT_READ_VOICE_ID;
  if (part === 'text') return text;
  const tag = validVoiceId(storageGet(READ_TAG_VOICE_STORAGE_KEY)) ?? text;
  if (part === 'tag') return tag;
  return validVoiceId(storageGet(READ_AUTHOR_VOICE_STORAGE_KEY)) ?? tag;
}

/** Saves the voice choice for `part` and tells every listener (the card buttons, Settings). */
export function storeVoiceId(id: string, part: ReadVoicePart = 'text'): void {
  if (!READ_VOICE_OPTIONS.some((o) => o.id === id)) return;
  storageSet(VOICE_KEYS[part], id);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(READ_VOICE_CHANGE_EVENT, { detail: id }));
}

/** Where the read-aloud speed multiplier is kept, in this browser only. */
export const READ_SPEED_STORAGE_KEY = 'pmd-card-actions-read-speed';
/** Where the tag speed is kept (the key of the former tag-author-year speed); unset, it follows `READ_SPEED_STORAGE_KEY`. */
export const READ_TAG_SPEED_STORAGE_KEY = 'pmd-card-actions-read-speed-cite';
/** Where the author & year speed is kept; unset, it follows the tag's. */
export const READ_AUTHOR_SPEED_STORAGE_KEY = 'pmd-card-actions-read-speed-author';

const VOICE_KEYS: Record<ReadVoicePart, string> = {
  tag: READ_TAG_VOICE_STORAGE_KEY,
  author: READ_AUTHOR_VOICE_STORAGE_KEY,
  text: READ_VOICE_STORAGE_KEY,
};
const SPEED_KEYS: Record<ReadVoicePart, string> = {
  tag: READ_TAG_SPEED_STORAGE_KEY,
  author: READ_AUTHOR_SPEED_STORAGE_KEY,
  text: READ_SPEED_STORAGE_KEY,
};

/** Fired on `window` when a read speed changes (`detail`: the speed; listeners re-read both parts), so a card that is playing speeds up live. */
export const READ_SPEED_CHANGE_EVENT = 'pmd-read-speed-change';

/** Read-aloud defaults to 2x speed. */
export const DEFAULT_READ_SPEED = 2;
export const MIN_READ_SPEED = 0.5;
export const MAX_READ_SPEED = 4;

function validSpeed(raw: string | null): number | null {
  const parsed = raw == null ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= MIN_READ_SPEED && parsed <= MAX_READ_SPEED ? parsed : null;
}

/**
 * The stored read speed for `part` (the highlighted text by default), or the
 * 2x default when none (or an out-of-range one) is stored. The tag's speed
 * falls back to the highlighted text's, and the author & year's to the tag's.
 */
export function readStoredSpeed(part: ReadVoicePart = 'text'): number {
  const text = validSpeed(storageGet(READ_SPEED_STORAGE_KEY)) ?? DEFAULT_READ_SPEED;
  if (part === 'text') return text;
  const tag = validSpeed(storageGet(READ_TAG_SPEED_STORAGE_KEY)) ?? text;
  if (part === 'tag') return tag;
  return validSpeed(storageGet(READ_AUTHOR_SPEED_STORAGE_KEY)) ?? tag;
}

/** Saves the read speed for `part` (clamped to 0.5x–4x) and tells every listener. */
export function storeReadSpeed(speed: number, part: ReadVoicePart = 'text'): void {
  if (!Number.isFinite(speed)) return;
  const value = Math.min(MAX_READ_SPEED, Math.max(MIN_READ_SPEED, speed));
  storageSet(SPEED_KEYS[part], String(value));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(READ_SPEED_CHANGE_EVENT, { detail: value }));
}

/** Where "keep reading the next files" (the read-aloud player's toggle) is kept. */
export const READ_CONTINUE_FILES_STORAGE_KEY = 'pmd-read-continue-files';

/** Whether reading the whole document should go on to the next file when it ends. Off by default. */
export function readContinueFiles(): boolean {
  return storageGet(READ_CONTINUE_FILES_STORAGE_KEY) === '1';
}

/** Saves the "keep reading the next files" toggle. */
export function storeContinueFiles(on: boolean): void {
  storageSet(READ_CONTINUE_FILES_STORAGE_KEY, on ? '1' : '0');
}

/**
 * Fired on `window` (cancelable) when reading the whole document reaches its
 * end with "keep reading the next files" on. A host that can open the next
 * file calls `preventDefault()` and opens it; the reader then starts reading
 * the newly opened document from the top. Unclaimed, the read just ends.
 */
export const READ_NEXT_FILE_EVENT = 'pmd-read-next-file';

export const DEFAULT_QWKSEARCH_VOICE_URL = 'https://qwksearch.com/api/agent/voice';

/** Model speech: one clip, or clips to play one after another. */
export type SpeechAudio = Blob | AsyncIterable<Blob>;

/** Speaks text in a Kokoro voice on this device, one clip (paragraph) at a time. */
export type BrowserKokoro = (
  text: string,
  voice: string,
  signal?: AbortSignal,
  onProgress?: (progress: ParagraphProgress) => void,
) => AsyncIterable<Blob>;

/**
 * The default `BrowserKokoro`: one paragraph at a time, from the site's R2
 * cache when someone already made it, else on this device (then uploaded).
 * See `kokoro-paragraph-audio.ts`.
 */
export const paragraphKokoro: BrowserKokoro = (text, voice, signal, onProgress) =>
  streamKokoroParagraphs(text, voice, { signal, onProgress });

export interface FetchModelSpeechOptions {
  /**
   * Kokoro run in the browser, tried first for Kokoro voices. Defaults to
   * `paragraphKokoro` where the browser can run it; `null` skips it.
   */
  browserKokoro?: BrowserKokoro | null;
  /** Kokoro's progress through each paragraph (cache hits report 100% at once). */
  onProgress?: (progress: ParagraphProgress) => void;
  /** The site's TTS route. */
  siteEndpoint?: string;
  /** QwkSearch's voice endpoint, called from the browser as a fallback. */
  qwksearchEndpoint?: string;
  signal?: AbortSignal;
}

function isAudio(res: Response): boolean {
  return res.ok && /^audio\//i.test(res.headers.get('content-type') ?? '');
}

/**
 * The first clip of `stream`, then the rest, as one iterable; null when the
 * stream fails or ends before its first clip (so the caller can try a
 * server). Errors after the first clip end the stream quietly.
 */
async function startStream(stream: AsyncIterable<Blob>, signal?: AbortSignal): Promise<AsyncIterable<Blob> | null> {
  const it = stream[Symbol.asyncIterator]();
  let first: IteratorResult<Blob>;
  try {
    first = await it.next();
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn('[read aloud] Kokoro in the browser failed; using a server voice.', error);
    return null;
  }
  if (first.done) return null;
  const head = first.value;
  return {
    async *[Symbol.asyncIterator]() {
      yield head;
      try {
        for (let next = await it.next(); !next.done; next = await it.next()) yield next.value;
      } catch (error) {
        if (!signal?.aborted) console.warn('[read aloud] Kokoro stopped mid-card.', error);
      }
    },
  };
}

/**
 * Starts downloading the in-browser Kokoro model for a Kokoro voice, so the
 * first Read aloud plays without waiting on the ~90 MB download. A failed
 * download is only logged; the read itself retries it and falls back.
 */
export function preloadModelVoice(voice: ModelVoice, supported: () => boolean = kokoroInBrowserSupported): void {
  if (voice.provider !== 'kokoro' || !supported()) return;
  loadKokoro().catch((error: unknown) => console.warn('[read aloud] Kokoro preload failed.', error));
}

/** Speech audio for `text` in `voice`, or null when no model could give it (see the module doc). */
export async function fetchModelSpeech(
  text: string,
  voice: ModelVoice,
  options: FetchModelSpeechOptions = {},
): Promise<SpeechAudio | null> {
  const browserKokoro =
    options.browserKokoro === undefined ? (kokoroInBrowserSupported() ? paragraphKokoro : null) : options.browserKokoro;
  if (voice.provider === 'kokoro' && browserKokoro) {
    const stream = await startStream(
      browserKokoro(text, voice.voice, options.signal, options.onProgress),
      options.signal,
    );
    if (stream) return stream;
  }
  const { siteEndpoint = '/api/tts', qwksearchEndpoint = DEFAULT_QWKSEARCH_VOICE_URL, signal } = options;
  const payload: Record<string, string> = { text, provider: voice.provider };
  if (voice.voice) payload['voice'] = voice.voice;
  const init = (): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let tryDirect = false;
  try {
    const res = await fetch(siteEndpoint, init());
    if (isAudio(res)) return await res.blob();
    // 429: the site's shared QwkSearch guest allowance is spent. 404/405: no
    // site route here. Either way the visitor's own allowance may still work.
    tryDirect = res.status === 429 || res.status === 404 || res.status === 405;
  } catch (error) {
    if (signal?.aborted) throw error;
    tryDirect = true;
  }
  if (!tryDirect) return null;
  try {
    const res = await fetch(qwksearchEndpoint, init());
    return isAudio(res) ? await res.blob() : null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}
