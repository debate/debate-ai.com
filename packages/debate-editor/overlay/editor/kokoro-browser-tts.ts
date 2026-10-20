/**
 * @fileoverview Kokoro text-to-speech run **in the browser** for the card
 * hover **Read aloud** button: the Kokoro-82M ONNX model is downloaded once
 * from Hugging Face (`kokoro-js` on Transformers.js / ONNX Runtime Web, which
 * keeps it in the browser's Cache Storage) and speaks with no server call.
 *
 * - The model runs in a Web Worker (`kokoro-worker.ts`), never on the
 *   page's thread: ONNX Runtime Web's WebAssembly inference is synchronous
 *   and takes seconds per sentence, which froze the page when it ran here.
 *   The worker (with its ~2 MB `kokoro-js` runtime and the ~90 MB quantized
 *   `q8` model) starts only the first time someone hovers or reads a card
 *   in a Kokoro voice. A failed load ends the worker and is forgotten, so
 *   the next read retries; until then the caller falls back to a server or
 *   the browser's speech.
 * - Kokoro reads at most ~510 phoneme tokens per call and highlighted card
 *   text often has no sentence breaks, so `speechChunks` cuts the text into
 *   short pieces (at sentence ends, else commas, else spaces) and
 *   `streamKokoroSpeech` yields one WAV per piece. The caller plays the first
 *   while the next is generated.
 * - Speed is left at 1: the player applies the reader's speed as
 *   `playbackRate`, which also changes live.
 *
 * @module editor/kokoro-browser-tts
 */

import type { KokoroWorkerRequest, KokoroWorkerResponse } from './kokoro-worker.js';

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** The worker's answer to one request (progress updates aside). */
type KokoroWorkerReply = Exclude<KokoroWorkerResponse, { progress: number }>;

/** Also written in kokoro-worker.ts, which loads it. */
export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/** Longest piece handed to the model at once, in characters. */
export const KOKORO_CHUNK_CHARS = 280;

interface KokoroModel {
  generate(text: string, options: { voice?: string; speed?: number }): Promise<{ toBlob(): Blob }>;
  /** Ends the worker holding the model. */
  dispose?(): void;
}

/** Cache Storage bucket Transformers.js keeps downloaded model files in. */
export const KOKORO_CACHE_NAME = 'transformers-cache';

/** Roughly what the download weighs (the `q8` model plus its config), for Settings before it's cached. */
export const KOKORO_DOWNLOAD_BYTES = 92_000_000;

/** Starts the worker that runs the model (swapped in tests). */
export type KokoroWorkerFactory = () => Worker;

/**
 * The bundler sees this exact `new Worker(new URL(…, import.meta.url))`
 * shape and emits kokoro-worker.ts (with kokoro-js) as its own worker chunk.
 */
function startKokoroWorker(): Worker {
  return new Worker(new URL('./kokoro-worker.ts', import.meta.url), { type: 'module', name: 'kokoro-tts' });
}

let modelPromise: Promise<KokoroModel> | null = null;

/** Whether this browser can run the model (a module Worker with WebAssembly, and an `Audio` to play it). */
export function kokoroInBrowserSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof WebAssembly === 'object' &&
    typeof Audio !== 'undefined'
  );
}

/**
 * A `KokoroModel` whose calls are messages to a worker made by `create`.
 * Resolves once the worker has the model ready; rejects (and ends the
 * worker) when it can't start or load it. A worker that dies later fails
 * every waiting call and is forgotten.
 */
export function kokoroWorkerModel(
  create: KokoroWorkerFactory,
  onDead: () => void = () => {},
  onProgress: (fraction: number) => void = () => {},
): Promise<KokoroModel> {
  let worker: Worker;
  try {
    worker = create();
  } catch (error) {
    return Promise.reject(error);
  }
  let nextId = 0;
  let dead = false;
  const pending = new Map<number, { resolve: (r: KokoroWorkerReply) => void; reject: (e: Error) => void }>();
  const die = (error: Error) => {
    if (dead) return;
    dead = true;
    worker.terminate();
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
    onDead();
  };
  worker.onmessage = (event: MessageEvent<KokoroWorkerResponse>) => {
    if ('progress' in event.data) {
      onProgress(event.data.progress);
      return;
    }
    const waiter = pending.get(event.data.id);
    if (!waiter) return;
    pending.delete(event.data.id);
    waiter.resolve(event.data);
  };
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault?.();
    die(new Error(event.message || 'Kokoro worker failed'));
  };
  const call = (request: DistributiveOmit<KokoroWorkerRequest, 'id'>): Promise<KokoroWorkerReply> =>
    new Promise((resolve, reject) => {
      if (dead) {
        reject(new Error('Kokoro worker stopped'));
        return;
      }
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...request, id } as KokoroWorkerRequest);
    });
  const model: KokoroModel = {
    async generate(text, options) {
      const res = await call({ type: 'generate', text, voice: options.voice });
      if (!res.ok) throw new Error(res.error);
      const audio = res.audio;
      if (!audio) throw new Error('Kokoro worker sent no audio');
      return { toBlob: () => audio };
    },
    dispose: () => die(new Error('Kokoro worker stopped')),
  };
  return call({ type: 'load' }).then(
    (res) => {
      if (res.ok) return model;
      const error = new Error(res.error);
      die(error);
      throw error;
    },
    (error: unknown) => {
      die(error instanceof Error ? error : new Error(String(error)));
      throw error;
    },
  );
}

