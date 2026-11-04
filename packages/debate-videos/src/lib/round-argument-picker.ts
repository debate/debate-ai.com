/**
 * @fileoverview The last step of the admin "Speech AI" pipeline: once a
 * round's captions are split into speeches and written up, one more model
 * call decides what the round was about — the affirmative's argument (what
 * the 1AC read) and the negative's final rebuttal argument (what the 2NR went
 * for) — and the app saves them as the round's `videos.arg_1ac` /
 * `videos.arg_2nr`.
 *
 * The model gets the per-speech write-up the pipeline just produced (cheap,
 * and already tagged) plus the full captions of the two speeches that decide
 * the answer: the first affirmative constructive and the last negative
 * rebuttal. It answers with short comma-separated tags in the library's style
 * (`Setcol`, `Cap K, Framework`), which `parseArgumentTags` in
 * `@debate-ai/round` splits the same way as hand-entered ones.
 *
 * Pure prompt building and parsing only; the app's
 * `lib/videos/speech-analysis.ts` calls the model and writes the row.
 * @module lib/round-argument-picker
 */

import type { AnalysisSpeech, SpeechAnalysis } from "./speech-analysis";
import { FORMAT_LABELS, type SpeechSegmentation } from "./speech-segmentation";

/** Characters of captions sent for each of the two deciding speeches. */
export const MAX_DECIDING_SPEECH_CHARS = 60_000;

/** At most this many tags are kept per side. */
export const MAX_ARGUMENT_TAGS = 4;

/** A tag longer than this is a sentence, not a tag, and is cut at a word. */
const MAX_TAG_CHARS = 60;

export const ROUND_ARGUMENTS_SYSTEM_PROMPT = `You are an expert competitive debate coach labelling recorded rounds for a searchable video library.

From the round below decide:
- aff: the affirmative's (Pro's) argument — what the 1AC (or Pro Constructive) read: the plan, advocacy or K aff and its main advantages or framing.
- neg: the negative's (Con's) final rebuttal argument — what the 2NR (LD: NR; PF: Con Final Focus) went for at the end of the round, not everything the 1NC read.

Write each as 1 to 4 short tags, the way debaters label rounds: "Setcol", "Cap K", "Framework", "Politics DA", "Advantage CP", "T-Subsets", "Heg", "Condo". Use common debate shorthand (DA, CP, K, T, PIC, FW). No sentences, no team names, no speech names.

Captions are auto-generated, so silently fix obvious mis-hearings of debate terms ("dis ad" → DA, "counter plan" → CP).

Reply with ONLY a JSON object, no prose or code fence:
{"aff":["Tag","Tag"],"neg":["Tag"]}
Use an empty list for a side you cannot tell from the round.`;

/** The arguments the model chose, as comma-separated tags; `null` for a side it couldn't tell. */
export interface RoundArgumentPick {
  /** What the affirmative read — saved as `arg_1ac`. */
  aff: string | null;
  /** What the negative's last rebuttal went for — saved as `arg_2nr`. */
  neg: string | null;
}

const AFF_CONSTRUCTIVE = /^(1ac|aff constructive|pro constructive|pro case|1st pro)$/i;
const NEG_REBUTTAL = /^(2nr|nr|1nr|con final focus|neg final focus|con summary|neg rebuttal|con rebuttal)$/i;
/** Later in this list means a better stand-in for the final negative rebuttal. */
const NEG_REBUTTAL_RANK = ["con rebuttal", "neg rebuttal", "1nr", "con summary", "nr", "con final focus", "neg final focus", "2nr"];

/** The affirmative's first constructive, or the round's first speech. */
export function affConstructive(speeches: readonly AnalysisSpeech[]): AnalysisSpeech | null {
  return speeches.find((speech) => AFF_CONSTRUCTIVE.test(speech.name.trim())) ?? speeches[0] ?? null;
}

