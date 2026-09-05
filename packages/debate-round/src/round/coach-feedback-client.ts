/**
 * @fileoverview Network call for the "AI Coach Mode" open-ended-feedback
 * follow-up (a) — see `coach-feedback-ai.ts`'s file doc-comment. Kept
 * separate from that pure prompt/parse module so the response-parsing
 * logic can be unit-tested without mocking the API client, mirroring
 * `debate-speech-writer`'s `coach/team-coach-client.ts` split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`, `debate-card-search`'s LLM Card Scoring AI
 * assessment, and this package's other AI speech/judge-decision calls)
 * rather than standing up a second route — via `debate-api-client`'s
 * `reasonAiComplete`, posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module round/coach-feedback-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "../lib/api-client";
import {
  COACH_FEEDBACK_AI_SYSTEM_PROMPT,
  buildCoachFeedbackAiUserPrompt,
  parseCoachFeedbackAiResponse,
  type CoachFeedbackAiInput,
} from "./coach-feedback-ai";

/** Open-ended coaching feedback can run several paragraphs, well beyond a short JSON verdict. */
const MAX_TOKENS = 2048;

/**
 * Requests open-ended AI coaching feedback for `input` from
 * `/api/reason-ai`, returning the parsed feedback text.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text parses to nothing usable.
 */
export async function requestCoachFeedback(input: CoachFeedbackAiInput, client: Client = apiClient): Promise<string> {
  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: COACH_FEEDBACK_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildCoachFeedbackAiUserPrompt(input) }],
        maxTokens: MAX_TOKENS,
      },
    },
    { client },
  );

  if (error) {
    throw new Error("Coach feedback AI request failed.");
  }

  const feedback = parseCoachFeedbackAiResponse(data?.text ?? "");
  if (!feedback) {
    throw new Error("AI returned an empty or unusable feedback response.");
  }
  return feedback;
}
