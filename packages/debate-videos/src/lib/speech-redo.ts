/**
 * @fileoverview "Do the full speech" — turns one alternative from the watch
 * page's Alternatives view into a complete speech the reader can edit and
 * practise delivering.
 *
 * An alternative is only a title, a strategy tag and a 3–6 bullet outline.
 * Redoing it asks Claude for the whole speech in that direction, written to
 * be read aloud in the speech's time. The prompt's inputs are deliberately
 * narrow: **the prior speech** (what this one answers) and **the current
 * speech** (what was actually said, so the redo keeps what worked and
 * changes the strategy), plus the alternative being followed and the
 * round's facts. Later speeches are left out — a speech can only answer
 * what came before it.
 *
 * Pure prompt building, parsing and timing only; `speech-redo-client.ts`
 * makes the network call, so this is tested without mocking `fetch`.
 * @module lib/speech-redo
 */

import { marked } from "marked";
import { debateStyles, type DebateStyleKey } from "@debate-ai/timer/src/formats/debate-format-times";
import type { RoundSpeech, SpeechSide } from "./round-speeches";
import type { AlternativeResponse, RoundContext } from "./speech-outcomes";

/** How many alternatives, best first, get a "Do the full speech" button. */
export const REDO_ALTERNATIVE_LIMIT = 3;

export interface SpeechRedoInput {
  videoTitle?: string;
  round?: RoundContext;
  speeches: RoundSpeech[];
  /** Index into `speeches` of the speech being redone. */
  index: number;
  /** The alternative whose direction the new speech follows. */
  alternative: Pick<AlternativeResponse, "title" | "approach" | "outline" | "tradeoff">;
  /**
   * The whole round's auto-captions, for when neither speech has anything
   * written of its own.
   */
  roundTranscript?: string;
}

/** Longest excerpt of the prior speech. */
const PRIOR_CHARS = 6000;
/** Longest excerpt of the current speech. */
const CURRENT_CHARS = 8000;
/** Longest excerpt of a whole round's captions, sent when neither speech has words of its own. */
const ROUND_TRANSCRIPT_CHARS = 14000;

function clip(text: string, limit: number): string {
  const trimmed = text.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit).trimEnd()} …[cut]` : trimmed;
}

const SIDE_NAMES: Record<SpeechSide, string> = {
  aff: "affirmative / pro",
  neg: "negative / con",
  cx: "cross-examination",
  neutral: "not a speech",
};

/**
 * The speech the current one answers: the nearest earlier speech that is a
 * real speech. A speech after a cross-ex answers the constructive before it,
 * so cross-exes are skipped — unless the speech being redone is itself a
 * cross-ex, which questions the speech right before it.
 */
export function priorSpeechIndex(speeches: readonly RoundSpeech[], index: number): number {
  const current = speeches[index];
  for (let i = index - 1; i >= 0; i--) {
    const candidate = speeches[i];
    if (!candidate || candidate.side === "neutral") continue;
    if (candidate.side === "cx" && current?.side !== "cx") continue;
    return i;
  }
  return -1;
}

/** Everything written for one speech: the transcript first, since a redo needs the words. */
function speechText(speech: RoundSpeech, limit: number): string {
  const parts: string[] = [];
  if (speech.parts.transcript) parts.push(`Transcript:\n${clip(speech.parts.transcript, limit)}`);
  if (speech.parts.summary) parts.push(`Summary:\n${clip(speech.parts.summary, Math.round(limit / 3))}`);
  if (!speech.parts.transcript && speech.parts.analysis) {
    parts.push(`Analysis:\n${clip(speech.parts.analysis, Math.round(limit / 2))}`);
  }
  return parts.join("\n\n");
}

/**
 * System prompt. Carries the guardrails every AI coach in this repo keeps
 * (critique arguments, never people — many debaters are minors; don't
 * invent evidence) and asks for Markdown the editor can open.
 */
export const SPEECH_REDO_SYSTEM_PROMPT =
  "You are an experienced competitive debate coach (Policy, Lincoln-Douglas and Public Forum) writing a " +
  "speech for a debater to deliver. You are given the speech before this one, the speech as it was " +
  "actually given, and a different strategic direction to take instead. Write the complete replacement " +
  "speech in that direction, in the speaker's voice, ready to be read aloud.\n\n" +
  "Rules:\n" +
  "- Answer the prior speech directly where the new strategy calls for it; keep anything from the speech " +
  "as given that still serves the new strategy.\n" +
  "- Fit the speech's time: roughly 150-170 spoken words per minute of the given length. Respect its " +
  "position in the round, including the rules on new arguments in rebuttals.\n" +
  "- Do not invent evidence. Refer to cards and authors already read in the round; where the new " +
  "strategy needs a card that was not read, write a bracketed placeholder such as [Card: link turn].\n" +
  "- Critique arguments, never the debaters as people; many are high-school students.\n" +
  "- The source is a rough auto-transcript. Where it is unclear, write around the gap rather than " +
  "inventing specifics.\n\n" +
  "Format the speech as Markdown: a `##` heading for each off-case position, contention or flow sheet " +
  "in the order spoken, short paragraphs and numbered responses under each, and **bold** the tag line " +
  "of each argument. A cross-examination is written as numbered questions with the follow-up each one " +
  "sets up. Reply with the speech only: no preface, no notes after it, no code fences.";

