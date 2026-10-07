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

/** One speech the model found. */
export interface SegmentedSpeech {
  /** The name as the prompt spells it — `1AC`, `2NX`, `Pro Summary`. */
  name: string;
  startSeconds: number;
  /** When the speaker stopped, before prep time or the next speech; `null` when not given. */
  endSeconds: number | null;
}

export interface SpeechSegmentation {
  format: SegmentedFormat;
  speeches: SegmentedSpeech[];
}

/** A caption line: the shape `groupIntoSentences` produces. */
export interface SegmentationCaption {
  text: string;
  start: number;
}

/**
 * The most caption text one request carries. The proxy refuses anything over
 * 400k characters; a two-hour policy round runs about 150k, so this only
 * trims a stream left recording for hours.
 */
export const MAX_SEGMENTATION_CHARS = 360_000;

export const SPEECH_SEGMENTATION_SYSTEM_PROMPT = `You are an experienced competitive debate judge and tournament tab-room assistant. You are given the timestamped auto-generated captions of a recorded debate round. Your job is to work out the round's format and exactly where each speech begins and ends.

FORMATS AND SPEECH NAMES — use these names exactly:
- policy (CX / Policy, high school or college): ${FORMAT_SPEECH_NAMES.policy.join(", ")}
- ld (Lincoln-Douglas): ${FORMAT_SPEECH_NAMES.ld.join(", ")}
- pf (Public Forum): ${FORMAT_SPEECH_NAMES.pf.join(", ")}
- other: anything else (parliamentary, worlds, a lecture or drill). Name its speeches plainly.

A cross-examination is named for the speech it questions: 1AX is the cross-ex of the 1AC, 1NX of the 1NC, 2AX of the 2AC, 2NX of the 2NC. In Public Forum the Con team may speak first; list speeches in the order they were actually given.

HOW TO FIND THE BOUNDARIES:
- Read the whole transcript before deciding. A new speech usually starts after a pause, a "time starts now" / "I'll start" / "okay, ready?" exchange, a change of speaker, or a roadmap ("two off-case", "I'll go DA, CP, then case"). Constructives open with framing or the plan text; cross-ex is rapid question-and-answer; rebuttals extend, group and weigh.
- The start is the timestamp of the first line the speaker actually delivers the speech — not the prep time, timer chatter or "is everyone ready?" before it.
- The end is the timestamp of the last line of that speech, before prep time, timer chatter or the next speech.
- Only include speeches that are actually in the recording. A recording may start mid-round or stop early; skip speeches you cannot find rather than guessing a time.
- Timestamps must come from the transcript's own [m:ss] or [h:mm:ss] markers and increase from speech to speech.

Reply with ONLY a JSON object, no prose or code fence, in this shape:
{"format":"policy"|"ld"|"pf"|"other","speeches":[{"name":"1AC","start":"0:42","end":"8:51"}]}`;

function captionLines(captions: SegmentationCaption[]): { text: string; truncated: boolean } {
  const lines: string[] = [];
  let size = 0;
  for (const caption of captions) {
    const text = caption.text.trim();
    if (!text) continue;
    const line = `[${formatTimecode(caption.start)}] ${text}`;
    if (size + line.length + 1 > MAX_SEGMENTATION_CHARS) return { text: lines.join("\n"), truncated: true };
    lines.push(line);
    size += line.length + 1;
  }
  return { text: lines.join("\n"), truncated: false };
}

export interface SpeechSegmentationInput {
  captions: SegmentationCaption[];
  videoTitle?: string;
  /** The format the video's metadata claims, as a hint — the model has the final say. */
  formatHint?: string;
  aff?: string;
  neg?: string;
}

/** The user turn: the video's metadata, then the whole caption track. */
export function buildSpeechSegmentationPrompt(input: SpeechSegmentationInput): string {
  const { text, truncated } = captionLines(input.captions);
  const context = [
    input.videoTitle ? `Video title: ${input.videoTitle}` : "",
    input.formatHint ? `Listed format (may be wrong): ${input.formatHint}` : "",
    input.aff ? `Affirmative / Pro: ${input.aff}` : "",
    input.neg ? `Negative / Con: ${input.neg}` : "",
  ].filter(Boolean);
  return [
    ...context,
    context.length > 0 ? "" : null,
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

/**
 * Reads the model's reply. Speeches without a usable start are dropped, the
 * rest are put in time order, and an end at or before its start is
 * discarded rather than trusted.
 *
 * @returns The segmentation, or `null` when the reply holds no speech at all.
 */
export function parseSpeechSegmentationResponse(text: string): SpeechSegmentation | null {
  const json = extractJson(text) as { format?: unknown; speeches?: unknown } | null;
  if (!json || !Array.isArray(json.speeches)) return null;
  const rawFormat = typeof json.format === "string" ? json.format.toLowerCase().trim() : "";
  const format: SegmentedFormat = rawFormat in FORMAT_STYLES ? (rawFormat as SegmentedFormat) : "other";

  const speeches: SegmentedSpeech[] = [];
  for (const entry of json.speeches as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as { name?: unknown; start?: unknown; end?: unknown };
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const startSeconds = parseTimestamp(record.start);
    if (!name || startSeconds === null) continue;
    const end = parseTimestamp(record.end);
    speeches.push({ name: name.slice(0, 60), startSeconds, endSeconds: end !== null && end > startSeconds ? end : null });
  }
  if (speeches.length === 0) return null;
  speeches.sort((a, b) => a.startSeconds - b.startSeconds);
  return { format, speeches };
}

/**
 * A speech name as `identifySpeech` reads it: `1AX` becomes `CX of the 1AC`,
 * `Crossfire 2` becomes `Crossfire`.
 */
function headingForName(name: string): string {
  const crossEx = /^([12])?([AN])X$/i.exec(name);
  if (crossEx) return `CX of the ${crossEx[1] ?? "1"}${crossEx[2].toUpperCase()}C`;
  return name.replace(/^(crossfire)\s+\d+$/i, "$1");
}

/** Each found speech with the key `round-formats.ts` would give it. */
function keyedSpeeches(segmentation: SpeechSegmentation): Array<SegmentedSpeech & { key: string }> {
  const occurrences = new Map<string, number>();
  return segmentation.speeches.map((speech) => {
    const identity = identifySpeech(headingForName(speech.name));
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
    const identity = identifySpeech(headingForName(speech.name));
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
