/**
 * @fileoverview Kokoro read-aloud **one paragraph at a time**, with a
 * per-paragraph percentage and a shared R2 cache, for the card **Read
 * aloud** button, **Read whole document aloud** and the docs **Voice**
 * button.
 *
 * For each paragraph (`speechParagraphs`: the text's lines, long ones cut at
 * sentences to at most `KOKORO_PARAGRAPH_CHARS`):
 *
 * 1. **The cache first.** `GET /api/tts/cache?key=…` (anyone, signed in or
 *    not). The key is the hash of the paragraph's text and voice
 *    (`kokoro-audio-key.ts`). A hit plays at once and reports 100%.
 * 2. **Else Kokoro on this device** (its Web Worker) speaks the paragraph's
 *    ~280-character pieces in turn, reporting the share of the paragraph
 *    done after each, then joins them into one WAV that plays.
 * 3. **Then the upload.** The finished paragraph is posted to
 *    `/api/tts/cache` in the background. Only signed-in users can store
 *    clips: the first `401` turns uploads off for the rest of the page, so
 *    signed-out readers ask once and never again.
 *
 * Paragraphs are produced in order, `ahead` past the one being played, so the
 * next one is usually ready (or at least well along) when the current ends.
 *
 * @module editor/kokoro-paragraph-audio
 */

import { loadKokoro, speechChunks } from './kokoro-browser-tts.js';
import {
  KOKORO_PARAGRAPH_CHARS,
  MAX_CACHED_TEXT_CHARS,
  concatWavs,
  kokoroAudioCacheKey,
  normalizeSpeechText,
} from './kokoro-audio-key.js';

/** The site's shared clip cache. */
export const KOKORO_AUDIO_CACHE_ENDPOINT = '/api/tts/cache';

/** How far one paragraph has come. */
export interface ParagraphProgress {
  /** The paragraph, from 0. */
  index: number;
  /** How many paragraphs the text has. */
  count: number;
  /** 0 to 1. */
  fraction: number;
  /** True when it came from the shared cache rather than this device. */
  cached: boolean;
}

/** Where finished paragraphs are kept and looked up. */
export interface KokoroAudioCache {
  get(text: string, voice: string, signal?: AbortSignal): Promise<Blob | null>;
  put(text: string, voice: string, audio: Blob): Promise<void>;
}

interface KokoroGenerator {
  generate(text: string, options: { voice?: string }): Promise<{ toBlob(): Blob }>;
}

/** The site's R2 cache behind `/api/tts/cache`; see the module doc. */
export function siteKokoroAudioCache(endpoint: string = KOKORO_AUDIO_CACHE_ENDPOINT): KokoroAudioCache {
  let reads = true;
  let writes = true;
  return {
    async get(text, voice, signal) {
      if (!reads || typeof fetch === 'undefined') return null;
      const key = await kokoroAudioCacheKey(text, voice);
      if (!key) return null;
      try {
        const res = await fetch(`${endpoint}?key=${key}`, { signal });
        // No route here (the editor embedded elsewhere) or no bucket: stop asking.
        if (res.status === 405 || res.status === 503) reads = false;
        // A miss is 204 (older deploys: 404); either way there is no audio.
        if (!res.ok || !/^audio\//i.test(res.headers.get('content-type') ?? '')) return null;
        return await res.blob();
      } catch (error) {
        if (signal?.aborted) throw error;
        return null;
      }
    },
    async put(text, voice, audio) {
      if (!writes || typeof fetch === 'undefined' || typeof FormData === 'undefined') return;
      const body = new FormData();
      body.set('text', normalizeSpeechText(text));
      body.set('voice', voice);
      body.set('audio', audio, 'paragraph.wav');
      try {
        const res = await fetch(endpoint, { method: 'POST', body });
        // Signed out (401), no route (404/405) or no bucket (503): this page stops uploading.
        if (res.status === 401 || res.status === 404 || res.status === 405 || res.status === 503) writes = false;
      } catch {
        // Offline: the clip still played; the next reader can make it.
      }
    },
  };
}

let defaultCache: KokoroAudioCache | null = null;

/** One shared site cache per page, so a signed-out `401` is remembered by every reader. */
export function defaultKokoroAudioCache(): KokoroAudioCache {
  defaultCache ??= siteKokoroAudioCache();
  return defaultCache;
}

/** `text` as the paragraphs read and cached: its lines, long ones cut at sentences. */
export function speechParagraphs(text: string, max = KOKORO_PARAGRAPH_CHARS): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => speechChunks(line, max))
    .filter(Boolean);
}