/** The negative's last rebuttal — the 2NR, the NR in LD, the Con Final Focus in PF. */
export function finalNegRebuttal(speeches: readonly AnalysisSpeech[]): AnalysisSpeech | null {
  let best: AnalysisSpeech | null = null;
  let bestRank = -1;
  for (const speech of speeches) {
    const name = speech.name.trim();
    if (!NEG_REBUTTAL.test(name)) continue;
    const rank = NEG_REBUTTAL_RANK.indexOf(name.toLowerCase());
    if (rank >= bestRank) {
      best = speech;
      bestRank = rank;
    }
  }
  return best;
}

export interface RoundArgumentsPromptInput {
  speeches: AnalysisSpeech[];
  /** The pipeline's per-speech write-up, when it could be read. */
  analysis?: SpeechAnalysis | null;
  videoTitle?: string;
  format?: SpeechSegmentation["format"];
  aff?: string | null;
  neg?: string | null;
  decision?: string | null;
}

function trimmed(text: string): string {
  return text.length > MAX_DECIDING_SPEECH_CHARS ? `${text.slice(0, MAX_DECIDING_SPEECH_CHARS)} … [trimmed]` : text;
}

/** The user turn: metadata, the speech-by-speech outline, then the two deciding speeches in full. */
export function buildRoundArgumentsPrompt(input: RoundArgumentsPromptInput): string {
  const lines: string[] = [];
  if (input.videoTitle) lines.push(`Round: ${input.videoTitle}`);
  if (input.format) lines.push(`Format: ${FORMAT_LABELS[input.format]}`);
  if (input.aff) lines.push(`Affirmative / Pro: ${input.aff}`);
  if (input.neg) lines.push(`Negative / Con: ${input.neg}`);
  if (input.decision) lines.push(`Recorded decision: ${input.decision}`);

  if (input.analysis && input.analysis.speeches.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("Speech-by-speech outline:");
    if (input.analysis.overview) lines.push(input.analysis.overview);
    for (const entry of input.analysis.speeches) {
      if (entry.summary) lines.push("", `### ${entry.name}`, entry.summary);
    }
  }

  const aff = affConstructive(input.speeches);
  const neg = finalNegRebuttal(input.speeches);
  for (const [label, speech] of [
    ["Affirmative constructive", aff],
    ["Final negative rebuttal", neg],
  ] as const) {
    if (!speech || !speech.transcript) continue;
    lines.push("", `## ${label} — ${speech.name}, full captions:`, trimmed(speech.transcript));
  }

  return lines.join("\n").trim();
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

function cleanTag(tag: string): string {
  const flat = tag.replace(/\s+/g, " ").replace(/^[-*•\s]+|[.;\s]+$/g, "").trim();
  if (flat.length <= MAX_TAG_CHARS) return flat;
  const cut = flat.slice(0, MAX_TAG_CHARS);
  return cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : MAX_TAG_CHARS).trim();
}

/** A side's tags, from a list or a comma-separated string, as one `arg_1ac`-style field. */
function tagsField(value: unknown): string | null {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of raw) {
    // Commas would split one tag into two when the field is read back.
    for (const part of item.split(",")) {
      const tag = cleanTag(part);
      const key = tag.toLowerCase();
      if (!tag || seen.has(key) || /^(none|unknown|n\/a|unclear)$/i.test(tag)) continue;
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags.length > 0 ? tags.slice(0, MAX_ARGUMENT_TAGS).join(", ") : null;
}

/**
 * Reads the model's reply.
 *
 * @returns The pick, or `null` when the reply names no argument for either side.
 */
export function parseRoundArgumentsResponse(text: string): RoundArgumentPick | null {
  const json = extractJson(text) as { aff?: unknown; neg?: unknown } | null;
  if (!json || typeof json !== "object") return null;
  const pick = { aff: tagsField(json.aff), neg: tagsField(json.neg) };
  return pick.aff || pick.neg ? pick : null;
}
