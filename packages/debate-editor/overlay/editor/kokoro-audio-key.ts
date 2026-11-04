/**
 * @fileoverview The pure half of the shared Kokoro audio cache: how a
 * paragraph's audio is named in R2, and the WAV handling both sides need.
 * The browser (`kokoro-paragraph-audio.ts`) and the site's
 * `/api/tts/cache` route both import this file, so it touches no DOM and
 * no worker — only `crypto.subtle`, which browsers and Workers both have.
 *
 * - **The key** is the SHA-256 of the model version, the Kokoro voice and
 *   the paragraph's text (whitespace collapsed). Speed is not in it: Kokoro
 *   always speaks at 1x and the player applies the reader's speed as
 *   `playbackRate`, so one clip serves every speed. The server computes the
 *   key itself from the text it is sent, so an upload can only ever be
 *   filed under the text it claims to speak.
 * - **The audio** is one mono 16-bit PCM WAV per paragraph. Kokoro hands
 *   back one 32-bit float WAV per ~280-character piece; `concatWavs` joins
 *   a paragraph's pieces and halves the size on the way.
 *
 * @module editor/kokoro-audio-key
 */

/**
 * Bumped whenever the model, its quantization or the WAV format changes, so
 * clips made by an older setup are never served for a newer one.
 */
export const KOKORO_AUDIO_CACHE_VERSION = 'kokoro-82m-v1.0-q8-pcm16';

/** Longest paragraph generated (and cached) as one clip, in characters. */
export const KOKORO_PARAGRAPH_CHARS = 1500;

/** Longest text the cache accepts for one clip (a paragraph plus slack). */
export const MAX_CACHED_TEXT_CHARS = 4000;

/** Biggest clip the cache accepts: ~4 minutes of 24 kHz 16-bit mono. */
export const MAX_CACHED_AUDIO_BYTES = 12 * 1024 * 1024;

const VOICE_RE = /^[a-z]{2}_[a-z]{2,24}$/;
const KEY_RE = /^[0-9a-f]{64}$/;

/** Kokoro voice ids look like `af_heart`, `bm_george`. */
export function isKokoroVoiceId(voice: string): boolean {
  return VOICE_RE.test(voice);
}

/** A cache key: 64 lowercase hex characters. */
export function isKokoroAudioKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** The text as it is spoken and hashed: whitespace collapsed, trimmed. */
export function normalizeSpeechText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The R2 key for `text` spoken in `voice`, or null where `crypto.subtle` is missing (an insecure origin). */
export async function kokoroAudioCacheKey(text: string, voice: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const input = new TextEncoder().encode(`${KOKORO_AUDIO_CACHE_VERSION}\n${voice}\n${normalizeSpeechText(text)}`);
  const digest = new Uint8Array(await subtle.digest('SHA-256', input));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A parsed WAV: its format and the bytes of its `data` chunk. */
export interface WavInfo {
  format: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  data: Uint8Array;
}

function ascii(view: DataView, at: number): string {
  return String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
}

/** The format and samples of a RIFF/WAVE file, or null when `bytes` isn't one. */
export function parseWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.byteLength < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(view, 0) !== 'RIFF' || ascii(view, 8) !== 'WAVE') return null;
  let fmt: Omit<WavInfo, 'data'> | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(view, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (id === 'fmt ' && size >= 16 && start + 16 <= bytes.byteLength) {
      let format = view.getUint16(start, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format is the sub-format GUID's first two bytes.
      if (format === 0xfffe && size >= 26 && start + 26 <= bytes.byteLength) format = view.getUint16(start + 24, true);
      fmt = {
        format,
        channels: view.getUint16(start + 2, true),
        sampleRate: view.getUint32(start + 4, true),
        bitsPerSample: view.getUint16(start + 14, true),
      };
    } else if (id === 'data') {
      if (!fmt) return null;
      // Some encoders write a 0 or oversized length for a streamed data chunk: take what's there.
      const end = size > 0 ? Math.min(bytes.byteLength, start + size) : bytes.byteLength;
      return { ...fmt, data: bytes.subarray(start, end) };
    }
    offset = start + size + (size % 2);
  }
  return null;
}

/** The first channel of a parsed WAV as 16-bit samples (float and 16-bit PCM are read; anything else gives null). */
function toPcm16(wav: WavInfo): Int16Array | null {
  const { data, channels, bitsPerSample, format } = wav;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const step = (bitsPerSample / 8) * channels;
  if (!channels || !step) return null;
  const frames = Math.floor(data.byteLength / step);
  const out = new Int16Array(frames);
  if (format === 3 && bitsPerSample === 32) {
    for (let i = 0; i < frames; i++) {
      const s = Math.max(-1, Math.min(1, view.getFloat32(i * step, true)));
      out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return out;
  }
  if (format === 1 && bitsPerSample === 16) {
    for (let i = 0; i < frames; i++) out[i] = view.getInt16(i * step, true);
    return out;
  }
  return null;
}

/** A mono 16-bit PCM WAV of `samples`. */
export function encodePcm16Wav(samples: Int16Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.byteLength);
  const view = new DataView(bytes.buffer);
  const write = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.byteLength, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.byteLength, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i]!, true);
  return bytes;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Kokoro's clips for one paragraph joined into one mono 16-bit WAV (the
 * cache's format). Clips that aren't WAVs, or that differ in sample rate
 * from the first, can't be joined: then null.
 */
export async function concatWavs(clips: Blob[]): Promise<Blob | null> {
  if (!clips.length) return null;
  const parts: Int16Array[] = [];
  let rate = 0;
  for (const clip of clips) {
    const wav = parseWav(await blobBytes(clip));
    if (!wav) return null;
    if (rate && wav.sampleRate !== rate) return null;
    rate = wav.sampleRate;
    const pcm = toPcm16(wav);
    if (!pcm) return null;
    parts.push(pcm);
  }
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const joined = new Int16Array(total);
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }
  return new Blob([encodePcm16Wav(joined, rate) as BlobPart], { type: 'audio/wav' });
}

/**
 * Why the cache refuses an upload for `text`, or null when the audio is a
 * clip it keeps: a mono 16-bit PCM WAV, 8–48 kHz, no longer than such text
 * could take to say (a loose bound, about 3 characters a second plus 10 s).
 */
export function cachedAudioProblem(audio: Uint8Array, text: string): string | null {
  if (audio.byteLength > MAX_CACHED_AUDIO_BYTES) return 'Audio too large.';
  const wav = parseWav(audio);
  if (!wav) return 'Not a WAV file.';
  if (wav.format !== 1 || wav.bitsPerSample !== 16 || wav.channels !== 1) return 'Expected mono 16-bit PCM.';
  if (wav.sampleRate < 8000 || wav.sampleRate > 48000) return 'Unexpected sample rate.';
  if (wav.data.byteLength < 2) return 'Empty audio.';
  const seconds = wav.data.byteLength / (wav.sampleRate * 2);
  if (seconds > normalizeSpeechText(text).length / 3 + 10) return 'Audio is far longer than the text.';
  return null;
}
