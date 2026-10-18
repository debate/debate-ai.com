import { describe, expect, it } from "vitest";
import { Mp3Encoder } from "@breezystack/lamejs";
import { MPEGDecoder } from "mpg123-decoder";
import { indexMp3Frames, readFrameHeader, sliceMp3 } from "../src/lib/mp3-frames";
import { splitSpeechAudio } from "../src/lib/split-speech-audio";
import type { AudioSplitTemplate } from "../src/lib/audio-speech-split";

const RATE = 16000;

/**
 * A real MP3 of a miniature round: `[seconds, kind]` stretches, speech as a
 * warbling tone with a breath every few seconds, quiet as faint noise.
 */
function encodeRound(stretches: Array<[number, "speech" | "quiet"]>): Uint8Array {
  const total = stretches.reduce((sum, [seconds]) => sum + Math.round(seconds * RATE), 0);
  const pcm = new Int16Array(total);
  let at = 0;
  let noise = 1;
  for (const [seconds, kind] of stretches) {
    const length = Math.round(seconds * RATE);
    for (let i = 0; i < length; i++, at++) {
      noise = (noise * 16807) % 2147483647;
      const hiss = ((noise / 2147483647) * 2 - 1) * 40;
      const breath = (i / RATE) % 4 > 3.7;
      const voice = kind === "speech" && !breath ? Math.sin((2 * Math.PI * (220 + 30 * Math.sin(i / 900)) * i) / RATE) * 9000 : 0;
      pcm[at] = Math.round(voice + hiss);
    }
  }
  const encoder = new Mp3Encoder(1, RATE, 32);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(encoder.encodeBuffer(pcm.subarray(i, i + 1152)));
  chunks.push(encoder.flush());
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Three short "speeches" with a question period, so the test encodes seconds, not an hour. */
const MINI: AudioSplitTemplate = {
  label: "Mini",
  format: "policy",
  speeches: [
    { name: "1AC", minutes: 0.5 },
    { name: "1AX", minutes: 0.25 },
    { name: "1NC", minutes: 0.5 },
  ],
};

const SCRIPT: Array<[number, "speech" | "quiet"]> = [
  [4, "quiet"],
  [28, "speech"], // 1AC from 4s
  [6, "quiet"],
  [15, "speech"], // 1AX from 38s
  [20, "quiet"],
  [29, "speech"], // 1NC from 73s
  [5, "quiet"],
];

describe("mp3 frames", () => {
  it("indexes every frame and times the file", () => {
    const mp3 = encodeRound([[3, "speech"]]);
    const index = indexMp3Frames(mp3);
    expect(index.sampleRate).toBe(RATE);
    expect(index.durationSeconds).toBeGreaterThan(2.9);
    expect(index.durationSeconds).toBeLessThan(3.2);
    expect(readFrameHeader(mp3, index.offsets[0])?.layer).toBe(3);
  });

  it("skips an ID3v2 tag and junk before the first frame", () => {
    const mp3 = encodeRound([[1, "speech"]]);
    const tag = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 5, 0xff, 0xfb, 1, 2, 3]);
    const tagged = new Uint8Array(tag.length + mp3.length);
    tagged.set(tag);
    tagged.set(mp3, tag.length);
    expect(indexMp3Frames(tagged).count).toBe(indexMp3Frames(mp3).count);
  });

  it("cuts a range into an MP3 that decodes to that much audio", async () => {
    const mp3 = encodeRound([[6, "speech"]]);
    const clip = sliceMp3(mp3, indexMp3Frames(mp3), 2, 4);
    expect(indexMp3Frames(clip).durationSeconds).toBeCloseTo(2, 1);
    const decoder = new MPEGDecoder();
    await decoder.ready;
    const decoded = decoder.decode(clip);
    decoder.free();
    expect(decoded.samplesDecoded / decoded.sampleRate).toBeGreaterThan(1.8);
  });
});

describe("splitSpeechAudio", () => {
  it("finds, names and cuts each speech of a real MP3, decoding it in chunks", async () => {
    const mp3 = encodeRound(SCRIPT);
    const progress: number[] = [];
    const result = await splitSpeechAudio(mp3, {
      template: MINI,
      chunkBytes: 16_384,
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(progress.length).toBeGreaterThan(5);
    expect(progress.at(-1)).toBe(1);
    expect(result.durationSeconds).toBeCloseTo(107, 0);
    expect(result.speeches.map((speech) => speech.name)).toEqual(["1AC", "1AX", "1NC"]);
    [4, 38, 73].forEach((start, i) => expect(Math.abs(result.speeches[i].start - start)).toBeLessThan(0.75));
    [32, 53, 102].forEach((end, i) => expect(Math.abs(result.speeches[i].end - end)).toBeLessThan(0.75));

    expect(result.clips.map((clip) => clip.fileName)).toEqual(["01-1AC.mp3", "02-1AX.mp3", "03-1NC.mp3"]);
    result.clips.forEach((clip, i) => {
      const seconds = indexMp3Frames(clip.bytes).durationSeconds;
      expect(Math.abs(seconds - (result.speeches[i].end - result.speeches[i].start))).toBeLessThan(0.2);
    });
  });

  it("returns timing alone when asked", async () => {
    const result = await splitSpeechAudio(encodeRound(SCRIPT), { template: MINI, timingOnly: true });
    expect(result.clips).toEqual([]);
    expect(result.segmentation.speeches).toHaveLength(3);
  });

  it("rejects a file with no audio", async () => {
    await expect(splitSpeechAudio(new TextEncoder().encode("not an mp3 at all"), { template: MINI })).rejects.toThrow();
  });
});
