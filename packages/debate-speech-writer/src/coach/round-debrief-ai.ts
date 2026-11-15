/**
 * @fileoverview Pure prompt-building and response-parsing helpers for the
 * **Coach debrief** on Practice vs AI's end-of-round scorecard
 * (`debate-practice-vs-ai`'s `JudgmentPopup`). After the judge's decision is
 * revealed, the debater can ask an AI coach to turn the scorecard (and their
 * own speeches) into a short debrief, in one of the coaching styles from
 * `coach-personas.ts`.
 *
 * This file makes no network call itself (see `round-debrief-client.ts`), so
 * the prompt and parsing logic can be tested without mocking `fetch`,
 * mirroring `team-coach-ai.ts` / `team-coach-client.ts`.
 *
 * @module coach/round-debrief-ai
 */

import { applyCoachPersonaToSystemPrompt } from "./coach-personas";

/** One judged phase of the round, from the debater's point of view. */
export interface RoundDebriefPhase {
  /** Phase title, e.g. "Opening Statement". */
  title: string;
  /** The debater's score for the phase (out of `maxScore`). */
  userScore: number;
  /** The opponent's score for the phase. */
  opponentScore: number;
  /** The judge's reasoning for the debater's score. */
  userReason: string;
  /** The judge's reasoning for the opponent's score. */
  opponentReason?: string;
}

/** One of the debater's own speeches, quoted to ground the debrief. */
export interface RoundDebriefSpeech {
  /** Phase label, e.g. "Opening Statements". */
  phase?: string;
  text: string;
}

/** Everything the debrief prompt is built from. */
export interface RoundDebriefInput {
  /** The resolution debated. */
  topic?: string;
  /** The debater's side, e.g. "For". */
  userStance?: string;
  /** The opponent's name, e.g. an AI bot persona. */
  opponentName?: string;
  /** The judged phases, in round order. */
  phases: RoundDebriefPhase[];
  /** Highest score a phase can get. Defaults to 10. */
  maxScore?: number;
  /** The decision, once revealed. */
  verdict?: { winner: string; reason?: string };
  /** The debater's own speeches, oldest first. Long ones are trimmed. */
  userSpeeches?: RoundDebriefSpeech[];
}

/** Longest single speech quoted in the prompt, in characters. */
export const MAX_DEBRIEF_SPEECH_CHARS = 1500;
/** Longest total of quoted speeches in the prompt, in characters. */
export const MAX_DEBRIEF_SPEECHES_CHARS = 6000;

/**
 * System prompt framing the model as the debater's coach reviewing a finished
 * practice round. It asks for plain text (no fences or preamble), so
 * {@link parseRoundDebriefResponse} can use the reply directly.
 */
export const ROUND_DEBRIEF_AI_SYSTEM_PROMPT =
  "You are a debate coach reviewing a practice round your student just finished against an AI " +
  "opponent. The user's message gives you the judge's scorecard and, when available, the " +
  "student's own speeches. Write a short debrief: name the two or three priorities that would " +
  "have changed the most points, explain why each matters using the judge's reasons, and give " +
  "one concrete thing to practise for each. Base the debrief only on the scorecard and the " +
  "speeches you were given; do not invent what was said. Critique the arguments, never the " +
  "student as a person, and keep the tone encouraging.\n\n" +
  "Reply with the debrief text ONLY, in under 300 words — no preamble like \"Here's your " +
  "debrief\", no meta-commentary about being an AI, and no markdown code fences.";

/**
 * The debrief system prompt in a chosen coaching style (Standard, Socratic,
 * Devil's Advocate, Fact-Checker). Standard, a missing id or an unknown one
 * returns {@link ROUND_DEBRIEF_AI_SYSTEM_PROMPT} unchanged.
 */
export function buildRoundDebriefSystemPrompt(personaId?: unknown): string {
  return applyCoachPersonaToSystemPrompt(ROUND_DEBRIEF_AI_SYSTEM_PROMPT, personaId);
}

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

function formatScore(score: number): string {
  return Number.isFinite(score) ? String(score) : "?";
}

/**
 * The user-turn prompt: the topic and sides, each judged phase with both
 * scores and the judge's reasons, the decision, and the debater's speeches
 * (each clipped to {@link MAX_DEBRIEF_SPEECH_CHARS}, and dropped once their
 * total passes {@link MAX_DEBRIEF_SPEECHES_CHARS}, with a note saying how many
 * were left out). Blank speeches are skipped.
 */
export function buildRoundDebriefUserPrompt(input: RoundDebriefInput): string {
  const maxScore = input.maxScore ?? 10;
  const opponent = input.opponentName?.trim() || "the opponent";
  const lines: string[] = [];

  if (input.topic?.trim()) lines.push(`Topic: ${input.topic.trim()}`);
  if (input.userStance?.trim()) lines.push(`Student's side: ${input.userStance.trim()}`);
  lines.push(`Opponent: ${opponent}`);
  lines.push("");
  lines.push("Judge's scorecard:");
  for (const phase of input.phases) {
    lines.push(
      `- ${phase.title}: student ${formatScore(phase.userScore)}/${maxScore}, ` +
        `opponent ${formatScore(phase.opponentScore)}/${maxScore}.`,
    );
    if (phase.userReason.trim()) lines.push(`  Judge on the student: ${phase.userReason.trim()}`);
    if (phase.opponentReason?.trim()) lines.push(`  Judge on the opponent: ${phase.opponentReason.trim()}`);
  }

  if (input.verdict?.winner.trim()) {
    lines.push("");
    lines.push(`Decision: ${input.verdict.winner.trim()} won.`);
    if (input.verdict.reason?.trim()) lines.push(`Reason for decision: ${input.verdict.reason.trim()}`);
  }

  const speeches = (input.userSpeeches ?? []).filter((s) => s.text.trim());
  if (speeches.length > 0) {
    lines.push("");
    lines.push("The student's speeches:");
    let used = 0;
    let included = 0;
    for (const speech of speeches) {
      const text = clip(speech.text, MAX_DEBRIEF_SPEECH_CHARS);
      if (included > 0 && used + text.length > MAX_DEBRIEF_SPEECHES_CHARS) break;
      used += text.length;
      included += 1;
      lines.push(`[${speech.phase?.trim() || "Speech"}] ${text}`);
    }
    const omitted = speeches.length - included;
    if (omitted > 0) lines.push(`(${omitted} more speech${omitted === 1 ? "" : "es"} left out for length.)`);
  }

  return lines.join("\n");
}

/**
 * Tolerantly parses a model reply into debrief text: trims it and strips a
 * wrapping ```-fence. Returns `null` when nothing usable remains, so a blank
 * reply shows an error instead of an empty debrief.
 */
export function parseRoundDebriefResponse(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;
  const fenceMatch = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) text = fenceMatch[1].trim();
  return text.length > 0 ? text : null;
}