/** The user turn: the round, the prior speech, the speech as given, and the direction to take. */
export function buildSpeechRedoPrompt(input: SpeechRedoInput): string {
  const { speeches, index, alternative } = input;
  const speech = speeches[index];
  if (!speech) throw new Error(`No speech at index ${index}.`);
  const prior = speeches[priorSpeechIndex(speeches, index)];
  const minutes = redoSpeechMinutes(speech, input.round?.format);

  const round = input.round ?? {};
  const facts = [
    input.videoTitle ? `Round: ${input.videoTitle}` : null,
    round.format ? `Format: ${round.format}` : null,
    round.tournament ? `Tournament: ${round.tournament}${round.roundLevel ? `, ${round.roundLevel}` : ""}` : null,
    round.aff ? `Affirmative / pro: ${round.aff}` : null,
    round.neg ? `Negative / con: ${round.neg}` : null,
  ].filter((line): line is string => line !== null);

  const priorText = prior ? speechText(prior, PRIOR_CHARS) : "";
  const currentText = speechText(speech, CURRENT_CHARS);
  const captions =
    !priorText && !currentText && input.roundTranscript?.trim()
      ? "Nothing is written for either speech. Here is the auto-caption transcript of the whole round, with " +
        "no speech boundaries marked — find both speeches in it by their place in the speech order:\n" +
        clip(input.roundTranscript, ROUND_TRANSCRIPT_CHARS)
      : null;

  const outline = alternative.outline.map((line, i) => `${i + 1}. ${line}`);

  return [
    ...facts,
    facts.length ? "" : null,
    prior
      ? `## The prior speech: ${prior.heading} (${SIDE_NAMES[prior.side]})`
      : "## The prior speech",
    prior ? priorText || "(Nothing written for it.)" : "(This is the first speech of the round.)",
    "",
    `## The speech as given: ${speech.heading} (${SIDE_NAMES[speech.side]})`,
    currentText || "(Nothing written for it.)",
    captions ? "" : null,
    captions,
    "",
    `## The direction to take instead: ${alternative.title}`,
    alternative.approach ? `Strategy: ${alternative.approach}` : null,
    ...(outline.length ? ["Outline, in speaking order:", ...outline] : []),
    alternative.tradeoff ? `What it gives up: ${alternative.tradeoff}` : null,
    "",
    `Write the full ${speech.label} following that direction, about ${minutes} minute${minutes === 1 ? "" : "s"} ` +
      `long (roughly ${minutes * 160} words). Reply with the speech in Markdown only.`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** Room for a full speech: ~160 words a minute, ~1.4 tokens a word, plus headroom. */
export function speechRedoMaxTokens(minutes: number): number {
  return Math.min(6000, Math.max(1600, Math.round(minutes * 160 * 1.4) + 600));
}

/**
 * The speech out of Claude's reply: drops a code fence around the whole
 * thing and a leading "Here is…" line, keeps the Markdown as written.
 *
 * @returns The Markdown, or `null` for an empty reply.
 */
export function parseSpeechRedoResponse(text: string): string | null {
  let body = text.trim();
  const fenced = body.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fenced) body = fenced[1].trim();
  body = body.replace(/^(?:sure[,!]?\s*)?here(?:'s| is) [^\n]*:\s*\n+/i, "").trim();
  return body ? body : null;
}

/** The redo as HTML for the Debate Editor. */
export function speechRedoToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
}

/** The round's format, as the timer's style key. */
function styleForFormat(format: string | undefined): DebateStyleKey {
  const value = (format ?? "").toLowerCase();
  if (/\bpf\b|public/.test(value)) return "publicForum";
  if (/\bld\b|lincoln/.test(value)) return /college|ndt|nfa/.test(value) ? "collegeLD" : "lincolnDouglas";
  if (/college|ndt|ceda/.test(value)) return "collegePolicy";
  return "policy";
}

/** Fallback lengths, in minutes, for a speech label the format's timer doesn't name. */
function fallbackMinutes(speech: RoundSpeech): number {
  const label = `${speech.label} ${speech.heading}`.toLowerCase();
  if (speech.side === "cx" || /cross|crossfire|\bcx\b/.test(label)) return 3;
  if (/final focus|\bff\b/.test(label)) return 2;
  if (/summary/.test(label)) return 3;
  if (/rebuttal/.test(label)) return 4;
  if (/constructive/.test(label)) return 4;
  return 5;
}

/**
 * How long the redo should run, in whole minutes: the format's time for a
 * speech of that name (the same table the round timer uses), else a
 * sensible length for its kind. The timer in the dialog stays editable.
 */
export function redoSpeechMinutes(speech: RoundSpeech, format: string | undefined): number {
  const style = debateStyles[styleForFormat(format)];
  const label = speech.label.trim().toUpperCase();
  const match = style?.timerSpeeches.find((timer) => timer.name.toUpperCase() === label);
  return match ? match.time : fallbackMinutes(speech);
}

/**
 * The alternatives that get a "Do the full speech" button: the top
 * {@link REDO_ALTERNATIVE_LIMIT} by how much they help the speaker, ties
 * kept in the order Claude listed them.
 *
 * @param swings - Each alternative's swing for the speaker, by index.
 */
export function topRedoAlternatives(swings: readonly number[], limit = REDO_ALTERNATIVE_LIMIT): Set<number> {
  return new Set(
    swings
      .map((swing, i) => ({ swing, i }))
      .sort((a, b) => b.swing - a.swing || a.i - b.i)
      .slice(0, limit)
      .map(({ i }) => i),
  );
}

/** Where a redo is remembered, so reopening it shows the reader's edits. */
export function speechRedoStorageKey(videoId: string, speechKey: string, alternativeTitle: string): string {
  return `debate-videos:speech-redo:${videoId}::${speechKey}::${alternativeTitle.trim().toLowerCase().slice(0, 80)}`;
}

/** The recorder's per-speech name for a redo, so its recording never overwrites a round's. */
export function speechRedoRecordingName(videoId: string, speechKey: string, alternativeIndex: number): string {
  return `watch-redo:${videoId}:${speechKey}:${alternativeIndex + 1}`;
}
