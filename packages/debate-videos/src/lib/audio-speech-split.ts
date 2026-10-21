/**
 * @fileoverview A round's speeches found in its audio — the pauses between
 * them — for the admin "Split speeches from audio" button.
 *
 * The caption-based "Detect speeches" needs captions and a model call. This
 * needs neither: a round is speeches separated by prep time and the shuffle
 * of the next speaker getting up, and those gaps are quiet. So the audio is
 * decoded once (`split-speech-audio.ts`), reduced to one loudness value per
 * 50 ms window by {@link LoudnessMeter}, and everything here works on that
 * array — a two-hour round is 144,000 numbers.
 *
 *   1. **Voiced regions.** Windows above a threshold set from the recording's
 *      own noise floor ({@link silenceThreshold}) are sound; runs of them
 *      separated by less than a breath are joined ({@link findVoicedRegions}).
 *   2. **Which region is which speech.** A threshold alone can't tell a 1AC
 *      from the 1AX that follows ten seconds later, or from the judge's RFD
 *      after the 2AR, and "keep the twelve longest" drops the cross-exes for
 *      the RFD. What does tell them apart is that every format times its
 *      speeches. {@link alignSpeeches} lines the regions up against the
 *      format's speeches in order (dynamic programming): a speech is one or
 *      more consecutive regions, merging across a long pause is expensive,
 *      running far past a speech's time is expensive, and a region left out
 *      (intro chatter, the RFD) costs a little per minute. The cheapest
 *      alignment names every speech and says where it starts and ends.
 *
 * The result is a {@link SpeechSegmentation}, the same shape the caption
 * detector produces, so the watch page, the Outcomes simulator and the
 * transcript document all read it without knowing where it came from.
 *
 * Pure: no decoding, no I/O.
 * @module lib/audio-speech-split
 */

import { formatTimecode } from "./video-documents";
import {
  segmentedSpeechHeading,
  type SegmentationCaption,
  type SegmentedFormat,
  type SpeechSegmentation,
} from "./speech-segmentation";

/** The formats the splitter knows the speech times of. */
export type AudioSplitFormat = "policy" | "college-policy" | "ld" | "pf";

/** A format's speeches in order, with the minutes each is allowed. */
export interface AudioSplitTemplate {
  label: string;
  /** What the resulting segmentation says the format is. */
  format: Exclude<SegmentedFormat, "other">;
  speeches: Array<{ name: string; minutes: number }>;
}

const policy = (constructive: number, cx: number, rebuttal: number) =>
  [
    ["1AC", constructive],
    ["1AX", cx],
    ["1NC", constructive],
    ["1NX", cx],
    ["2AC", constructive],
    ["2AX", cx],
    ["2NC", constructive],
    ["2NX", cx],
    ["1NR", rebuttal],
    ["1AR", rebuttal],
    ["2NR", rebuttal],
    ["2AR", rebuttal],
  ].map(([name, minutes]) => ({ name: name as string, minutes: minutes as number }));

export const AUDIO_SPLIT_TEMPLATES: Record<AudioSplitFormat, AudioSplitTemplate> = {
  policy: { label: "Policy (8-3-5)", format: "policy", speeches: policy(8, 3, 5) },
  "college-policy": { label: "College policy (9-3-6)", format: "policy", speeches: policy(9, 3, 6) },
  ld: {
    label: "Lincoln-Douglas",
    format: "ld",
    speeches: [
      { name: "1AC", minutes: 6 },
      { name: "1AX", minutes: 3 },
      { name: "1NC", minutes: 7 },
      { name: "1NX", minutes: 3 },
      { name: "1AR", minutes: 4 },
      { name: "NR", minutes: 6 },
      { name: "2AR", minutes: 3 },
    ],
  },
  pf: {
    label: "Public Forum",
    format: "pf",
    speeches: [
      { name: "Pro Constructive", minutes: 4 },
      { name: "Con Constructive", minutes: 4 },
      { name: "Crossfire 1", minutes: 3 },
      { name: "Pro Rebuttal", minutes: 4 },
      { name: "Con Rebuttal", minutes: 4 },
      { name: "Crossfire 2", minutes: 3 },
      { name: "Pro Summary", minutes: 3 },
      { name: "Con Summary", minutes: 3 },
      { name: "Grand Crossfire", minutes: 3 },
      { name: "Pro Final Focus", minutes: 2 },
      { name: "Con Final Focus", minutes: 2 },
    ],
  },
};

