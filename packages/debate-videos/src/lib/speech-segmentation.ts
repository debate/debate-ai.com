/**
 * @fileoverview A round's speeches found in its captions by the model — the
 * watch page's "Detect speeches" button.
 *
 * Most rounds have no document that times their speeches, and pressing
 * "Mark start" twelve times is slow. This module asks the model once instead:
 * the whole caption track goes in, one `[m:ss] text` line per sentence, and
 * the reply names the round's format, every speech of it that was given, and
 * when each began and ended.
 *
 * Auto-generated captions carry no speaker labels and little punctuation, so
 * the strongest boundary signal is silence: prep time and the next speaker
 * walking up leave gaps in the caption track. The prompt therefore marks
 * every long gap (`(pause 1:20)`), gives each format's speech lengths, and —
 * when the caller has one — a length-only guess from those pauses for the
 * model to correct from what is said ("time starts now", "cross-ex",
 * "I'll be taking prep").
 *
 * The model is asked for timestamps, not for each speech's words: echoing a
 * two-hour round back would blow far past any reply limit and could
 * paraphrase. The words are cut from the captions between those timestamps
 * instead (see `withCaptionTranscripts` in `round-speeches.ts`), so every
 * speech's text is exactly what the captions say.
 *
 * Speeches are keyed the way `round-formats.ts` keys a format's standard
 * order (`1AC#1`, `CX#2`), so marks, saved Outcomes runs and a summary
 * written later all keep lining up. Debaters name a cross-ex for the speech
 * it questions — `1AX` is the cross-ex of the 1AC, `2NX` of the 2NC — and so
 * does the prompt.
 *
 * Pure prompt building and parsing only; `speech-ai-client.ts` makes the
 * network call.
 * @module lib/speech-segmentation
 */

import { identifySpeech, type RoundSpeech } from "./round-speeches";
import { standardRoundSpeeches } from "./round-formats";
import { formatTimecode } from "./video-documents";

/** A format the model can name, and the numeric `DebateStyle` it stands for. */
export type SegmentedFormat = "policy" | "ld" | "pf" | "other";

const FORMAT_STYLES: Record<SegmentedFormat, number | null> = {
  policy: 1,
  pf: 2,
  ld: 3,
  other: null,
};

export const FORMAT_LABELS: Record<SegmentedFormat, string> = {
  policy: "Policy",
  ld: "Lincoln-Douglas",
  pf: "Public Forum",
  other: "Other format",
};

/** The speech names the prompt asks for, per format, in speaking order. */
export const FORMAT_SPEECH_NAMES: Record<Exclude<SegmentedFormat, "other">, string[]> = {
  policy: ["1AC", "1AX", "1NC", "1NX", "2AC", "2AX", "2NC", "2NX", "1NR", "1AR", "2NR", "2AR"],
  ld: ["1AC", "1AX", "1NC", "1NX", "1AR", "NR", "2AR"],
  pf: [
    "Pro Constructive",
    "Con Constructive",
    "Crossfire 1",
    "Pro Rebuttal",
    "Con Rebuttal",
    "Crossfire 2",
    "Pro Summary",
    "Con Summary",
    "Grand Crossfire",
    "Pro Final Focus",
    "Con Final Focus",
  ],
};

/**
 * Each speech's usual length in minutes, as the prompt states it — high
 * school times; college policy runs 9-3-6.
 */
export const FORMAT_SPEECH_MINUTES: Record<Exclude<SegmentedFormat, "other">, number[]> = {
  policy: [8, 3, 8, 3, 8, 3, 8, 3, 5, 5, 5, 5],
  ld: [6, 3, 7, 3, 4, 6, 3],
  pf: [4, 4, 3, 4, 4, 3, 3, 3, 3, 2, 2],
};

function speechList(format: Exclude<SegmentedFormat, "other">): string {
  return FORMAT_SPEECH_NAMES[format].map((name, i) => `${name} (${FORMAT_SPEECH_MINUTES[format][i]})`).join(", ");
}

