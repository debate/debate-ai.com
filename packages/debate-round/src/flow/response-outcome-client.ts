/**
 * @fileoverview Network call for the "AI Response-Outcome Charts" AI
 * counsel-panel follow-up (a) — see `response-outcome-ai.ts`'s file
 * doc-comment. Kept separate from that pure prompt-building/parsing module
 * so the prompt/parse logic can be unit-tested without mocking the API
 * client, mirroring `round/judge-decision-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`, `debate-card-search`'s LLM Card Scoring AI
 * assessment, and this package's other AI-backed calls) rather than
 * standing up a second route — via `debate-api-client`'s `reasonAiComplete`,
 * posting the same `{ system, messages, maxTokens }` JSON contract that
 * route accepts.
 *
 * @module flow/response-outcome-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "../lib/api-client";
import {
  COUNSEL_PANEL_AI_SYSTEM_PROMPT,
  buildCounselPanelAiUserPrompt,
  parseCounselPanelAiResponse,
  type CounselPanelAiInput,
  type CounselPanelAiResult,
} from "./response-outcome-ai";

/** The reply is a short JSON verdict per argument, not free-form prose. */
const MAX_TOKENS = 1536;

/**
 * Requests an AI counsel-panel assessment for `input` from `/api/reason-ai`,
 * returning the parsed `CounselPanelAiResult`.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text doesn't parse into a valid assessment.
 */
export async function requestCounselPanelAssessment(
  input: CounselPanelAiInput,
  client: Client = apiClient,
): Promise<CounselPanelAiResult> {
  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: COUNSEL_PANEL_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildCounselPanelAiUserPrompt(input) }],
        maxTokens: MAX_TOKENS,
      },
    },
    { client },
  );

  if (error) {
    throw new Error("AI counsel-panel request failed.");
  }

  const result = parseCounselPanelAiResponse(data?.text ?? "");
  if (!result) {
    throw new Error("AI returned a response that couldn't be parsed as a counsel-panel assessment.");
  }
  return result;
}
