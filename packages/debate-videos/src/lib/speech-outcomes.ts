/**
 * @fileoverview Alternative responses to one speech of a recorded round, and
 * the ballot Claude predicts after each — the watch page's "Outcomes" view.
 *
 * Watching a round back, the question a debater actually asks is not "what
 * happened in the 1AR" — the summary answers that — but "what if the 1AR had
 * gone for the turn instead?" This module turns that into one AI request:
 * the round up to the speech, the speech itself, and what actually followed
 * go in; a handful of alternative responses come back, each with the ballot
 * a judge of the chosen kind would likely sign had the speech gone that way,
 * plus the same prediction for the speech as it was really given. The speech
 * as given is the baseline every alternative's swing is measured from.
 *
 * Pure prompt building and parsing only — `speech-outcomes-client.ts` makes
 * the network call — mirroring `debate-practice-rounds`' response-outcome
 * split, so the prompt and the parser are tested without mocking `fetch`.
 * @module lib/speech-outcomes
 */

import type { RoundSpeech, SpeechSide } from "./round-speeches";

/** The kind of judge the ballots are predicted for. */
export type JudgeLens = "flow" | "lay" | "policymaker" | "critical";

export const JUDGE_LENSES: Array<{ id: JudgeLens; label: string; description: string }> = [
  {
    id: "flow",
    label: "Flow judge",
    description:
      "A technical, experienced circuit judge who votes on the flow: dropped arguments are true, extensions need warrants, and weighing decides close rounds.",
  },
  {
    id: "lay",
    label: "Lay judge",
    description:
      "A parent or community judge with no debate background who votes for the clearer, more persuasive side and discounts jargon, speed and technical drops.",
  },
  {
    id: "policymaker",
    label: "Policymaker",
    description:
      "A judge who compares the world of the plan to the status quo or a competitive alternative and votes on net benefits and comparative risk.",
  },
  {
    id: "critical",
    label: "Kritik-friendly",
    description:
      "A judge open to framework, kritiks and performance, who weighs the debaters' representations and the role of the ballot before the policy consequences.",
  },
];

export const DEFAULT_JUDGE_LENS: JudgeLens = "flow";

/** How many alternatives a run asks for, and the bounds on it. */
export const DEFAULT_ALTERNATIVE_COUNT = 3;
export const MIN_ALTERNATIVES = 2;
export const MAX_ALTERNATIVES = 4;

/** A predicted decision. Probabilities are the affirmative's, 0–100. */
export interface PredictedBallot {
  winner: "aff" | "neg";
  affWinProbability: number;
  /** One or two sentences — the reason for decision. */
  rfd: string;
}

/** One way the speech could have gone instead. */
export interface AlternativeResponse {
  title: string;
  /** Short strategy tag — `collapse`, `turn`, `weighing`, `line-by-line`… */
  approach: string;
  /** The speech as a bullet outline, in speaking order. */
  outline: string[];
  /** What this gives up relative to the speech as given. */
  tradeoff: string;
  ballot: PredictedBallot;
}

/** A full run for one speech. */
export interface SpeechOutcomeSimulation {
  actual: {
    /** How the speech as given positioned its side. */
    assessment: string;
    ballot: PredictedBallot;
  };
  alternatives: AlternativeResponse[];
  /** The points of clash the ballot turns on after this speech. */
  keyClash: string[];
}

export interface SpeechOutcomeInput {
  videoTitle?: string;
  speeches: RoundSpeech[];
  /** Index into `speeches` of the speech to re-imagine. */
  index: number;
  lens: JudgeLens;
  count?: number;
}

/** Longest excerpt of any one earlier or later speech sent as context. */
const CONTEXT_CHARS = 1400;
/** Longest excerpt of the speech itself. */
const SPEECH_CHARS = 7000;

