/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (a) under the "🧠 Team Brainstorm Assist" bullet in TODO.md ("an
 * actual AI-generation call that drafts candidate ideas from
 * `buildBrainstormPrompt`'s output"). `lib/team-brainstorm-assist.ts` stays
 * exactly as it is — a structured, non-AI-calling prompt/board model — and
 * this module adds a second, genuinely AI-backed step alongside it: a
 * system prompt + user-prompt builder that ask Claude to draft several
 * candidate brainstorm ideas for a board's seeding prompt, plus a tolerant
 * parser for the model's reply, mirroring `lib/llm-card-scoring-ai.ts`'s
 * strict-JSON-with-tolerant-fallback split.
 *
 * This file makes no network call itself (see
 * `lib/team-brainstorm-client.ts` for that) so the prompt-building and
 * parsing logic can be exercised directly in Vitest without mocking
 * `fetch`.
 *
 * @module lib/team-brainstorm-ai
 */

import type { BrainstormPrompt } from "./team-brainstorm-assist";

const CATEGORY_LABELS: Record<BrainstormPrompt["category"], string> = {
  argument: "new arguments",
  impact_framing: "impact framing",
  frontline: "frontline answers",
  response: "responses and turns",
};

/** How many candidate ideas the model is asked to draft per request. */
export const TEAM_BRAINSTORM_AI_IDEA_COUNT = 4;

/**
 * System prompt instructing the model to act as a competitive-debate
 * brainstorm partner and reply with strict JSON only — no prose, no
 * markdown code fences — so `parseTeamBrainstormAiResponse` can parse it
 * directly. (The parser also tolerates a fenced or prose-wrapped reply,
 * since models don't always follow this instruction exactly.)
 */
export const TEAM_BRAINSTORM_AI_SYSTEM_PROMPT =
  "You are an expert competitive-debate coach helping a squad brainstorm during a prep session. " +
  "A user will give you an argument block and a brainstorm category (new arguments, impact framing, " +
  "frontline answers, or responses and turns). Draft several distinct, concrete, round-usable ideas — " +
  "not vague restatements of the prompt — that a debater could develop into an actual argument or " +
  "block.\n\n" +
  "Respond with STRICT JSON ONLY — no prose before or after it, no markdown code fences, no trailing " +
  `commentary. The JSON must have exactly this shape: {"ideas": ["<idea 1>", "<idea 2>", ...]}\n\n` +
  `Draft ${TEAM_BRAINSTORM_AI_IDEA_COUNT} ideas. Each idea must be a non-empty, self-contained ` +
  "sentence or two — distinct from the others, not a restatement of the prompt.";

/**
 * Builds the user-turn message text for a team-brainstorm AI request: the
 * board's argument block, category, and seeding prompt, plus a restatement
 * of the required JSON reply shape.
 */
export function buildTeamBrainstormAiUserPrompt(request: BrainstormPrompt): string {
  return (
    `Argument block: ${request.argBlock}\n` +
    `Brainstorm category: ${CATEGORY_LABELS[request.category]}\n\n` +
    `Prompt: ${request.prompt}\n\n` +
    "Reply with JSON only, matching this shape:\n" +
    '{"ideas": [string, string, ...]}'
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates a parsed JSON value against the expected reply shape, returning
 * a normalized, trimmed list of idea strings (empty entries dropped) or
 * `null` if `ideas` is missing, wrong-typed, or contains no usable
 * (non-empty after trimming) idea at all.
 */
function validateIdeas(value: unknown): string[] | null {
  if (typeof value !== "object" || value === null) return null;
  const ideasRaw = (value as Record<string, unknown>)["ideas"];
  if (!Array.isArray(ideasRaw)) return null;

  const ideas = ideasRaw.filter(isNonEmptyString).map((idea) => idea.trim());
  return ideas.length > 0 ? ideas : null;
}

/** Extracts the first top-level `{...}` block from `raw`, or `null` if there isn't one. */
function extractFirstJsonObject(raw: string): string | null {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Tolerantly parses a model reply into a list of candidate idea strings.
 * Tries `JSON.parse` on the trimmed string first (the model was asked to
 * reply with JSON only); if that fails, falls back to extracting the first
 * `{...}` block from the string (handling replies wrapped in prose or a
 * ```json fence) and parsing that instead.
 *
 * Returns `null` — rather than throwing — when the string isn't parseable
 * JSON at all, or when the parsed value doesn't validate against the
 * expected shape, so a malformed AI response degrades gracefully instead of
 * crashing the panel.
 */
export function parseTeamBrainstormAiResponse(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return validateIdeas(JSON.parse(trimmed));
  } catch {
    // Fall through to the extraction fallback below.
  }

  const extracted = extractFirstJsonObject(trimmed);
  if (!extracted) return null;

  try {
    return validateIdeas(JSON.parse(extracted));
  } catch {
    return null;
  }
}
