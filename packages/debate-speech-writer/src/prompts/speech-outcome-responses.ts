/**
 * @fileoverview "AI outcome responses" for a live round: three candidate
 * approaches to the speech the debater is about to give, each simulated
 * forward — the opponent's likely answers, how the most likely judge would
 * decide, the issues that could lose it, and an estimated success rate.
 *
 * Builds on {@link speechToResponsePrompt} (the strategy method for answering
 * an opponent speech while extending prior evidence) and
 * {@link buildJudgeParadigmPrompt} (how the predicted judge evaluates). The
 * caller passes the whole round so far: every prior speech's text, including
 * the cards read in it, and the flow grid.
 *
 * Pure prompt-building and parsing only; the network call lives with the
 * caller (`debate-round`'s `round/outcome-responses-client.ts`).
 *
 * @module prompts/speech-outcome-responses
 */

import { speechToResponsePrompt } from "./speech-to-response";
import { buildJudgeParadigmPrompt, type JudgeParadigm } from "../judge/judge-paradigms";

/** Which side a speech belongs to. */
export type OutcomeSide = "aff" | "neg";

/** One speech already given in the round. */
export type OutcomePriorSpeech = {
  /** Speech name, e.g. `"1AC"`. */
  speech: string;
  side: OutcomeSide | null;
  /** The speech doc as plain text: tags, cites and card text read so far. */
  text: string;
};

/** The judge the simulation predicts a decision for. */
export type OutcomeJudge = {
  /** Display name, e.g. a judge on the round, or `"Typical judge"`. */
  name: string;
  paradigm: JudgeParadigm;
  /** `buildJudgeTendencySummary` output when the judge has a saved profile. */
  tendencySummary?: string;
};

export type SpeechOutcomeResponsesInput = {
  /** The speech being prepared, e.g. `"2AC"`. */
  speechName: string;
  side: OutcomeSide;
  /** Round label (tournament, round, teams), when known. */
  roundLabel?: string;
  /** Speeches before this one, in speaking order. */
  priorSpeeches: OutcomePriorSpeech[];
  /** The flow grid as text: each argument row and every speech's entry on it. */
  flowText: string;
  judge: OutcomeJudge;
  /** Optional free-text steer from the debater ("go for the DA", "short on time"). */
  focus?: string;
};

/** The judge's predicted decision if this candidate is given. */
export type OutcomeJudgeDecision = {
  winner: OutcomeSide;
  rationale: string;
};

/** One simulated approach to the speech. */
export type SpeechOutcomeCandidate = {
  /** Short name for the approach, e.g. "Collapse to the Alliance DA". */
  title: string;
  /** One or two sentences: what this speech goes for and why. */
  strategy: string;
  /** Speech-ready bullet outline, in delivery order. */
  outline: string[];
  /** Short card-search queries for evidence this speech should read. */
  cardSearches: string[];
  /** How the opponent most likely answers this speech. */
  opponentAnswers: string[];
  judgeDecision: OutcomeJudgeDecision;
  /** Risks and weaknesses: drops, missing evidence, judge-fit problems. */
  issues: string[];
  /** Estimated chance (0-100) this approach wins the round for the speaker's side. */
  successRate: number;
};

export type SpeechOutcomeResponsesResult = {
  candidates: SpeechOutcomeCandidate[];
  /** Index into `candidates` of the approach the model recommends. */
  recommendedIndex: number;
};

/** Exactly this many candidates are requested and required. */
export const OUTCOME_CANDIDATE_COUNT = 3;

/** Per-speech character cap so one long doc can't crowd out the rest of the round. */
export const MAX_PRIOR_SPEECH_CHARS = 12_000;
/** Overall cap on prior-speech text; oldest speeches are trimmed first. */
export const MAX_ROUND_CONTEXT_CHARS = 60_000;
const MAX_FLOW_CHARS = 20_000;