function clip(text: string, limit: number): string {
  const trimmed = text.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit).trimEnd()} …[cut]` : trimmed;
}

/** The best single account of a speech for context: summary, then analysis, then words. */
function speechDigest(speech: RoundSpeech): string {
  return speech.parts.summary ?? speech.parts.analysis ?? speech.parts.transcript ?? "";
}

const SIDE_NAMES: Record<SpeechSide, string> = {
  aff: "affirmative / pro",
  neg: "negative / con",
  cx: "cross-examination",
  neutral: "not a speech",
};

export function clampAlternativeCount(count: number | undefined): number {
  const value = Math.round(count ?? DEFAULT_ALTERNATIVE_COUNT);
  if (!Number.isFinite(value)) return DEFAULT_ALTERNATIVE_COUNT;
  return Math.min(MAX_ALTERNATIVES, Math.max(MIN_ALTERNATIVES, value));
}

/**
 * System prompt. Asks for strict JSON, and carries the guardrails every AI
 * judge in this repo keeps: the debaters are often minors, so critique the
 * arguments and never the people, and hedge a close call rather than
 * inventing certainty.
 */
export const SPEECH_OUTCOME_SYSTEM_PROMPT =
  "You are an experienced competitive debate coach and judge (Policy, Lincoln-Douglas and Public Forum). " +
  "You are shown a recorded round up to one speech, that speech, and what actually happened afterwards. " +
  "Your job is counterfactual: propose genuinely different responses the speaker could have given in that " +
  "same speech — different strategic choices, not rewordings — and predict the ballot a judge of the " +
  "described kind would most likely sign had the speech gone each way, assuming the later speeches adapt " +
  "sensibly to the change. Also predict the ballot for the speech as it was actually given.\n\n" +
  "Rules:\n" +
  "- Critique arguments and strategy, never the debaters as people; many are high-school students.\n" +
  "- Stay within what that speech could realistically do: its time, its position in the round, and the " +
  "rules on new arguments in rebuttals.\n" +
  "- The source material is a rough auto-transcript and AI summaries. Where it is unclear, say so in the " +
  "reasoning rather than inventing specifics, and keep probabilities near 50 for genuinely close calls.\n" +
  "- affWinProbability is the affirmative's (or pro's) chance of winning, an integer 0-100, and must agree " +
  "with winner.\n\n" +
  "Respond with STRICT JSON ONLY — no prose, no markdown fences — in exactly this shape:\n" +
  '{"actual": {"assessment": string, "ballot": {"winner": "aff" | "neg", "affWinProbability": number, "rfd": string}}, ' +
  '"alternatives": [{"title": string, "approach": string, "outline": [string, ...], "tradeoff": string, ' +
  '"ballot": {"winner": "aff" | "neg", "affWinProbability": number, "rfd": string}}, ...], ' +
  '"keyClash": [string, ...]}\n' +
  "approach is a one- or two-word strategy tag such as collapse, turn, weighing, line-by-line, framework, " +
  "kritik, concession or questioning. outline has 3-6 short bullets in speaking order. keyClash has 2-4 " +
  "short items. Every string must be non-empty.";

/** The user turn: the round around the speech, the speech, and the ask. */
export function buildSpeechOutcomePrompt(input: SpeechOutcomeInput): string {
  const { speeches, index } = input;
  const speech = speeches[index];
  if (!speech) throw new Error(`No speech at index ${index}.`);
  const lens = JUDGE_LENSES.find((option) => option.id === input.lens) ?? JUDGE_LENSES[0];
  const count = clampAlternativeCount(input.count);

  const describe = (other: RoundSpeech) => {
    const digest = speechDigest(other);
    return `### ${other.heading} (${SIDE_NAMES[other.side]})\n${digest ? clip(digest, CONTEXT_CHARS) : "(nothing written)"}`;
  };

  const before = speeches.slice(0, index).map(describe);
  const after = speeches.slice(index + 1).map(describe);

  const own: string[] = [];
  if (speech.parts.summary) own.push(`Summary:\n${clip(speech.parts.summary, CONTEXT_CHARS * 2)}`);
  if (speech.parts.analysis) own.push(`Analysis:\n${clip(speech.parts.analysis, CONTEXT_CHARS * 2)}`);
  if (speech.parts.transcript) own.push(`Transcript:\n${clip(speech.parts.transcript, SPEECH_CHARS)}`);

  const isCrossEx = speech.side === "cx";

  return [
    input.videoTitle ? `Round: ${input.videoTitle}` : null,
    `Judge: ${lens.label} — ${lens.description}`,
    "",
    "## The round before this speech",
    before.length ? before.join("\n\n") : "(This is the first speech of the round.)",
    "",
    `## The speech to re-imagine: ${speech.heading} (${SIDE_NAMES[speech.side]})`,
    own.length ? own.join("\n\n") : "(Nothing written for this speech.)",
    "",
    "## What actually happened afterwards",
    after.length ? after.join("\n\n") : "(This was the last speech.)",
    "",
    `Propose exactly ${count} alternative ${isCrossEx ? "lines of questioning" : "responses"} for ${speech.label}, ` +
      "each a distinct strategy, and predict the ballot for each and for the speech as given. " +
      "Reply with JSON only.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseWinner(value: unknown): "aff" | "neg" | null {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  if (lower === "aff" || lower === "pro" || lower.startsWith("affirm")) return "aff";
  if (lower === "neg" || lower === "con" || lower.startsWith("negat")) return "neg";
  return null;
}

/**
 * Reads a ballot, trusting the probability over the named winner when they
 * disagree — the number is what the chart draws, and a chart that shows 70%
 * for the side marked as losing would read as a bug.
 */
function parseBallot(value: unknown): PredictedBallot | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const rfd = nonEmpty(raw.rfd);
  let probability =
    typeof raw.affWinProbability === "number"
      ? raw.affWinProbability
      : typeof raw.affWinProbability === "string"
        ? Number.parseFloat(raw.affWinProbability)
        : Number.NaN;
  const named = parseWinner(raw.winner);
  if (!rfd) return null;
  if (!Number.isFinite(probability)) {
    if (!named) return null;
    probability = named === "aff" ? 60 : 40;
  }
  // A model that answers 0.7 means 70.
  if (probability > 0 && probability <= 1 && !Number.isInteger(probability)) probability *= 100;
  const affWinProbability = Math.round(Math.min(100, Math.max(0, probability)));
  const winner = affWinProbability === 50 ? (named ?? "aff") : affWinProbability > 50 ? "aff" : "neg";
  return { winner, affWinProbability, rfd };
}