/** One speech the model found. */
export interface SegmentedSpeech {
  /** The name as the prompt spells it — `1AC`, `2NX`, `Pro Summary`. */
  name: string;
  startSeconds: number;
  /** When the speaker stopped, before prep time or the next speech; `null` when not given. */
  endSeconds: number | null;
  /** How sure the model was of this speech's start, 0–1; absent when it didn't say. */
  confidence?: number;
}

export interface SpeechSegmentation {
  format: SegmentedFormat;
  speeches: SegmentedSpeech[];
}

/** A caption line: a raw caption cue, or the shape `groupIntoSentences` produces. */
export interface SegmentationCaption {
  text: string;
  start: number;
  /** Seconds the line is on screen. Without it no pause can be measured after the line. */
  duration?: number;
}

/**
 * The most caption text one request carries. The proxy refuses anything over
 * 400k characters; a two-hour policy round runs about 150k, so this only
 * trims a stream left recording for hours.
 */
export const MAX_SEGMENTATION_CHARS = 360_000;

/** A quiet stretch at least this long is marked in the transcript as a pause. */
export const PAUSE_MARK_SECONDS = 6;

/** Cues closer than this, inside one unfinished sentence, are joined into one line. */
const JOIN_GAP_SECONDS = 1.5;
const MAX_LINE_CHARS = 220;

export const SPEECH_SEGMENTATION_SYSTEM_PROMPT = `You are an experienced competitive debate judge and tournament tab-room assistant. You are given the timestamped auto-generated captions of a recorded debate round. Your job is to work out the round's format and exactly where each speech begins and ends.

FORMATS AND SPEECH NAMES — use these names exactly. Usual length in minutes is in brackets; college policy runs 9-3-6 instead of 8-3-5.
- policy (CX / Policy, high school or college): ${speechList("policy")}
- ld (Lincoln-Douglas): ${speechList("ld")}
- pf (Public Forum): ${speechList("pf")}
- other: anything else (parliamentary, worlds, a lecture or drill). Name its speeches plainly.

A cross-examination is named for the speech it questions: 1AX is the cross-ex of the 1AC, 1NX of the 1NC, 2AX of the 2AC, 2NX of the 2NC. In Public Forum the Con team may speak first; list speeches in the order they were actually given.

READING THE TRANSCRIPT:
- Each line is "[m:ss] text" or "[h:mm:ss] text". The captions are automatic: no speaker names, little punctuation, misheard words (e.g. "one a c", "the neg", "D A", "counter plan", "K").
- A line "[m:ss] (pause 1:20)" means nobody was captioned for that long, starting at that time. Long pauses are usually prep time or the next speaker setting up, so a new speech very often starts on the first line after one. Not every pause is a boundary (a speaker reading a card fast can drop captions), and not every boundary has a pause (cross-ex often follows its speech within seconds).
- The user message may include a length-only guess placed from the pauses and the usual speech lengths. Treat it as a starting point and move each boundary to where the words show it really is.

HOW TO FIND THE BOUNDARIES:
- Read the whole transcript before deciding. A new speech usually starts after a pause, a "time starts now" / "I'll start" / "okay, ready?" / "go ahead" exchange, a change of speaker, or a roadmap ("two off-case", "I'll go DA, CP, then case", "order is"). Constructives open with framing, the plan text or the first contention; cross-ex is rapid question-and-answer ("so what's your", "can you explain", "yes", "no"); rebuttals extend, group and weigh ("extend", "they dropped", "on the case debate", "voters"). A speech often ends with "thank you", "time", or the timer going off.
- The start is the timestamp of the first line the speaker actually delivers the speech — not the prep time, timer chatter or "is everyone ready?" before it.
- The end is the timestamp of the last line of that speech, before prep time, timer chatter or the next speech.
- Use the usual lengths as a sanity check: a speech rarely runs much past its time and is rarely under half of it. A 30-second "speech" or a 15-minute constructive means a boundary is wrong.
- Only include speeches that are actually in the recording. A recording may start mid-round, stop early, or end with the judge's decision (RFD) — skip speeches you cannot find rather than guessing a time, and never label the RFD or pre-round chatter as a speech.
- Timestamps must be copied from the transcript's own line markers and increase from speech to speech; speeches must not overlap.
- confidence is 0 to 1: how sure you are of that speech's start (1 = clearly announced, 0.5 = inferred from a pause and the length, below 0.3 = a guess).

Reply with ONLY a JSON object, no prose or code fence, in this shape:
{"format":"policy"|"ld"|"pf"|"other","speeches":[{"name":"1AC","start":"0:42","end":"8:51","confidence":0.9}]}`;