export const AUDIO_SPLIT_FORMATS = Object.keys(AUDIO_SPLIT_TEMPLATES) as AudioSplitFormat[];

/** The template a video's numeric `style` (`videos.style`) points at; policy when unknown. */
export function audioSplitFormatForStyle(style: number | null | undefined): AudioSplitFormat {
  if (style === 2) return "pf";
  if (style === 3) return "ld";
  if (style === 4) return "college-policy";
  return "policy";
}

/** A recording reduced to its loudness, one RMS value per window. */
export interface Loudness {
  rms: Float32Array;
  windowSeconds: number;
  sampleRate: number;
  durationSeconds: number;
}

/**
 * Turns decoded PCM, fed in whatever chunks the decoder hands out, into one
 * RMS value per window. Channels are averaged, and a window may straddle two
 * chunks, so nothing but the running sums is ever held — the PCM of a long
 * round would not fit in memory.
 */
export class LoudnessMeter {
  private values: Float32Array = new Float32Array(4096);
  private count = 0;
  private windowSamples = 0;
  private sum = 0;
  private filled = 0;
  private samples = 0;
  private rate = 0;

  constructor(readonly windowSeconds = 0.05) {}

  push(channelData: Float32Array[], sampleRate: number): void {
    const channels = channelData.length;
    if (channels === 0 || sampleRate <= 0) return;
    if (!this.rate) {
      this.rate = sampleRate;
      this.windowSamples = Math.max(1, Math.round(sampleRate * this.windowSeconds));
    }
    const length = channelData[0].length;
    for (let i = 0; i < length; i++) {
      let square = 0;
      for (let c = 0; c < channels; c++) {
        const sample = channelData[c][i];
        square += sample * sample;
      }
      this.sum += square / channels;
      if (++this.filled === this.windowSamples) this.flush();
    }
    this.samples += length;
  }

  private flush(): void {
    if (this.filled === 0) return;
    if (this.count === this.values.length) {
      const bigger = new Float32Array(this.values.length * 2);
      bigger.set(this.values);
      this.values = bigger;
    }
    this.values[this.count++] = Math.sqrt(this.sum / this.filled);
    this.sum = 0;
    this.filled = 0;
  }

  finish(): Loudness {
    this.flush();
    return {
      rms: this.values.slice(0, this.count),
      windowSeconds: this.rate ? this.windowSamples / this.rate : this.windowSeconds,
      sampleRate: this.rate,
      durationSeconds: this.rate ? this.samples / this.rate : 0,
    };
  }
}

