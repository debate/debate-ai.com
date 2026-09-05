/**
 * @fileoverview Network call for the "AI Drill Generator" real-script
 * follow-up (b) — see `drill-script-ai.ts`'s file doc-comment. Kept separate
 * from that pure prompt/parse module so the response-parsing logic can be
 * unit-tested without mocking the API client, mirroring
 * `coach-feedback-client.ts`'s split.
 *
 * Reuses the existing `/api/reason-ai` server-side Anthropic proxy (also
 * used by this package's other AI speech/judge-decision/coach-feedback
 * calls) rather than standing up a second route — via `debate-api-client`'s
 * `reasonAiComplete`, posting the same `{ system, messages, maxTokens }`
 * JSON contract that route accepts.
 *
 * @module round/drill-script-client
 */

import { reasonAiComplete, type Client } from "debate-api-client";
import { apiClient } from "../lib/api-client";
import {
  DRILL_SCRIPT_AI_SYSTEM_PROMPT,
  buildDrillScriptAiUserPrompt,
  parseDrillScriptAiResponse,
  type DrillScriptAiInput,
} from "./drill-script-ai";

/** A single drill's script is a short rehearsal passage, not a full speech. */
const MAX_TOKENS = 1024;

/**
 * Requests an actual, ready-to-read AI practice script for `input`'s drill
 * from `/api/reason-ai`, returning the parsed script text.
 *
 * Throws a plain `Error` with a useful message when the request fails or
 * when the response text parses to nothing usable.
 */
export async function requestDrillScript(input: DrillScriptAiInput, client: Client = apiClient): Promise<string> {
  const { data, error } = await reasonAiComplete(
    {
      body: {
        system: DRILL_SCRIPT_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildDrillScriptAiUserPrompt(input) }],
        maxTokens: MAX_TOKENS,
      },
    },
    { client },
  );

  if (error) {
    throw new Error("Drill script AI request failed.");
  }

  const script = parseDrillScriptAiResponse(data?.text ?? "");
  if (!script) {
    throw new Error("AI returned an empty or unusable drill script response.");
  }
  return script;
}