const SENTENCE_END = /[.?!]["')\]]*$/;

/**
 * The transcript as the model reads it: cues joined into lines (split at a
 * sentence end, a short gap or a line-length cap), with a `(pause m:ss)` line
 * wherever the captions go quiet for {@link PAUSE_MARK_SECONDS} or longer.
 * A pause is only measured after a line that says how long it lasted.
 */
export function segmentationTranscript(captions: SegmentationCaption[]): { text: string; truncated: boolean } {
  const lines: string[] = [];
  let size = 0;
  let line: { start: number; text: string; end: number | null } | null = null;
  let truncated = false;

  const push = (text: string): boolean => {
    if (size + text.length + 1 > MAX_SEGMENTATION_CHARS) return false;
    lines.push(text);
    size += text.length + 1;
    return true;
  };
  const flush = (): boolean => {
    if (!line) return true;
    const ok = push(`[${formatTimecode(line.start)}] ${line.text}`);
    line = null;
    return ok;
  };

  const sorted = captions
    .filter((caption) => Number.isFinite(caption.start) && caption.text.trim())
    .slice()
    .sort((a, b) => a.start - b.start);
  for (const caption of sorted) {
    const text = caption.text.trim().replace(/\s+/g, " ");
    const end = caption.duration !== undefined && caption.duration >= 0 ? caption.start + caption.duration : null;
    const current = line as { start: number; text: string; end: number | null } | null;
    const gap = current?.end != null ? caption.start - current.end : null;
    const joins =
      current !== null &&
      gap !== null &&
      gap < JOIN_GAP_SECONDS &&
      !SENTENCE_END.test(current.text) &&
      current.text.length + text.length < MAX_LINE_CHARS;
    if (joins && current) {
      current.text += ` ${text}`;
      current.end = end ?? current.end;
      continue;
    }
    const pauseFrom = current?.end ?? null;
    if (!flush()) {
      truncated = true;
      break;
    }
    if (pauseFrom !== null && gap !== null && gap >= PAUSE_MARK_SECONDS) {
      if (!push(`[${formatTimecode(pauseFrom)}] (pause ${formatTimecode(gap)})`)) {
        truncated = true;
        break;
      }
    }
    line = { start: caption.start, text, end };
  }
  if (!truncated && !flush()) truncated = true;
  return { text: lines.join("\n"), truncated };
}

export interface SpeechSegmentationInput {
  captions: SegmentationCaption[];
  videoTitle?: string;
  /** The format the video's metadata claims, as a hint — the model has the final say. */
  formatHint?: string;
  aff?: string;
  neg?: string;
  /**
   * A length-only placement from the caption pauses
   * (`caption-speech-split.ts`) for the model to correct; left out when the
   * format is unknown or the captions are too sparse.
   */
  pauseGuess?: SegmentedSpeech[];
}

/** The user turn: the video's metadata, then the whole caption track. */
export function buildSpeechSegmentationPrompt(input: SpeechSegmentationInput): string {
  const { text, truncated } = segmentationTranscript(input.captions);
  const last = input.captions.reduce(
    (latest, caption) => Math.max(latest, caption.start + (caption.duration ?? 0)),
    0,
  );
  const guess = input.pauseGuess ?? [];
  const context = [
    input.videoTitle ? `Video title: ${input.videoTitle}` : "",
    input.formatHint ? `Listed format (may be wrong): ${input.formatHint}` : "",
    input.aff ? `Affirmative / Pro: ${input.aff}` : "",
    input.neg ? `Negative / Con: ${input.neg}` : "",
    last > 0 ? `Captions run to: ${formatTimecode(last)}` : "",
  ].filter(Boolean);
  const guessLines =
    guess.length > 0
      ? [
          "Length-only guess from the caption pauses (often off by a speech or two — correct it from the words):",
          ...guess.map(
            (speech) =>
              `- ${speech.name}: ${formatTimecode(speech.startSeconds)}${
                speech.endSeconds !== null ? `–${formatTimecode(speech.endSeconds)}` : ""
              }`,
          ),
          "",
        ]
      : [];
  return [
    ...context,
    context.length > 0 ? "" : null,
    ...guessLines,
    `Transcript${truncated ? " (cut off before the end of the recording)" : ""}:`,
    text,
    "",
    "Identify the format and the start and end timestamp of every speech in the recording.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** `"1:02:03"`, `"62:03"`, `"3723"` or `3723` → seconds; `null` for anything else. */
export function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/^\[|\]$/g, "");
  if (/^\d+(\.\d+)?$/.test(text)) return Math.floor(Number(text));
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.\d+)?$/.exec(text);
  if (!match) return null;
  const [, hours = "0", minutes, seconds] = match;
  if (Number(seconds) >= 60) return null;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/** The first `{ … }` in a reply, tolerating a code fence or a sentence around it. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface ParseSegmentationOptions {
  /**
   * How long the recording (or its captions) runs, in seconds. Speeches that
   * start after it are dropped and ends past it are pulled back to it.
   */
  durationSeconds?: number;
}