export interface KokoroParagraphOptions {
  signal?: AbortSignal;
  /** The share of this paragraph done, after the cache check and after each piece. */
  onProgress?: (fraction: number, cached: boolean) => void;
  /** Starts (or shares) the model. */
  load?: () => Promise<KokoroGenerator>;
  /** Null: no shared cache. */
  cache?: KokoroAudioCache | null;
  /** False skips the cache lookup (the caller already looked) but still uploads. */
  lookup?: boolean;
}

/**
 * One paragraph's audio: from the cache, else made with Kokoro here (and
 * uploaded). Null when `signal` aborted first; a model error is thrown.
 */
export async function kokoroParagraphAudio(
  text: string,
  voice: string,
  options: KokoroParagraphOptions = {},
): Promise<Blob | null> {
  const { signal, onProgress, load = loadKokoro, lookup = true } = options;
  const cache = options.cache === undefined ? defaultKokoroAudioCache() : options.cache;
  const paragraph = normalizeSpeechText(text);
  if (!paragraph) return null;
  onProgress?.(0, false);
  if (cache && lookup) {
    const hit = await cache.get(paragraph, voice, signal).catch(() => null);
    if (signal?.aborted) return null;
    if (hit) {
      onProgress?.(1, true);
      return hit;
    }
  }
  const tts = await load();
  const pieces = speechChunks(paragraph);
  const total = pieces.reduce((sum, piece) => sum + piece.length, 0) || 1;
  const clips: Blob[] = [];
  let done = 0;
  for (const piece of pieces) {
    if (signal?.aborted) return null;
    const audio = await tts.generate(piece, voice ? { voice } : {});
    if (signal?.aborted) return null;
    clips.push(audio.toBlob());
    done += piece.length;
    onProgress?.(Math.min(1, done / total), false);
  }
  const joined = await concatWavs(clips);
  if (!joined) {
    // Kokoro gave something that isn't the WAV we expect: play it, don't cache it.
    return clips.length === 1 ? clips[0]! : new Blob(clips, { type: clips[0]?.type || 'audio/wav' });
  }
  if (cache && paragraph.length <= MAX_CACHED_TEXT_CHARS) void cache.put(paragraph, voice, joined).catch(() => {});
  return joined;
}

export interface StreamParagraphsOptions extends Omit<KokoroParagraphOptions, 'onProgress' | 'lookup'> {
  onProgress?: (progress: ParagraphProgress) => void;
  /** Paragraphs made ahead of the one being played. */
  ahead?: number;
}

/**
 * Speaks `text` in the Kokoro `voice`, yielding one WAV per paragraph (see
 * the module doc). Stops without throwing once `signal` aborts; an error in
 * a paragraph is thrown when the reader reaches it.
 */
export async function* streamKokoroParagraphs(
  text: string,
  voice: string,
  options: StreamParagraphsOptions = {},
): AsyncGenerator<Blob, void, void> {
  const { signal, onProgress, ahead = 1, ...rest } = options;
  const paragraphs = speechParagraphs(text);
  if (!paragraphs.length) return;
  const count = paragraphs.length;
  const made: Array<Promise<Blob | null> | undefined> = [];
  let chain: Promise<unknown> = Promise.resolve();
  const start = (index: number) => {
    if (index >= count || made[index]) return;
    // One paragraph at a time, in order: the model's worker is serial anyway.
    const job = chain.then(() =>
      signal?.aborted
        ? null
        : kokoroParagraphAudio(paragraphs[index]!, voice, {
            ...rest,
            signal,
            onProgress: (fraction, cached) => onProgress?.({ index, count, fraction, cached }),
          }),
    );
    job.catch(() => {});
    chain = job.catch(() => {});
    made[index] = job;
  };
  for (let i = 0; i < count; i++) {
    for (let j = i; j <= i + ahead; j++) start(j);
    if (signal?.aborted) return;
    const blob = await made[i]!;
    if (!blob || signal?.aborted) return;
    yield blob;
  }
}
