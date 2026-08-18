/**
 * @fileoverview Network call for the "Video-Lecture-Training Coach AI"
 * Q&A follow-up (b) — see `team-coach-ai.ts`'s file doc-comment. Kept
 * separate from that pure prompt/parse module so the response-parsing
 * logic can be unit-tested without mocking `fetch`, mirroring
 * `debate-round`'s `round/ai-versus-speech-client.ts` split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`, `debate-card-search`'s LLM Card Scoring AI
 * assessment, and `debate-round`'s AI speech/judge-decision calls) rather
 * than standing up a second route — this is a small, self-contained
 * fetch-based client posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module coach/team-coach-client
 */

import { TEAM_COACH_AI_SYSTEM_PROMPT, parseTeamCoachAiResponse } from "./team-coach-ai";
import { buildGroundedCoachPrompt } from "./team-coach-materials";
import type { CoachMaterialMatch, GroundedCoachPromptOptions } from "./team-coach-materials";

/** A coach's answer can run several paragraphs, well beyond a short JSON verdict. */
const MAX_TOKENS = 2048;

/**
 * Requests the team coach AI's answer to `question` given the grounding
 * `matches` (e.g. from `findRelevantMaterials`/`findRelevantMaterialsFromStore`)
 * from `/api/reason-ai` (or `endpoint`, if overridden), returning the
 * parsed answer text.
 *
 * The user-turn message sent to the model is exactly
 * `buildGroundedCoachPrompt(question, matches, options)`'s output, so the
 * same grounding-materials framing a caller can preview stays what the
 * model actually sees.
 *
 * Throws a plain `Error` with a useful message when the request fails
 * (reading `{ error }` from the response body if present — e.g. "Sign in
 * to use AI features." or "AI features are not configured on this
 * server." from the proxy's auth/config gates) or when the response text
 * parses to nothing usable.
 */
export async function requestTeamCoachAnswer(
  question: string,
  matches: CoachMaterialMatch[],
  options: GroundedCoachPromptOptions = {},
  endpoint = "/api/reason-ai",
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: TEAM_COACH_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildGroundedCoachPrompt(question, matches, options) }],
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
    throw new Error(detail || `Team coach AI request failed (${res.status}).`);
  }

  const json = (await res.json()) as { text?: string };
  const answer = parseTeamCoachAiResponse(json.text ?? "");
  if (!answer) {
    throw new Error("AI returned an empty or unusable answer.");
  }
  return answer;
}
