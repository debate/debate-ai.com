/**
 * @fileoverview The Web Worker that runs Kokoro for the card hover **Read
 * aloud** button (`kokoro-browser-tts.ts` starts it). ONNX Runtime Web's
 * WebAssembly inference is synchronous on whatever thread runs it, and
 * Kokoro spends seconds of CPU per sentence, so on the page's own thread it
 * froze the whole editor (scrolling, typing, even the Stop button) for the
 * model setup and every clip. Here it only ties up this worker.
 *
 * Messages in: `{ id, type: 'load' }` (download and set up the model) and
 * `{ id, type: 'generate', text, voice }`. Each is answered with
 * `{ id, ok: true, audio? }` (a WAV blob for `generate`) or
 * `{ id, ok: false, error }`. Requests run one at a time, in order.
 *
 * @module editor/kokoro-worker
 */

import { KokoroTTS } from 'kokoro-js';

export type KokoroWorkerRequest =
  | { id: number; type: 'load' }
  | { id: number; type: 'generate'; text: string; voice?: string };

export type KokoroWorkerResponse = { id: number; ok: true; audio?: Blob } | { id: number; ok: false; error: string };

interface WorkerScope {
  onmessage: ((event: MessageEvent<KokoroWorkerRequest>) => void) | null;
  postMessage(message: KokoroWorkerResponse): void;
}

/** Kept in step with `KOKORO_MODEL_ID` in kokoro-browser-tts.ts (not imported, so neither file bundles the other). */
const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

const scope = self as unknown as WorkerScope;

let model: Promise<KokoroTTS> | null = null;

function load(): Promise<KokoroTTS> {
  model ??= KokoroTTS.from_pretrained(KOKORO_MODEL_ID, { dtype: 'q8', device: 'wasm' }).catch((error: unknown) => {
    model = null;
    throw error;
  });
  return model;
}

async function handle(request: KokoroWorkerRequest): Promise<KokoroWorkerResponse> {
  try {
    const tts = await load();
    if (request.type === 'load') return { id: request.id, ok: true };
    // `voice` is typed as kokoro-js's union of voice ids; ours come from READ_VOICE_OPTIONS.
    const options = (request.voice ? { voice: request.voice } : {}) as Parameters<KokoroTTS['generate']>[1];
    const audio = await tts.generate(request.text, options);
    return { id: request.id, ok: true, audio: audio.toBlob() };
  } catch (error) {
    return { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

let queue: Promise<void> = Promise.resolve();

scope.onmessage = (event) => {
  const request = event.data;
  queue = queue.then(async () => scope.postMessage(await handle(request)));
};