/** Speeches the model rates below this are guesses it was told not to make, and are dropped. */
export const MIN_SEGMENT_CONFIDENCE = 0.2;

/** A start this close to the previous one is the same speech named twice. */
const DUPLICATE_START_SECONDS = 5;

function parseConfidence(value: unknown): number | undefined {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) return undefined;
  // Some replies use a percentage.
  const unit = number > 1 ? number / 100 : number;
  return Math.min(1, Math.max(0, unit));
}

/**
 * Reads the model's reply and checks it against the recording.
 *
 *   - A speech with no name or no readable start is dropped, as is one the
 *     model gave a confidence under {@link MIN_SEGMENT_CONFIDENCE}.
 *   - With `durationSeconds`, a start past the end of the recording is
 *     dropped and an end past it is pulled back to it.
 *   - The rest are put in time order; of two speeches starting within a few
 *     seconds of each other only the more confident is kept.
 *   - An end at or before its start is discarded rather than trusted, and an
 *     end that runs into the next speech is cut back to that speech's start.
 *
 * @returns The segmentation, or `null` when the reply holds no speech at all.
 */
export function parseSpeechSegmentationResponse(
  text: string,
  { durationSeconds }: ParseSegmentationOptions = {},
): SpeechSegmentation | null {
  const json = extractJson(text) as { format?: unknown; speeches?: unknown } | null;
  if (!json || !Array.isArray(json.speeches)) return null;
  const rawFormat = typeof json.format === "string" ? json.format.toLowerCase().trim() : "";
  const format: SegmentedFormat = rawFormat in FORMAT_STYLES ? (rawFormat as SegmentedFormat) : "other";
  const limit = durationSeconds !== undefined && durationSeconds > 0 ? Math.ceil(durationSeconds) : null;

  const candidates: SegmentedSpeech[] = [];
  for (const entry of json.speeches as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as { name?: unknown; start?: unknown; end?: unknown; confidence?: unknown };
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const startSeconds = parseTimestamp(record.start);
    if (!name || startSeconds === null) continue;
    if (limit !== null && startSeconds >= limit) continue;
    const confidence = parseConfidence(record.confidence);
    if (confidence !== undefined && confidence < MIN_SEGMENT_CONFIDENCE) continue;
    let end = parseTimestamp(record.end);
    if (end !== null && limit !== null) end = Math.min(end, limit);
    candidates.push({
      name: name.slice(0, 60),
      startSeconds,
      endSeconds: end !== null && end > startSeconds ? end : null,
      ...(confidence !== undefined ? { confidence } : {}),
    });
  }
  candidates.sort((a, b) => a.startSeconds - b.startSeconds);

  const speeches: SegmentedSpeech[] = [];
  for (const speech of candidates) {
    const previous = speeches[speeches.length - 1];
    if (previous && speech.startSeconds - previous.startSeconds < DUPLICATE_START_SECONDS) {
      if ((speech.confidence ?? 0.5) > (previous.confidence ?? 0.5)) speeches[speeches.length - 1] = speech;
      continue;
    }
    speeches.push(speech);
  }
  for (let i = 0; i < speeches.length - 1; i++) {
    const end = speeches[i].endSeconds;
    if (end !== null && end > speeches[i + 1].startSeconds) {
      speeches[i] = { ...speeches[i], endSeconds: speeches[i + 1].startSeconds };
    }
  }
  if (speeches.length === 0) return null;
  return { format, speeches };
}

