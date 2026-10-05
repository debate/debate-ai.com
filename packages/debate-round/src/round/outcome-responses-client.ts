/**
 * @fileoverview Network side of the timer menu's "AI outcome responses":
 * reads each prior speech's doc (a linked editor document when there is
 * one, else the flow's own speech doc), posts the round to the
 * `/api/reason-ai` proxy, and runs card searches for the queries a
 * candidate suggests. Pure context building is in
 * `outcome-responses-context.ts`, mirroring `case-choice-client.ts`'s split.
 *
 * @module round/outcome-responses-client
 */

import {
  SPEECH_OUTCOME_RESPONSES_SYSTEM_PROMPT,
  buildSpeechOutcomeResponsesUserPrompt,
  parseSpeechOutcomeResponsesResponse,
  type OutcomePriorSpeech,
  type SpeechOutcomeResponsesInput,
  type SpeechOutcomeResponsesResult,
} from "@debate/speech-writer/src/prompts/speech-outcome-responses";
import { buildSearchUrl, EMPTY_FILTERS } from "@debate/research-evidence/src/lib/search-query";
import type { Flow } from "../types/flow";
import { getSpeechDocLink, speechDocLinkScope } from "../state/speechDocLinks";
import { fetchLinkedDocumentHtml } from "../hooks/useSpeechWordStats";
import { extractHighlightedText, getOutcomeSpeechSide, speechDocToText } from "./outcome-responses-context";

/** Three candidates with outlines, simulations and issues; the proxy caps this per plan. */
const MAX_TOKENS = 6144;

/**
 * Text of each prior speech, in order. A speech's linked editor document is
 * preferred; when it can't be loaded, or there is none, the first non-empty
 * flow speech doc among `roundFlows` (the current flow first) is used.
 */
export async function loadPriorSpeeches(
  flow: Flow,
  roundFlows: Flow[],
  speechNames: string[],
): Promise<OutcomePriorSpeech[]> {
  const scope = speechDocLinkScope(flow);
  const ordered = [flow, ...roundFlows.filter((f) => f.id !== flow.id)];

  return Promise.all(
    speechNames.map(async (speech) => {
      let html = "";
      const link = getSpeechDocLink(scope, speech);
      if (link) {
        try {
          html = (await fetchLinkedDocumentHtml(link.docId)).html;
        } catch {
          // Fall back to the flow's own speech doc below.
        }
      }
      if (!html.trim()) {
        html = ordered.map((f) => f.speechDocs?.[speech] ?? "").find((doc) => doc.trim()) ?? "";
      }
      return { speech, side: getOutcomeSpeechSide(speech), text: speechDocToText(html) };
    }),
  );
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Requests the three simulated candidates. Throws an `Error` carrying the
 * proxy's message (sign-in, plan limit, not configured) or a parse failure.
 */
export async function requestSpeechOutcomeResponses(
  input: SpeechOutcomeResponsesInput,
  endpoint = "/api/reason-ai",
): Promise<SpeechOutcomeResponsesResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: SPEECH_OUTCOME_RESPONSES_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildSpeechOutcomeResponsesUserPrompt(input) }],
      maxTokens: MAX_TOKENS,
    }),
  });

  if (!res.ok) {
    throw new Error(await readError(res, `AI outcome responses request failed (${res.status}).`));
  }

  const json = (await res.json()) as { text?: string };
  const result = parseSpeechOutcomeResponsesResponse(json.text ?? "");
  if (!result) {
    throw new Error("The AI reply couldn't be read as outcome responses. Try again.");
  }
  return result;
}

/** A card found for a candidate's search query. */
export type OutcomeCardHit = {
  id: string;
  tag: string;
  cite: string;
  /** The card's highlighted text, or its summary when it has no highlighting. */
  highlighted: string;
};

const MAX_CARD_HITS = 5;

/** Searches the card corpus (`/api/search`) for `query`, returning the top hits. */
export async function searchOutcomeCards(query: string): Promise<OutcomeCardHit[]> {
  const res = await fetch(buildSearchUrl({ searchTerm: query, sortBy: "_text_match:desc", filters: EMPTY_FILTERS }));
  const json = (await res.json().catch(() => ({}))) as {
    results?: Array<{ id?: unknown; tag?: string; cite?: string; cite_short?: string; html?: string; summary?: string }>;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error || `Card search failed (${res.status}).`);

  return (json.results ?? []).slice(0, MAX_CARD_HITS).map((card, i) => ({
    id: String(card.id ?? i),
    tag: card.tag?.trim() || "Untitled card",
    cite: card.cite_short?.trim() || card.cite?.trim() || "",
    highlighted: extractHighlightedText(card.html ?? "") || speechDocToText(card.summary ?? ""),
  }));
}