const JSON_SHAPE =
  '{"recommendedIndex": 0, "candidates": [{"title": string, "strategy": string, ' +
  '"outline": string[], "cardSearches": string[], "opponentAnswers": string[], ' +
  '"judgeDecision": {"winner": "aff" | "neg", "rationale": string}, ' +
  '"issues": string[], "successRate": number (0-100)}]}';

/**
 * System prompt: the speech-to-response strategy method, then the
 * outcome-simulation task and the strict JSON reply contract.
 */
export const SPEECH_OUTCOME_RESPONSES_SYSTEM_PROMPT =
  "You are a debate strategist helping a student prepare their next speech during a live round. " +
  "Use the strategy method below to plan responses, but IGNORE its output format: you reply with JSON only.\n\n" +
  "=== STRATEGY METHOD ===\n" +
  speechToResponsePrompt.trim() +
  "\n=== END STRATEGY METHOD ===\n\n" +
  "TASK: Propose exactly " + OUTCOME_CANDIDATE_COUNT + " materially different approaches to the speech " +
  "(e.g. different arguments to collapse to, extend, or turn). For each one, simulate the rest of the round:\n" +
  "1. outline: speech-ready bullets in delivery order. Extend evidence already read in prior speeches by " +
  "author and speech (e.g. \"Extend Fatton 19 from the 1NC\"), and answer the opponent's newest arguments.\n" +
  "2. cardSearches: 1-4 short evidence-search queries (2-6 words) for cards this speech should read or find.\n" +
  "3. opponentAnswers: the opponent's most likely answers to this speech in their next speech.\n" +
  "4. judgeDecision: who the given judge most likely votes for if the round goes this way, under that " +
  "judge's paradigm and tendencies, with a one or two sentence rationale.\n" +
  "5. issues: the risks that could lose the round on this path (dropped arguments, missing evidence, " +
  "time pressure, poor fit with the judge).\n" +
  "6. successRate: your estimated chance (0-100) that this approach wins the round for the speaker's side. " +
  "Be calibrated; these are estimates from the flow, not certainties, and they need not add to 100.\n\n" +
  "Critique the arguments, never the debaters. Ground everything in the round text you are given; " +
  "do not invent cards that were read. Keep it compact: at most 8 outline bullets, 4 opponent answers and " +
  "4 issues per candidate, each under 30 words.\n\n" +
  "Respond with STRICT JSON ONLY: no prose, no markdown code fences. Shape:\n" +
  JSON_SHAPE;

function sideLabel(side: OutcomeSide | null): string {
  if (side === "aff") return "Aff";
  if (side === "neg") return "Neg";
  return "Unknown side";
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}\n[…truncated]` : trimmed;
}

/**
 * Fits prior speeches into {@link MAX_ROUND_CONTEXT_CHARS}: each speech is
 * capped at {@link MAX_PRIOR_SPEECH_CHARS}, then the oldest speeches are
 * shortened first, since the newest speech is the one being answered.
 */
export function fitPriorSpeeches(speeches: OutcomePriorSpeech[]): OutcomePriorSpeech[] {
  const capped = speeches.map((s) => ({ ...s, text: truncate(s.text, MAX_PRIOR_SPEECH_CHARS) }));
  let total = capped.reduce((sum, s) => sum + s.text.length, 0);
  for (let i = 0; i < capped.length && total > MAX_ROUND_CONTEXT_CHARS; i++) {
    const over = total - MAX_ROUND_CONTEXT_CHARS;
    const keep = Math.max(0, capped[i].text.length - over);
    const next = keep === 0 ? "[omitted for length]" : truncate(capped[i].text, keep);
    total += next.length - capped[i].text.length;
    capped[i] = { ...capped[i], text: next };
  }
  return capped;
}

/** Builds the user turn: round, judge, prior speeches, flow, and the reply shape. */
export function buildSpeechOutcomeResponsesUserPrompt(input: SpeechOutcomeResponsesInput): string {
  const { speechName, side, roundLabel, priorSpeeches, flowText, judge, focus } = input;
  const parts: string[] = [];

  parts.push(`Speech to prepare: ${speechName} (${sideLabel(side)}).`);
  if (roundLabel?.trim()) parts.push(`Round: ${roundLabel.trim()}`);
  if (focus?.trim()) parts.push(`Debater's focus: ${focus.trim()}`);

  parts.push(
    `Predicted judge: ${judge.name}\n${buildJudgeParadigmPrompt(judge.paradigm)}` +
      (judge.tendencySummary?.trim() ? `\nBallot history:\n${judge.tendencySummary.trim()}` : ""),
  );

  const speeches = fitPriorSpeeches(priorSpeeches.filter((s) => s.text.trim()));
  parts.push(
    speeches.length === 0
      ? "Prior speeches: none yet (this is the opening speech or no speech docs were written)."
      : "Prior speeches, in order, with the cards read in each:\n" +
          speeches
            .map((s) => `--- ${s.speech} (${sideLabel(s.side)}) ---\n${s.text}`)
            .join("\n\n"),
  );

  parts.push(`Flow so far:\n"""\n${truncate(flowText || "No arguments have been flowed yet.", MAX_FLOW_CHARS)}\n"""`);
  parts.push(
    `"winner" is "aff" or "neg"; successRate is the chance the ${sideLabel(side)} wins on that path. ` +
      `Reply with JSON only, exactly ${OUTCOME_CANDIDATE_COUNT} candidates, matching:\n${JSON_SHAPE}`,
  );

  return parts.join("\n\n");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isNonEmptyString).map((s) => s.trim()) : [];
}