const progressListeners = new Set<(fraction: number) => void>();

/** The model, started in its worker on first use and shared by every later read. */
export function loadKokoro(create: KokoroWorkerFactory = startKokoroWorker): Promise<KokoroModel> {
  if (modelPromise) return modelPromise;
  const promise = kokoroWorkerModel(
    create,
    () => {
      if (modelPromise === promise) modelPromise = null;
    },
    (fraction) => progressListeners.forEach((listener) => listener(fraction)),
  );
  modelPromise = promise;
  promise.catch(() => {
    if (modelPromise === promise) modelPromise = null;
  });
  return promise;
}

/**
 * Downloads the model ahead of time (Settings' **Download** button), the
 * same load a first Read aloud does, reporting progress from 0 to 1.
 * Resolves once it's cached and ready; already-downloaded models resolve
 * almost at once.
 */
export async function downloadKokoro(
  onProgress?: (fraction: number) => void,
  create: KokoroWorkerFactory = startKokoroWorker,
): Promise<void> {
  if (onProgress) progressListeners.add(onProgress);
  try {
    await loadKokoro(create);
    onProgress?.(1);
  } finally {
    if (onProgress) progressListeners.delete(onProgress);
  }
}

/** Whether the model's files are in this browser's cache, and how many bytes they take. */
export interface KokoroModelStatus {
  downloaded: boolean;
  bytes: number;
}

/** The cached requests that belong to the Kokoro model, and the open cache; null when there's no cache yet. */
async function kokoroCacheEntries(): Promise<{ cache: Cache; keys: Request[] } | null> {
  if (typeof caches === 'undefined' || !(await caches.has(KOKORO_CACHE_NAME))) return null;
  const cache = await caches.open(KOKORO_CACHE_NAME);
  const keys = (await cache.keys()).filter((request) => request.url.includes(`/${KOKORO_MODEL_ID}/`));
  return { cache, keys };
}

/** What Settings shows for Kokoro: downloaded once the model weights are cached. */
export async function kokoroModelStatus(): Promise<KokoroModelStatus> {
  const entries = await kokoroCacheEntries();
  if (!entries) return { downloaded: false, bytes: 0 };
  let bytes = 0;
  for (const request of entries.keys) {
    const response = await entries.cache.match(request);
    const length = Number(response?.headers.get('content-length'));
    bytes += Number.isFinite(length) && length > 0 ? length : ((await response?.blob())?.size ?? 0);
  }
  return { downloaded: entries.keys.some((request) => /\/onnx\/model[^/]*\.onnx$/.test(request.url)), bytes };
}

/**
 * Deletes the cached model (Settings' **Remove**) and ends the worker
 * holding it, so the memory is freed too. The next Kokoro read downloads it
 * again.
 */
export async function removeKokoroModel(): Promise<void> {
  const loaded = modelPromise;
  modelPromise = null;
  if (loaded) void loaded.then((model) => model.dispose?.(), () => {});
  const entries = await kokoroCacheEntries();
  if (!entries) return;
  await Promise.all(entries.keys.map((request) => entries.cache.delete(request)));
}

/** Splits `text` at `pattern` into pieces of at most `max` characters, packing neighbours together. */
function pack(parts: string[], max: number, joiner: string): string[] {
  const out: string[] = [];
  let current = '';
  for (const part of parts) {
    if (!part) continue;
    const next = current ? `${current}${joiner}${part}` : part;
    if (next.length <= max || !current) {
      current = next;
    } else {
      out.push(current);
      current = part;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * `text` cut into pieces of at most `max` characters for the model:
 * sentences first, then clauses at commas or semicolons, then words. A
 * single word longer than `max` stays whole.
 */
export function speechChunks(text: string, max = KOKORO_CHUNK_CHARS): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const pieces: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= max) {
      pieces.push(sentence);
      continue;
    }
    for (const clause of pack(sentence.split(/(?<=[,;:])\s+/), max, ' ')) {
      if (clause.length <= max) pieces.push(clause);
      else pieces.push(...pack(clause.split(' '), max, ' '));
    }
  }
  return pack(pieces, max, ' ');
}

/**
 * Speaks `text` in the Kokoro `voice`, yielding one WAV blob per piece of
 * `speechChunks`. Stops (without throwing) once `signal` aborts; a model
 * download or generation error is thrown to the caller.
 */
export async function* streamKokoroSpeech(
  text: string,
  voice: string,
  signal?: AbortSignal,
  load: () => Promise<KokoroModel> = loadKokoro,
): AsyncGenerator<Blob, void, void> {
  const chunks = speechChunks(text);
  if (!chunks.length) return;
  const tts = await load();
  for (const chunk of chunks) {
    if (signal?.aborted) return;
    const audio = await tts.generate(chunk, voice ? { voice } : {});
    if (signal?.aborted) return;
    yield audio.toBlob();
  }
}