/** The value `fraction` of the way up the sorted array. */
function percentile(sorted: Float32Array, fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

/**
 * The loudness below which a window counts as a pause, from the recording
 * itself: a fifth of the way from its noise floor (the 10th percentile) to a
 * typical voiced level (the 70th — a round is mostly talking). A classroom
 * with a humming projector and a studio recording both get a threshold that
 * sits between their own silence and their own speech.
 */
export function silenceThreshold(rms: Float32Array): number {
  if (rms.length === 0) return 0;
  const sorted = rms.slice().sort();
  const floor = percentile(sorted, 0.1);
  const voiced = percentile(sorted, 0.7);
  return Math.max(1e-4, floor + (voiced - floor) * 0.2);
}

/** A stretch of sound between pauses, in seconds. */
export interface VoicedRegion {
  start: number;
  end: number;
}

export interface VoicedRegionOptions {
  /** RMS below which a window is a pause; set from the recording when omitted. */
  threshold?: number;
  /** Shorter pauses than this are breaths inside a speech and are joined over. */
  minPauseSeconds?: number;
  /** Sound shorter than this (a cough, a chair) is dropped. */
  minRegionSeconds?: number;
}

/**
 * The alignment is quadratic in the number of regions; a noisy recording that
 * yields more than this is re-read with longer minimum pauses until it fits.
 */
export const MAX_ALIGNED_REGIONS = 400;

function voicedRuns(loudness: Loudness, threshold: number, minPause: number, minRegion: number): VoicedRegion[] {
  const { rms, windowSeconds } = loudness;
  const regions: VoicedRegion[] = [];
  let start = -1;
  let lastVoiced = -1;
  const close = () => {
    if (start < 0) return;
    const region = { start: start * windowSeconds, end: (lastVoiced + 1) * windowSeconds };
    if (region.end - region.start >= minRegion) regions.push(region);
    start = -1;
  };
  for (let i = 0; i < rms.length; i++) {
    if (rms[i] < threshold) continue;
    if (start >= 0 && (i - lastVoiced - 1) * windowSeconds >= minPause) close();
    if (start < 0) start = i;
    lastVoiced = i;
  }
  close();
  return regions;
}

/** The recording's sound, as regions separated by pauses. */
export function findVoicedRegions(loudness: Loudness, options: VoicedRegionOptions = {}): VoicedRegion[] {
  const threshold = options.threshold ?? silenceThreshold(loudness.rms);
  const minRegion = options.minRegionSeconds ?? 1;
  let minPause = options.minPauseSeconds ?? 1.5;
  let regions = voicedRuns(loudness, threshold, minPause, minRegion);
  while (regions.length > MAX_ALIGNED_REGIONS && minPause < 600) {
    minPause *= 1.5;
    regions = voicedRuns(loudness, threshold, minPause, minRegion);
  }
  return regions;
}

/** A speech the alignment placed, in exact seconds. */
export interface AlignedSpeech {
  name: string;
  start: number;
  end: number;
}

/**
 * How far a speech's length is from its allotted time. Running short is
 * common (rebuttals end early, a CX gets cut off) and cheap; running well
 * past the time almost never happens in a timed round, so it is expensive.
 */
function durationCost(seconds: number, expectedSeconds: number): number {
  const ratio = Math.max(seconds, 1) / expectedSeconds;
  if (ratio > 1.15) return 6 * Math.log(ratio / 1.15);
  if (ratio < 1) return 0.8 * Math.log(1 / ratio);
  return 0;
}

/** Joining two regions into one speech across a pause: breaths free, prep time prohibitive. */
function mergeCost(gapSeconds: number): number {
  return (gapSeconds / 8) ** 2;
}

/**
 * Leaving a region out of every speech. Before the first speech (the judge
 * and debaters getting set up) and after the last (the decision and the
 * RFD) that is what the region usually is, so it is cheap; between speeches
 * it is chatter during prep, and a long one is more likely part of a speech.
 */
function skipCost(region: VoicedRegion, atEdge: boolean): number {
  return (atEdge ? 0.05 : 0.4) * ((region.end - region.start) / 60);
}

/**
 * Naming a speech the recording doesn't have. Recordings start late and stop
 * early, so a speech missing before the first sound or after the last is
 * cheap; one missing from the middle of a round almost never happens, and
 * pricing it the same would let the alignment shift every name by one.
 */
const MISSING_EDGE_SPEECH_COST = 1.5;
const MISSING_MIDDLE_SPEECH_COST = 6;

/**
 * Lines the regions up with a format's speeches, in order — see the file
 * comment. A speech the recording lacks (it started late, stopped early) is
 * left out of the result.
 */
export function alignSpeeches(
  regions: VoicedRegion[],
  speeches: Array<{ name: string; minutes: number }>,
): AlignedSpeech[] {
  const m = regions.length;
  const n = speeches.length;
  if (m === 0 || n === 0) return [];

  const width = n + 1;
  const cost = new Float64Array((m + 1) * width).fill(Number.POSITIVE_INFINITY);
  // How each cell was reached: -1 skip a region, -2 miss a speech, k ≥ 0 a speech of regions k..i-1.
  const from = new Int32Array((m + 1) * width);
  cost[0] = 0;

  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      const cell = i * width + j;
      if (i === 0 && j === 0) continue;
      let best = Number.POSITIVE_INFINITY;
      let move = -1;
      if (i > 0) {
        const value = cost[(i - 1) * width + j] + skipCost(regions[i - 1], j === 0 || j === n);
        if (value < best) [best, move] = [value, -1];
      }
      if (j > 0) {
        const missing = i === 0 || i === m ? MISSING_EDGE_SPEECH_COST : MISSING_MIDDLE_SPEECH_COST;
        const value = cost[i * width + j - 1] + missing;
        if (value < best) [best, move] = [value, -2];
        const expected = speeches[j - 1].minutes * 60;
        let gaps = 0;
        for (let k = i - 1; k >= 0; k--) {
          if (k < i - 1) gaps += mergeCost(regions[k + 1].start - regions[k].end);
          if (gaps >= best) break; // only grows from here
          const value =
            cost[k * width + j - 1] + gaps + durationCost(regions[i - 1].end - regions[k].start, expected);
          if (value < best) [best, move] = [value, k];
        }
      }
      cost[cell] = best;
      from[cell] = move;
    }
  }

  const placed: AlignedSpeech[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const move = from[i * width + j];
    if (move === -1) i--;
    else if (move === -2) j--;
    else {
      placed.push({ name: speeches[j - 1].name, start: regions[move].start, end: regions[i - 1].end });
      i = move;
      j--;
    }
  }
  return placed.reverse();
}

