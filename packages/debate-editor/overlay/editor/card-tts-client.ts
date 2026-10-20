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
 * The reader picks an engine and a voice (`READ_VOICE_OPTIONS`, grouped by
 * `READ_VOICE_ENGINES`): Kokoro in the browser first, Cloudflare Workers AI's
 * Deepgram Aura voices through `/api/tts`, or the browser's speech. The pick
 * is kept in this browser (`storeVoiceId`) and shared by the card buttons'
 * gear menu and Settings → Preferences → Read aloud voice. Whatever the
 * engine, a failure falls through the order above.
 *
 * @module editor/card-tts-client
 */

import { kokoroInBrowserSupported, loadKokoro, streamKokoroSpeech } from './kokoro-browser-tts.js';

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

/** Where the voice choice (a `READ_VOICE_OPTIONS` id) is kept, in this browser only. */
export const READ_VOICE_STORAGE_KEY = 'pmd-card-actions-read-voice';

/** Fired on `window` when the voice choice changes, so open editors and Settings stay in step. */
export const READ_VOICE_CHANGE_EVENT = 'pmd-read-voice-change';

/** The stored voice id, or the default when none (or an unknown one) is stored. */
export function readStoredVoiceId(): string {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(READ_VOICE_STORAGE_KEY);
    return READ_VOICE_OPTIONS.some((o) => o.id === raw) ? (raw as string) : DEFAULT_READ_VOICE_ID;
  } catch {
    return DEFAULT_READ_VOICE_ID;
  }
}

/** Saves the voice choice and tells every listener (the card buttons, Settings). */
export function storeVoiceId(id: string): void {
  if (!READ_VOICE_OPTIONS.some((o) => o.id === id)) return;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(READ_VOICE_STORAGE_KEY, id);
  } catch {
    // Storage blocked: the choice still holds for this page.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(READ_VOICE_CHANGE_EVENT, { detail: id }));
}

export const DEFAULT_QWKSEARCH_VOICE_URL = 'https://qwksearch.com/api/agent/voice';

/** Model speech: one clip, or clips to play one after another. */
export type SpeechAudio = Blob | AsyncIterable<Blob>;

/** Speaks text in a Kokoro voice on this device, one clip at a time. */
export type BrowserKokoro = (text: string, voice: string, signal?: AbortSignal) => AsyncIterable<Blob>;

export interface FetchModelSpeechOptions {
  /**
   * Kokoro run in the browser, tried first for Kokoro voices. Defaults to
   * `streamKokoroSpeech` where the browser can run it; `null` skips it.
   */
  browserKokoro?: BrowserKokoro | null;
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
    options.browserKokoro === undefined ? (kokoroInBrowserSupported() ? streamKokoroSpeech : null) : options.browserKokoro;
  if (voice.provider === 'kokoro' && browserKokoro) {
    const stream = await startStream(browserKokoro(text, voice.voice, options.signal), options.signal);
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
