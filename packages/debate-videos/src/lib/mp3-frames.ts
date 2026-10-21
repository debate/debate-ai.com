/**
 * @fileoverview An MP3 file's frames, read from their headers — the index the
 * audio speech splitter cuts its clips with.
 *
 * An MP3 is a run of self-describing frames, each 26 ms or so of audio. Cut
 * the file between two frames and both halves still play, so a speech's clip
 * is just the bytes of the frames it spans: no decode, no re-encode, no
 * generation loss, and a two-hour round is cut in milliseconds instead of the
 * minutes LAME would take to encode twelve clips again. (The bit reservoir can
 * make a clip's very first frame decode short — one frame, at the edge of a
 * pause, which nobody hears.)
 *
 * Parsing headers is all this does; `split-speech-audio.ts` decodes the audio
 * itself to measure how loud it is.
 * @module lib/mp3-frames
 */

/** kbps by bitrate index, for MPEG-1 layers I–III and MPEG-2/2.5 layer I and II/III. */
const BITRATES = {
  v1l1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  v1l2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  v1l3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2l1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  v2l23: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
} as const;

/** Hz by sample-rate index, per MPEG version. */
const SAMPLE_RATES: Record<1 | 2 | 25, readonly number[]> = {
  1: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  25: [11025, 12000, 8000],
};

/** One frame header, as far as cutting the file needs. */
export interface Mp3FrameHeader {
  version: 1 | 2 | 25;
  layer: 1 | 2 | 3;
  bitrateKbps: number;
  sampleRate: number;
  /** Bytes in the whole frame, header included. */
  length: number;
  /** PCM samples per channel the frame decodes to. */
  samples: number;
}

/**
 * Reads the four-byte frame header at `offset`.
 *
 * @returns The header, or `null` when the bytes there are not a valid one
 *   (no sync word, a reserved field, or a "free" bitrate this can't size).
 */
export function readFrameHeader(bytes: Uint8Array, offset: number): Mp3FrameHeader | null {
  if (offset + 4 > bytes.length) return null;
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  if (bytes[offset] !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const versionBits = (b1 >> 3) & 0b11;
  const layerBits = (b1 >> 1) & 0b11;
  const bitrateIndex = b2 >> 4;
  const rateIndex = (b2 >> 2) & 0b11;
  if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) {
    return null;
  }

  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 25;
  const layer = (4 - layerBits) as 1 | 2 | 3;
  const padding = (b2 >> 1) & 1;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  const table =
    version === 1
      ? layer === 1
        ? BITRATES.v1l1
        : layer === 2
          ? BITRATES.v1l2
          : BITRATES.v1l3
      : layer === 1
        ? BITRATES.v2l1
        : BITRATES.v2l23;
  const bitrateKbps = table[bitrateIndex];
  const bitrate = bitrateKbps * 1000;

  let length: number;
  let samples: number;
  if (layer === 1) {
    length = (Math.floor((12 * bitrate) / sampleRate) + padding) * 4;
    samples = 384;
  } else if (layer === 2 || version === 1) {
    length = Math.floor((144 * bitrate) / sampleRate) + padding;
    samples = 1152;
  } else {
    length = Math.floor((72 * bitrate) / sampleRate) + padding;
    samples = 576;
  }
  return { version, layer, bitrateKbps, sampleRate, length, samples };
}

/** Bytes an ID3v2 tag at the start of the file takes, or 0 when there is none. */
export function id3v2Size(bytes: Uint8Array): number {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const footer = bytes[5] & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

/** Whether a frame is a Xing / Info / VBRI header, which describes the file and carries no audio. */
function isInfoFrame(bytes: Uint8Array, offset: number, length: number): boolean {
  const end = Math.min(bytes.length, offset + Math.min(length, 64));
  for (let i = offset + 4; i + 4 <= end; i++) {
    const tag = String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
    if (tag === "Xing" || tag === "Info" || tag === "VBRI") return true;
  }
  return false;
}

/** Every audio frame of a file, as parallel arrays — a two-hour round has ~280k. */
export interface Mp3FrameIndex {
  /** Byte offset of each frame. */
  offsets: Uint32Array;
  /** Byte length of each frame. */
  lengths: Uint32Array;
  /** Second each frame starts at. */
  times: Float64Array;
  count: number;
  sampleRate: number;
  durationSeconds: number;
}

/**
 * Walks the file frame by frame. A sync word only counts when the frame after
 * it also parses with the same version, layer and rate, so stray `0xFFE` bit
 * patterns in a tag or junk between frames are skipped rather than trusted.
 * The Xing/Info header frame is left out, since a clip that kept it would
 * claim the whole file's frame count.
 */
export function indexMp3Frames(bytes: Uint8Array): Mp3FrameIndex {
  let capacity = Math.max(64, Math.ceil(bytes.length / 100));
  let offsets = new Uint32Array(capacity);
  let lengths = new Uint32Array(capacity);
  let times = new Float64Array(capacity);
  let count = 0;
  let sampleRate = 0;
  let time = 0;
  let first = true;

  let offset = id3v2Size(bytes);
  while (offset + 4 <= bytes.length) {
    const header = readFrameHeader(bytes, offset);
    if (!header || header.length < 4) {
      offset++;
      continue;
    }
    const nextOffset = offset + header.length;
    if (nextOffset + 4 <= bytes.length) {
      const next = readFrameHeader(bytes, nextOffset);
      if (
        !next ||
        next.version !== header.version ||
        next.layer !== header.layer ||
        next.sampleRate !== header.sampleRate
      ) {
        offset++;
        continue;
      }
    } else if (nextOffset > bytes.length) {
      break; // a truncated last frame
    }

    if (first && isInfoFrame(bytes, offset, header.length)) {
      first = false;
      offset = nextOffset;
      continue;
    }
    first = false;

    if (count === capacity) {
      capacity *= 2;
      const grow = <T extends Uint32Array | Float64Array>(array: T, Type: new (n: number) => T): T => {
        const bigger = new Type(capacity);
        bigger.set(array);
        return bigger;
      };
      offsets = grow(offsets, Uint32Array);
      lengths = grow(lengths, Uint32Array);
      times = grow(times, Float64Array);
    }
    offsets[count] = offset;
    lengths[count] = header.length;
    times[count] = time;
    count++;
    sampleRate ||= header.sampleRate;
    time += header.samples / header.sampleRate;
    offset = nextOffset;
  }

  return {
    offsets: offsets.subarray(0, count),
    lengths: lengths.subarray(0, count),
    times: times.subarray(0, count),
    count,
    sampleRate,
    durationSeconds: time,
  };
}

/** The first frame starting at or after `seconds` (binary search). */
function frameAt(index: Mp3FrameIndex, seconds: number): number {
  let low = 0;
  let high = index.count;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (index.times[mid] < seconds) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * The frames from `startSeconds` to `endSeconds` as a playable MP3 of their
 * own — a copy, so the source can be released.
 *
 * @returns The clip, or an empty array when the range holds no frame.
 */
export function sliceMp3(
  bytes: Uint8Array,
  index: Mp3FrameIndex,
  startSeconds: number,
  endSeconds: number,
): Uint8Array {
  const first = frameAt(index, Math.max(0, startSeconds));
  const last = Math.min(index.count, frameAt(index, endSeconds));
  if (last <= first) return new Uint8Array(0);
  const from = index.offsets[first];
  const to = index.offsets[last - 1] + index.lengths[last - 1];
  return bytes.slice(from, to);
}
