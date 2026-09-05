/**
 * @fileoverview Network call for the "Team Brainstorm Assist" AI
 * idea-drafting request (follow-up (a) under the "🧠 Team Brainstorm Assist"
 * bullet in TODO.md). Kept separate from `lib/team-brainstorm-ai.ts`'s pure
 * prompt-building and response-parsing so those can be unit-tested without
 * mocking the API client.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `lib/llm-card-scoring-client.ts` and `reason-editor`) rather than
 * standing up a second route — via `debate-api-client`'s `reasonAiComplete`,
 * posting the same `{ system, messages, maxTokens }` JSON contract that
 * route accepts.
 *
 * @module lib/team-brainstorm-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "./api-client";
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
 * `/api/reason-ai`, returning the parsed list of idea strings.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text doesn't parse into a usable list of ideas.
 */
export async function requestTeamBrainstormAiIdeas(
  request: BrainstormPrompt,
  client: Client = apiClient,
): Promise<string[]> {
  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: TEAM_BRAINSTORM_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildTeamBrainstormAiUserPrompt(request) }],
        maxTokens: MAX_TOKENS,
      },
    },
    { client },
  );

  if (error) {
    throw new Error("Brainstorm AI request failed.");
  }

  const ideas = parseTeamBrainstormAiResponse(data?.text ?? "");
  if (!ideas) {
    throw new Error("AI returned a response that couldn't be parsed as brainstorm ideas.");
  }
  return ideas;
}