function parseAlternative(value: unknown): AlternativeResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const title = nonEmpty(raw.title);
  const ballot = parseBallot(raw.ballot);
  if (!title || !ballot) return null;
  const outline = Array.isArray(raw.outline)
    ? raw.outline.map(nonEmpty).filter((line): line is string => line !== null)
    : [];
  return {
    title,
    approach: nonEmpty(raw.approach)?.toLowerCase() ?? "alternative",
    outline,
    tradeoff: nonEmpty(raw.tradeoff) ?? "",
    ballot,
  };
}

function validate(value: unknown, limit: number): SpeechOutcomeSimulation | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const actualRaw = raw.actual as Record<string, unknown> | undefined;
  const assessment = nonEmpty(actualRaw?.assessment);
  const actualBallot = parseBallot(actualRaw?.ballot);
  if (!assessment || !actualBallot) return null;

  // Keep the alternatives that parse; one malformed entry should not cost the rest.
  const alternatives = (Array.isArray(raw.alternatives) ? raw.alternatives : [])
    .map(parseAlternative)
    .filter((alternative): alternative is AlternativeResponse => alternative !== null)
    .slice(0, limit);
  if (alternatives.length === 0) return null;

  const keyClash = Array.isArray(raw.keyClash)
    ? raw.keyClash.map(nonEmpty).filter((item): item is string => item !== null)
    : [];

  return { actual: { assessment, ballot: actualBallot }, alternatives, keyClash };
}

/**
 * Tolerantly parses the model's reply: strict JSON first, then the first
 * `{…}` block in it (a fenced or prose-wrapped reply). Returns `null` rather
 * than throwing when nothing usable comes back.
 */
export function parseSpeechOutcomeResponse(
  raw: string,
  limit: number = MAX_ALTERNATIVES,
): SpeechOutcomeSimulation | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return validate(JSON.parse(trimmed), limit);
  } catch {
    // Fall through to extraction.
  }
  const block = trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!block) return null;
  try {
    return validate(JSON.parse(block), limit);
  } catch {
    return null;
  }
}

/**
 * How far an alternative moves the ballot for the side that gave the speech,
 * in percentage points — positive is better for the speaker. A cross-ex or
 * a non-speech has no speaking side, so it is measured for the affirmative.
 */
export function speakerSwing(side: SpeechSide, actual: PredictedBallot, alternative: PredictedBallot): number {
  const delta = alternative.affWinProbability - actual.affWinProbability;
  return side === "neg" ? -delta : delta;
}

/** Which side a swing is measured for, as the chart labels it. */
export function swingSideLabel(side: SpeechSide): string {
  return side === "neg" ? "Neg" : "Aff";
}

/** The alternative that does the most for the speaker, or -1 when none beats the speech as given. */
export function bestAlternativeIndex(side: SpeechSide, simulation: SpeechOutcomeSimulation): number {
  let best = -1;
  let bestSwing = 0;
  simulation.alternatives.forEach((alternative, index) => {
    const swing = speakerSwing(side, simulation.actual.ballot, alternative.ballot);
    if (swing > bestSwing) {
      best = index;
      bestSwing = swing;
    }
  });
  return best;
}

function ballotLine(ballot: PredictedBallot): string {
  const winnerProbability = ballot.winner === "aff" ? ballot.affWinProbability : 100 - ballot.affWinProbability;
  return `${ballot.winner.toUpperCase()} (${winnerProbability}%) — ${ballot.rfd}`;
}

/** The run as Markdown, for the copy button — something a debater can paste into a doc or a team chat. */
export function speechOutcomesToMarkdown(
  speech: RoundSpeech,
  simulation: SpeechOutcomeSimulation,
  lens: JudgeLens,
): string {
  const lensLabel = JUDGE_LENSES.find((option) => option.id === lens)?.label ?? lens;
  const lines = [
    `## Alternative responses: ${speech.heading}`,
    `_Predicted for a ${lensLabel.toLowerCase()} by AI — not a real result._`,
    "",
    "### As given",
    simulation.actual.assessment,
    "",
    `**Ballot:** ${ballotLine(simulation.actual.ballot)}`,
  ];
  simulation.alternatives.forEach((alternative, index) => {
    const swing = speakerSwing(speech.side, simulation.actual.ballot, alternative.ballot);
    lines.push(
      "",
      `### ${index + 1}. ${alternative.title} (${alternative.approach}, ${swing >= 0 ? "+" : ""}${swing} ${swingSideLabel(speech.side)})`,
      ...alternative.outline.map((line) => `- ${line}`),
    );
    if (alternative.tradeoff) lines.push("", `**Trade-off:** ${alternative.tradeoff}`);
    lines.push("", `**Ballot:** ${ballotLine(alternative.ballot)}`);
  });
  if (simulation.keyClash.length) {
    lines.push("", "### Key clash", ...simulation.keyClash.map((item) => `- ${item}`));
  }
  return lines.join("\n");
}
