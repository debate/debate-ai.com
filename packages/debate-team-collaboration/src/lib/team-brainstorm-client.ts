/**
 * @fileoverview Network call for the "Team Brainstorm Assist" AI
 * idea-drafting request (follow-up (a) under the "🧠 Team Brainstorm Assist"
 * bullet in TODO.md). Kept separate from `lib/team-brainstorm-ai.ts`'s pure
 * prompt-building and response-parsing so those can be unit-tested without
 * mocking `fetch`.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `lib/llm-card-scoring-client.ts` and `reason-editor`) rather than
 * standing up a second route — this is a small, self-contained fetch-based
 * client posting the same `{ system, messages, maxTokens }` JSON contract
 * that route accepts.
 *
 * @module lib/team-brainstorm-client
 */

import {
  TEAM_BRAINSTORM_AI_SYSTEM_PROMPT,
  buildTeamBrainstormAiUserPrompt,
  parseTeamBrainstormAiResponse,
} from "./team-brainstorm-ai";
import type { BrainstormPrompt } from "./team-brainstorm-assist";

/** A handful of short idea strings — no need for a large reply budget. */
const MAX_TOKENS = 512;

/**
 * Requests AI-drafted candidate ideas for `request`'s board from
 * `/api/reason-ai` (or `endpoint`, if overridden), returning the parsed
 * list of idea strings.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * doesn't parse into a usable list of ideas.
 */
export async function requestTeamBrainstormAiIdeas(
  request: BrainstormPrompt,
  endpoint = "/api/reason-ai",
): Promise<string[]> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: TEAM_BRAINSTORM_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildTeamBrainstormAiUserPrompt(request) }],
      maxTokens: MAX_TOKENS,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const payload = (await res.json()) as { error?: string };
      detail = payload?.error ?? "";
    } catch {
      // Body wasn't JSON.
    }
    throw new Error(detail || `Brainstorm AI request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const ideas = parseTeamBrainstormAiResponse(json.text ?? "");
  if (!ideas) {
    throw new Error("AI returned a response that couldn't be parsed as brainstorm ideas.");
  }
  return ideas;
}
