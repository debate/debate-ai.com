/**
 * @fileoverview Kokoro text-to-speech run **in the browser** for the card
 * hover **Read aloud** button: the Kokoro-82M ONNX model is downloaded once
 * from Hugging Face (`kokoro-js` on Transformers.js / ONNX Runtime Web, which
 * keeps it in the browser's Cache Storage) and speaks with no server call.
 *
 * - `kokoro-js` is imported lazily, so its ~2 MB runtime and the ~90 MB
 *   quantized (`q8`) model load only the first time someone reads a card
 *   aloud in a Kokoro voice. A failed load is forgotten so the next read
 *   retries.
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

export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/** Longest piece handed to the model at once, in characters. */
export const KOKORO_CHUNK_CHARS = 280;

interface KokoroModel {
  generate(text: string, options: { voice?: string; speed?: number }): Promise<{ toBlob(): Blob }>;
}

let modelPromise: Promise<KokoroModel> | null = null;

/** Whether this browser can run the model (WebAssembly, and an `Audio` to play it). */
export function kokoroInBrowserSupported(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly === 'object' && typeof Audio !== 'undefined';
}

/** The model, downloaded on first use and shared by every later read. */
export function loadKokoro(): Promise<KokoroModel> {
  modelPromise ??= import('kokoro-js')
    .then(({ KokoroTTS }) => KokoroTTS.from_pretrained(KOKORO_MODEL_ID, { dtype: 'q8', device: 'wasm' }))
    .then((tts) => tts as unknown as KokoroModel)
    .catch((error: unknown) => {
      modelPromise = null;
      throw error;
    });
  return modelPromise;
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