/**
 * A speech name as `identifySpeech` reads it: `1AX` becomes `CX of the 1AC`,
 * `Crossfire 2` becomes `Crossfire`.
 */
export function segmentedSpeechHeading(name: string): string {
  const crossEx = /^([12])?([AN])X$/i.exec(name);
  if (crossEx) return `CX of the ${crossEx[1] ?? "1"}${crossEx[2].toUpperCase()}C`;
  return name.replace(/^(crossfire)\s+\d+$/i, "$1");
}

/** Each found speech with the key `round-formats.ts` would give it. */
function keyedSpeeches(segmentation: SpeechSegmentation): Array<SegmentedSpeech & { key: string }> {
  const occurrences = new Map<string, number>();
  return segmentation.speeches.map((speech) => {
    const identity = identifySpeech(segmentedSpeechHeading(speech.name));
    const occurrence = (occurrences.get(identity.base) ?? 0) + 1;
    occurrences.set(identity.base, occurrence);
    return { ...speech, key: `${identity.base}#${occurrence}` };
  });
}

/**
 * The round's speeches as the model found them: the detected format's
 * standard order, each speech timed where the model placed it. A speech the
 * recording doesn't have stays untimed. For a format with no standard order,
 * the speeches are built from the names the model gave.
 */
export function segmentationSpeeches(segmentation: SpeechSegmentation): RoundSpeech[] {
  const found = keyedSpeeches(segmentation);
  const style = FORMAT_STYLES[segmentation.format];
  const standard = style === null ? [] : standardRoundSpeeches(style);

  if (standard.length > 0) {
    const byKey = new Map(found.map((speech) => [speech.key, speech]));
    return standard.map((speech) => {
      const match = byKey.get(speech.key);
      return match ? { ...speech, startSeconds: match.startSeconds, endSeconds: match.endSeconds } : speech;
    });
  }

  return found.map((speech) => {
    const identity = identifySpeech(segmentedSpeechHeading(speech.name));
    return {
      key: speech.key,
      label: speech.name,
      heading: speech.name,
      side: identity.side,
      isSpeech: true,
      startSeconds: speech.startSeconds,
      endSeconds: speech.endSeconds,
      parts: {},
    };
  });
}

/**
 * Lays a detected segmentation over the speeches the page already had.
 *
 * A round with something written for it (a summary, an analysis, a typed
 * transcript) keeps its own speeches — they carry that writing — and only
 * gains start and end times where it had none. A round with nothing written
 * takes the detected speeches outright, since the model may have read the
 * format better than the video's metadata did.
 */
export function applySpeechSegmentation(
  speeches: RoundSpeech[],
  segmentation: SpeechSegmentation | null,
): RoundSpeech[] {
  if (!segmentation) return speeches;
  const detected = segmentationSpeeches(segmentation);
  const written = speeches.some((speech) => Object.keys(speech.parts).length > 0);
  if (!written) return detected.length > 0 ? detected : speeches;

  const byKey = new Map(detected.map((speech) => [speech.key, speech]));
  return speeches.map((speech) => {
    const match = byKey.get(speech.key);
    // A document's own timecode wins; the detected end only fits the detected start.
    if (!match || match.startSeconds === null || speech.startSeconds !== null) return speech;
    return { ...speech, startSeconds: match.startSeconds, endSeconds: match.endSeconds ?? null };
  });
}