export interface SplitSpeechOptions extends VoicedRegionOptions {
  /** Added before each speech's start and after its end, so a clip doesn't clip the first word. */
  paddingSeconds?: number;
}

export interface SpeechSplit {
  segmentation: SpeechSegmentation;
  /** Each placed speech in exact seconds, padding included — what the clips are cut on. */
  speeches: AlignedSpeech[];
  /** How many regions of sound the recording broke into. */
  regionCount: number;
  threshold: number;
  durationSeconds: number;
}

/**
 * The whole pipeline over a measured recording: regions, then alignment, then
 * the segmentation the rest of the package reads.
 */
export function splitSpeechesFromLoudness(
  loudness: Loudness,
  template: AudioSplitTemplate,
  options: SplitSpeechOptions = {},
): SpeechSplit {
  const threshold = options.threshold ?? silenceThreshold(loudness.rms);
  const regions = findVoicedRegions(loudness, { ...options, threshold });
  const padding = options.paddingSeconds ?? 0.35;
  const speeches = alignSpeeches(regions, template.speeches).map((speech) => ({
    name: speech.name,
    start: Math.max(0, speech.start - padding),
    end: Math.min(loudness.durationSeconds || Number.POSITIVE_INFINITY, speech.end + padding),
  }));
  return {
    segmentation: {
      format: template.format,
      speeches: speeches.map((speech) => ({
        name: speech.name,
        startSeconds: Math.floor(speech.start),
        endSeconds: Math.ceil(speech.end),
      })),
    },
    speeches,
    regionCount: regions.length,
    threshold,
    durationSeconds: loudness.durationSeconds,
  };
}

const SENTENCES_PER_PARAGRAPH = 5;

/**
 * The split as a transcript document: one `## 1AC (0:42–8:51)` heading per
 * speech — the house style the watch page turns into its speech tabs and
 * timeline — with the captions spoken in that range beneath it when there
 * are any.
 *
 * @param captions - Sentence-grouped captions (`groupIntoSentences`), optional.
 */
export function audioSplitTranscriptMarkdown(
  segmentation: SpeechSegmentation,
  captions: SegmentationCaption[] = [],
): string {
  return segmentation.speeches
    .map((speech) => {
      const range =
        speech.endSeconds !== null
          ? `${formatTimecode(speech.startSeconds)}–${formatTimecode(speech.endSeconds)}`
          : formatTimecode(speech.startSeconds);
      const end = speech.endSeconds ?? Number.POSITIVE_INFINITY;
      const sentences = captions
        .filter((caption) => caption.start >= speech.startSeconds && caption.start < end)
        .map((caption) => caption.text.trim())
        .filter(Boolean);
      const paragraphs: string[] = [];
      for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
        paragraphs.push(sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(" "));
      }
      const body = paragraphs.length > 0 ? paragraphs.join("\n\n") : "_No transcript for this speech yet._";
      return `## ${segmentedSpeechHeading(speech.name)} (${range})\n\n${body}`;
    })
    .join("\n\n");
}
