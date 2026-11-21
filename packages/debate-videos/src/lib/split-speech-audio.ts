/**
 * @fileoverview Splits a round's MP3 into its speeches: decode, measure,
 * align, cut — the work behind the admin "Split speeches from audio" button.
 *
 * Runs in the admin's browser, not the Worker, for two reasons that are not
 * about preference:
 *
 *   - `mpg123-decoder` compiles its WebAssembly from an embedded string at
 *     runtime, which Cloudflare Workers refuse ("Wasm code generation
 *     disallowed by embedder") — a Worker can only run WASM it was deployed
 *     with as a module.
 *   - A Worker has 128 MB of memory. A two-hour round is ~115 MB of MP3
 *     before a single sample is decoded.
 *
 * A browser tab has neither limit, so the CPU-heavy half happens there and
 * the Worker only stores the results (the transcript document in D1, the
 * clips in R2). Decoding is streamed in chunks with a yield between them, so
 * the dialog stays responsive and the decoded PCM is never held in full —
 * {@link LoudnessMeter} keeps one number per 50 ms.
 *
 * Clips are cut from the original MP3's frames (`mp3-frames.ts`) rather than
 * re-encoded, so they cost no encoder and lose no quality.
 * @module lib/split-speech-audio
 */

import {
  AUDIO_SPLIT_TEMPLATES,
  LoudnessMeter,
  splitSpeechesFromLoudness,
  type AudioSplitFormat,
  type AudioSplitTemplate,
  type Loudness,
  type SpeechSplit,
  type SplitSpeechOptions,
} from "./audio-speech-split";
import { indexMp3Frames, sliceMp3 } from "./mp3-frames";

/** The slice of `mpg123-decoder`'s `MPEGDecoder` this uses. */
interface Mp3Decoder {
  ready: Promise<void>;
  decode(data: Uint8Array): { channelData: Float32Array[]; samplesDecoded: number; sampleRate: number };
  free(): void;
}

/** MP3 bytes handed to the decoder per call — about a minute of 128 kbps audio. */
const DECODE_CHUNK_BYTES = 1 << 20;

export interface MeasureOptions {
  windowSeconds?: number;
  /** MP3 bytes per decode call; see {@link DECODE_CHUNK_BYTES}. */
  chunkBytes?: number;
  /** Called with the fraction of the file decoded so far. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Decodes an MP3 and measures its loudness, chunk by chunk.
 *
 * @throws An `AbortError` when `signal` aborts, or when the file decodes to nothing.
 */
export async function measureMp3Loudness(bytes: Uint8Array, options: MeasureOptions = {}): Promise<Loudness> {
  const { MPEGDecoder } = (await import("mpg123-decoder")) as unknown as {
    MPEGDecoder: new () => Mp3Decoder;
  };
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const meter = new LoudnessMeter(options.windowSeconds);
  const chunk = Math.max(4096, options.chunkBytes ?? DECODE_CHUNK_BYTES);
  try {
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const decoded = decoder.decode(bytes.subarray(offset, offset + chunk));
      if (decoded.samplesDecoded > 0) meter.push(decoded.channelData, decoded.sampleRate);
      options.onProgress?.(Math.min(1, (offset + chunk) / bytes.length));
      await nextTick();
    }
  } finally {
    decoder.free();
  }
  const loudness = meter.finish();
  if (loudness.rms.length === 0) throw new Error("That file has no MP3 audio in it.");
  return loudness;
}

/** One speech's audio, cut from the round's MP3. */
export interface SpeechClip {
  /** `01-1AC.mp3` — numbered so a folder of them sorts in speaking order. */
  fileName: string;
  name: string;
  startSeconds: number;
  endSeconds: number;
  bytes: Uint8Array;
}

/** `Crossfire 1` → `crossfire-1`, for a file name. */
function fileSlug(name: string): string {
  return name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "speech";
}

/** Cuts each placed speech out of the MP3. */
export function cutSpeechClips(bytes: Uint8Array, split: SpeechSplit): SpeechClip[] {
  const index = indexMp3Frames(bytes);
  return split.speeches.map((speech, i) => ({
    fileName: `${String(i + 1).padStart(2, "0")}-${fileSlug(speech.name)}.mp3`,
    name: speech.name,
    startSeconds: speech.start,
    endSeconds: speech.end,
    bytes: sliceMp3(bytes, index, speech.start, speech.end),
  }));
}

export interface SplitSpeechAudioOptions extends MeasureOptions, SplitSpeechOptions {
  format?: AudioSplitFormat;
  /** A speech order of its own, instead of a known format's. */
  template?: AudioSplitTemplate;
  /** Skip cutting clips — only the timing is wanted. */
  timingOnly?: boolean;
}

export interface SplitSpeechAudioResult extends SpeechSplit {
  clips: SpeechClip[];
}

/** Decode, measure, align and cut, in one call. */
export async function splitSpeechAudio(
  bytes: Uint8Array,
  options: SplitSpeechAudioOptions = {},
): Promise<SplitSpeechAudioResult> {
  const loudness = await measureMp3Loudness(bytes, options);
  const template = options.template ?? AUDIO_SPLIT_TEMPLATES[options.format ?? "policy"];
  const split = splitSpeechesFromLoudness(loudness, template, options);
  return { ...split, clips: options.timingOnly ? [] : cutSpeechClips(bytes, split) };
}
