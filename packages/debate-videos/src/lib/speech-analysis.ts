/**
 * @fileoverview A round, speech by speech, written up by the model in one
 * batch job — the admin "Speech AI" pipeline.
 *
 * The watch page can already find a round's speeches in its captions
 * ("Detect speeches") and outline one speech at a time, but both run in the
 * reader's browser and are kept there. This module is the batch version an
 * admin runs over the Greatest of All-Time collection or the whole library:
 *
 * 1. The captions are split into speeches by the same prompt "Detect
 *    speeches" uses (`speech-segmentation.ts`).
 * 2. Each speech's captions are cut out between its start and end, and the
 *    whole round goes to the model once more with the admin's instructions,
 *    which by default ask for a summary of every speech and what the speaker
 *    could have done instead.
 * 3. The reply becomes two documents in the house style — a `summary` and an
 *    `analysis` whose `##` headings name each speech with its time range —
 *    so the watch page's speech buttons under the player, its per-speech
 *    tabs and its document tabs all pick them up with no further work.
 *
 * Pure prompt building and parsing only; the app's
 * `lib/videos/speech-analysis.ts` fetches captions, calls the model and
 * saves the documents.
 * @module lib/speech-analysis
 */

import {
  FORMAT_LABELS,
  segmentedSpeechHeading,
  type SegmentationCaption,
  type SpeechSegmentation,
} from "./speech-segmentation";
import { formatTimecode } from "./video-documents";

/**
 * What the admin's prompt box starts with. The admin may rewrite it freely;
 * the reply format below is always appended, so the reply can still be read.
 */
export const DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS = `You are an expert competitive debate coach reviewing a recorded round speech by speech, for debaters who want to learn from it.

For EVERY speech (including cross-examinations) write:
- summary: a short bullet outline of what the speaker did, in the order they did it — the key arguments with the warrant behind each, in clipped flow-style phrases. Bold each argument's tag, e.g. **DA — Midterms**. For a cross-ex, the lines of questioning and what each established or conceded.
- alternative: what the speaker could have done instead — one to three concrete, strategic alternatives a top coach would suggest (a stronger argument choice, a dropped argument they should have extended or answered, better weighing or time allocation, a sharper cross-ex line). Explain in a phrase why each would have been better given the rest of the round.

Also write overview: two or three sentences on the round as a whole — the central clash and how it was decided, if that is clear.

Stay faithful to the transcript. Captions are auto-generated, so silently fix obvious mis-hearings of debate terms ("dis ad" → DA, "counter plan" → CP, "perm" → permutation).`;

/** The reply contract the code depends on, appended after any instructions. */
export const SPEECH_ANALYSIS_REPLY_FORMAT = `Reply with ONLY a JSON object, no prose or code fence, in this shape:
{"overview":"…","speeches":[{"name":"1AC","summary":"- **Tag** — warrant\\n- …","alternative":"- …"}]}
Use the speech names exactly as they are given in the transcript headings, one entry per speech, in the same order. "summary" and "alternative" are Markdown bullet lists.`;

/**
 * The longest round one request carries. A two-hour policy round's captions
 * run about 150k characters; past this each speech is trimmed evenly.
 */
export const MAX_ANALYSIS_TRANSCRIPT_CHARS = 300_000;

/** One speech's place in the recording and what was said in it. */
export interface AnalysisSpeech {
  /** The name the segmentation gave it — `1AC`, `2NX`, `Pro Summary`. */
  name: string;
  startSeconds: number;
  endSeconds: number | null;
  transcript: string;
}

/** The model's write-up of one speech. */
export interface SpeechAnalysisEntry {
  name: string;
  summary: string;
  alternative: string;
}

/** The model's write-up of a round. */
export interface SpeechAnalysis {
  overview: string;
  speeches: SpeechAnalysisEntry[];
}

/** The admin's instructions (or the default) followed by the reply format. */
export function speechAnalysisSystemPrompt(instructions?: string | null): string {
  const body = instructions?.trim() || DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS;
  return `${body}\n\n${SPEECH_ANALYSIS_REPLY_FORMAT}`;
}

/**
 * Cuts the captions into the segmentation's speeches. A speech runs to its
 * own end when the model gave one, otherwise to the next speech's start.
 */
export function speechTranscripts(
  segmentation: SpeechSegmentation,
  captions: SegmentationCaption[],
): AnalysisSpeech[] {
  const speeches = [...segmentation.speeches].sort((a, b) => a.startSeconds - b.startSeconds);
  return speeches.map((speech, index) => {
    const next = speeches[index + 1]?.startSeconds ?? Number.POSITIVE_INFINITY;
    const end = speech.endSeconds ?? next;
    const transcript = captions
      .filter((caption) => caption.start >= speech.startSeconds && caption.start < Math.min(end + 1, next))
      .map((caption) => caption.text.trim())
      .filter(Boolean)
      .join(" ");
    return {
      name: speech.name,
      startSeconds: speech.startSeconds,
      endSeconds: speech.endSeconds,
      transcript,
    };
  });
}