function validateCandidate(value: unknown): SpeechOutcomeCandidate | null {
  if (typeof value !== "object" || value === null) return null;
  const c = value as Record<string, unknown>;
  if (!isNonEmptyString(c.title) || !isNonEmptyString(c.strategy)) return null;

  const outline = stringList(c.outline);
  if (outline.length === 0) return null;

  const decision = c.judgeDecision as Record<string, unknown> | null | undefined;
  if (!decision || (decision.winner !== "aff" && decision.winner !== "neg")) return null;

  const rate = typeof c.successRate === "string" ? Number.parseFloat(c.successRate) : c.successRate;
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;

  return {
    title: c.title.trim(),
    strategy: c.strategy.trim(),
    outline,
    cardSearches: stringList(c.cardSearches),
    opponentAnswers: stringList(c.opponentAnswers),
    judgeDecision: {
      winner: decision.winner,
      rationale: isNonEmptyString(decision.rationale) ? decision.rationale.trim() : "",
    },
    issues: stringList(c.issues),
    successRate: Math.round(Math.max(0, Math.min(100, rate))),
  };
}

function validateResult(value: unknown): SpeechOutcomeResponsesResult | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = (value as Record<string, unknown>).candidates;
  if (!Array.isArray(raw)) return null;

  const candidates = raw
    .map(validateCandidate)
    .filter((c): c is SpeechOutcomeCandidate => c !== null)
    .slice(0, OUTCOME_CANDIDATE_COUNT);
  if (candidates.length === 0) return null;

  // The model's pick is only trusted when no candidate was dropped, since
  // dropping one shifts the indexes; otherwise recommend the highest rate.
  const index = (value as Record<string, unknown>).recommendedIndex;
  const best = candidates.reduce((top, c, i) => (c.successRate > candidates[top].successRate ? i : top), 0);
  const indexIsValid =
    raw.length === candidates.length &&
    typeof index === "number" &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < candidates.length;

  return { candidates, recommendedIndex: indexIsValid ? index : best };
}

/**
 * Tolerantly parses the model reply: plain JSON first, then the first
 * `{...}` block (for a fenced or prose-wrapped reply). Malformed candidates
 * are dropped; returns `null` when none survive, so a bad reply degrades to
 * an error message instead of a crash.
 */
export function parseSpeechOutcomeResponsesResponse(raw: string): SpeechOutcomeResponsesResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return validateResult(JSON.parse(trimmed));
  } catch {
    // Fall through to extraction.
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return validateResult(JSON.parse(match[0]));
  } catch {
    return null;
  }
}
