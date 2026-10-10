/**
 * @fileoverview The AI calls behind the card hover buttons
 * (`card-hover-actions.ts`): a one-paragraph summary of a card, and the
 * flaws an opponent would attack.
 *
 * Two routes, picked per call:
 *
 * - **The user's own key.** When CardMirror's own AI settings are switched on
 *   with a key (`aiConfigured()`), the call goes browser-direct through the
 *   engine's `callLlm`, exactly like every other CardMirror AI tool, and is
 *   billed on that key.
 * - **The site.** Otherwise it goes to debate-ai.com's
 *   `/api/card-ai-analysis` — the same endpoint as the evidence search's "AI
 *   Analysis" sidebar, which caches one answer per (card text, prompt) and
 *   meters new generations against the plan's `cardAiAnalysesPerDay`. Find
 *   flaws sends no prompt, so the server uses its default
 *   find-flaws-and-extensions prompt (anyone may generate that one, and every
 *   later reader gets the saved answer). The summary is a custom prompt, which
 *   the server only generates for a signed-in user; a signed-out user gets its
 *   "Sign in" message back as the error.
 *
 * `./ai/llm.js` is imported lazily: this file is loaded with the engine, and
 * the LLM client pulls in `settings.ts`, which the engine has already loaded
 * by the time a button can be clicked.
 *
 * @module editor/card-ai-client
 */

export type CardAiAction = 'summary' | 'flaws';

/** System prompt for the summary button. Plain prose out — it is read, not parsed. */
export const SUMMARIZE_CARD_PROMPT = `You are a debate coach summarizing one piece of evidence (a "card") for a debater who is about to read it in a round.

Write 2-4 sentences: the card's main claim, the key warrant (why it is true), and the impact or implication it supports. Mention who the author is and when it was written if the cite says. Do not add claims the card does not make. Plain prose, no headings.`;

/** System prompt for find flaws when it runs on the user's own key. On the
 *  site route the server's default prompt is used instead (and cached). */
export const FIND_CARD_FLAWS_PROMPT = `You are a debate coach reviewing one piece of evidence (a "card") for the opponent who has to answer it.

List the problems an opponent would attack: outdated or unqualified evidence, logical fallacies, unwarranted leaps, missing internal links, the tag overclaiming what the card says, or missing parts (claim, warrant, evidence). For each flaw, give a one-line response the opponent could read. Use Markdown bullet points. Be concise and specific to this card.`;

/** Upper bound on card text sent to the model; matches the server's cap. */
export const MAX_CARD_AI_CHARS = 20_000;

const MAX_TOKENS = 1500;

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: unknown };
    return typeof payload.error === 'string' && payload.error ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

/** Asks the site's `/api/card-ai-analysis` (see the module doc). */
export async function requestSiteCardAi(
  action: CardAiAction,
  content: string,
  tag: string,
  endpoint = '/api/card-ai-analysis',
): Promise<string> {
  const body: Record<string, string> = { content: content.slice(0, MAX_CARD_AI_CHARS), tag };
  if (action === 'summary') body['prompt'] = SUMMARIZE_CARD_PROMPT;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, `AI request failed (${res.status}).`));
  const payload = (await res.json()) as { result?: unknown };
  if (typeof payload.result !== 'string' || !payload.result.trim()) {
    throw new Error('The AI returned an empty answer.');
  }
  return payload.result.trim();
}

/** Runs `action` on a card's text, on the user's own key when CardMirror has
 *  one, else through the site (see the module doc). */
export async function runCardAi(action: CardAiAction, content: string, tag: string): Promise<string> {
  const llm = await import('./ai/llm.js');
  if (!llm.aiConfigured()) return requestSiteCardAi(action, content, tag);
  const reply = await llm.callLlm({
    apiKey: llm.activeApiKey(),
    model: llm.resolveAiModel(),
    maxTokens: MAX_TOKENS,
    system: action === 'summary' ? SUMMARIZE_CARD_PROMPT : FIND_CARD_FLAWS_PROMPT,
    messages: [{ role: 'user', content: `Evidence card:\n\n${content.slice(0, MAX_CARD_AI_CHARS)}` }],
  });
  const text = reply.text.trim();
  if (!text) throw new Error('The AI returned an empty answer.');
  return text;
}