/** `0:42–8:51`, or just `0:42` when the end is unknown. */
function timeRange(speech: { startSeconds: number; endSeconds: number | null }): string {
  return speech.endSeconds !== null
    ? `${formatTimecode(speech.startSeconds)}–${formatTimecode(speech.endSeconds)}`
    : formatTimecode(speech.startSeconds);
}

export interface SpeechAnalysisPromptInput {
  speeches: AnalysisSpeech[];
  videoTitle?: string;
  format?: SpeechSegmentation["format"];
  aff?: string | null;
  neg?: string | null;
  /** What the video's metadata says about the decision, when recorded. */
  decision?: string | null;
}

/** The user turn: the round's metadata, then each speech under its own heading. */
export function buildSpeechAnalysisPrompt(input: SpeechAnalysisPromptInput): string {
  const total = input.speeches.reduce((size, speech) => size + speech.transcript.length, 0);
  const share = total > MAX_ANALYSIS_TRANSCRIPT_CHARS ? MAX_ANALYSIS_TRANSCRIPT_CHARS / total : 1;

  const lines: string[] = [];
  if (input.videoTitle) lines.push(`Round: ${input.videoTitle}`);
  if (input.format) lines.push(`Format: ${FORMAT_LABELS[input.format]}`);
  if (input.aff) lines.push(`Affirmative / Pro: ${input.aff}`);
  if (input.neg) lines.push(`Negative / Con: ${input.neg}`);
  if (input.decision) lines.push(`Recorded decision: ${input.decision}`);
  if (lines.length > 0) lines.push("");
  lines.push("Transcript, speech by speech:");

  for (const speech of input.speeches) {
    const limit = Math.floor(speech.transcript.length * share);
    const text =
      speech.transcript.length > limit
        ? `${speech.transcript.slice(0, limit)} … [trimmed]`
        : speech.transcript;
    lines.push("", `### ${speech.name} [${timeRange(speech)}]`, text || "(no captions for this speech)");
  }

  return lines.join("\n");
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

/** A field as trimmed text; a list of strings is read as bullets. */
function textField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => (/^\s*[-*]/.test(item) ? item.trim() : `- ${item.trim()}`))
      .join("\n");
  }
  return "";
}

/**
 * Reads the model's reply.
 *
 * @returns The write-up, or `null` when the reply covers no speech.
 */
export function parseSpeechAnalysisResponse(text: string): SpeechAnalysis | null {
  const json = extractJson(text) as { overview?: unknown; speeches?: unknown } | null;
  if (!json || !Array.isArray(json.speeches)) return null;
  const speeches: SpeechAnalysisEntry[] = [];
  for (const entry of json.speeches as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as { name?: unknown; summary?: unknown; alternative?: unknown };
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const summary = textField(record.summary);
    const alternative = textField(record.alternative);
    if (!name || (!summary && !alternative)) continue;
    speeches.push({ name, summary, alternative });
  }
  if (speeches.length === 0) return null;
  return { overview: textField(json.overview), speeches };
}

/** Folds a speech name for matching — case, spaces and punctuation ignored. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The two documents the pipeline saves for a video. */
export interface SpeechAnalysisDocuments {
  /** Every speech's summary, under `## <speech> (<start>–<end>)` headings. */
  summary: string;
  /** Every speech's alternatives, under the same headings. */
  analysis: string;
  /** How many speeches the documents cover. */
  speechCount: number;
}

/**
 * Builds the `summary` and `analysis` documents from the segmentation and the
 * model's write-up.
 *
 * The segmentation sets the order and the timing — a speech the write-up
 * skipped still gets its heading, so its button under the player still
 * seeks — and the write-up is matched to it by name, in order for repeats.
 * Headings use the form `identifySpeech` reads (`CX of the 1AC` for a 1AX),
 * so the watch page lines both documents up into one tab per speech.
 */
export function speechAnalysisDocuments(
  segmentation: SpeechSegmentation,
  analysis: SpeechAnalysis,
): SpeechAnalysisDocuments {
  const remaining = [...analysis.speeches];
  const take = (name: string): SpeechAnalysisEntry | null => {
    const index = remaining.findIndex((entry) => nameKey(entry.name) === nameKey(name));
    return index === -1 ? null : (remaining.splice(index, 1)[0] ?? null);
  };

  const speeches = [...segmentation.speeches].sort((a, b) => a.startSeconds - b.startSeconds);
  const summary: string[] = [];
  const alternatives: string[] = [];
  if (analysis.overview) summary.push(analysis.overview);

  for (const speech of speeches) {
    const entry = take(speech.name);
    const heading = `## ${segmentedSpeechHeading(speech.name)} (${timeRange(speech)})`;
    summary.push(heading, entry?.summary || "_No summary for this speech._");
    alternatives.push(heading, entry?.alternative || "_No alternative suggested for this speech._");
  }

  return {
    summary: summary.join("\n\n"),
    analysis: alternatives.join("\n\n"),
    speechCount: speeches.length,
  };
}
