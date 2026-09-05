/**
 * @fileoverview Network call for the "Video-Lecture-Training Coach AI"
 * Q&A follow-up (b) — see `team-coach-ai.ts`'s file doc-comment. Kept
 * separate from that pure prompt/parse module so the response-parsing
 * logic can be unit-tested without mocking the API client, mirroring
 * `debate-round`'s `round/ai-versus-speech-client.ts` split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by `reason-editor`, `debate-card-search`'s LLM Card Scoring AI
 * assessment, and `debate-round`'s AI speech/judge-decision calls) rather
 * than standing up a second route — via `debate-api-client`'s
 * `reasonAiComplete`, posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module coach/team-coach-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "../lib/api-client";
import { TEAM_COACH_AI_SYSTEM_PROMPT, parseTeamCoachAiResponse } from "./team-coach-ai";
import { buildCoachConversationMessages } from "./team-coach-materials";
import type {
  BuildCoachConversationMessagesOptions,
  CoachConversationTurn,
  CoachMaterialMatch,
} from "./team-coach-materials";

/** A coach's answer can run several paragraphs, well beyond a short JSON verdict. */
const MAX_TOKENS = 2048;

export interface RequestTeamCoachAnswerOptions extends BuildCoachConversationMessagesOptions {
  /**
   * Prior question/answer turns in this conversation, oldest first — fed
   * back as conversation context (see `buildCoachConversationMessages`) so
   * a follow-up question can build on an earlier answer. Defaults to no
   * history, matching the original single-question behavior.
   */
  history?: CoachConversationTurn[];
}

/**
 * Requests the team coach AI's answer to `question` given the grounding
 * `matches` (e.g. from `findRelevantMaterials`/`findRelevantMaterialsFromStore`)
 * from `/api/reason-ai`, returning the parsed answer text.
 *
 * The `messages` array sent to the model is exactly
 * `buildCoachConversationMessages(question, matches, options.history, options)`'s
 * output: `options.history` (if any) as alternating user/assistant turns,
 * then `question`'s own grounded prompt as the final user turn — so the
 * same grounding-materials framing a caller can preview stays what the
 * model actually sees, now with the conversation's prior turns folded in.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text parses to nothing usable.
 */
export async function requestTeamCoachAnswer(
  question: string,
  matches: CoachMaterialMatch[],
  options: RequestTeamCoachAnswerOptions = {},
  client: Client = apiClient,
): Promise<string> {
  const { history = [], ...messageOptions } = options;

  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: TEAM_COACH_AI_SYSTEM_PROMPT,
        messages: buildCoachConversationMessages(question, matches, history, messageOptions),
        maxTokens: MAX_TOKENS,
      },
    },
    { client },
  );

  if (error) {
    throw new Error("Team coach AI request failed.");
  }

  const answer = parseTeamCoachAiResponse(data?.text ?? "");
  if (!answer) {
    throw new Error("AI returned an empty or unusable answer.");
  }
  return answer;
}
