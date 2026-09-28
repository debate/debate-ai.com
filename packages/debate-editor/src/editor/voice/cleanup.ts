/**
 * Dictation cleanup pass (spec §6.4): a literal transcript — fillers,
 * mid-sentence self-corrections, no punctuation — through a small
 * language-model call on the user's own AI key, with the card's
 * context, before the text lands. Off in Lite, off without a key, off
 * by setting; a timeout or any error lands the raw transcript.
 */
import { activeApiKey, aiConfigured, callLlm, resolveAiModel } from '../ai/llm.js';
import { isLiteBuild } from '../lite.js';
import { settings } from '../settings.js';

export interface CleanupContext {
  /** Text just before the insertion point. */
  before: string;
  /** Names the speaker is likely to use (cite fields, authors in the doc). */
  names: string[];
}

export const CLEANUP_TIMEOUT_MS = 2500;

const SYSTEM = [
  'You clean up a dictated fragment for a competitive-debate document. Return ONLY the cleaned text.',
  'Rules: keep every idea and every word the speaker meant; never paraphrase, summarize, or add content.',
  'Resolve mid-sentence self-corrections ("actually make that", "no,", "I mean") by keeping the final version.',
  'Drop fillers (um, uh, like, you know). Add sentence punctuation and capitalization; keep spoken punctuation words such as "period", "comma", "dash", "open quote", "close quote" AS WORDS — the editor resolves them.',
  'Keep debate shorthand as spoken: 1AC, 2NC, aff, neg, DA, CP, K, perm, uniqueness, link, impact, solvency.',
  'Spell names to match the provided names when the sound matches. Output plain text, one fragment, no quotes around it.',
].join(' ');

export function cleanupEnabled(): boolean {
  if (isLiteBuild()) return false;
  if (!settings.get('voiceCleanupEnabled')) return false;
  return aiConfigured();
}

/** The cleaned transcript, or `raw` when cleanup is off or fails. */
export async function cleanupTranscript(raw: string, ctx: CleanupContext): Promise<string> {
  const text = raw.trim();
  if (!text || !cleanupEnabled()) return text;
  const user = [
    ctx.names.length ? `Names in play: ${ctx.names.slice(0, 40).join(', ')}` : '',
    ctx.before.trim() ? `Text just before the cursor: ${JSON.stringify(ctx.before.slice(-120))}` : '',
    `Dictated: ${text}`,
  ]
    .filter(Boolean)
    .join('\n');
  try {
    const reply = await Promise.race([
      callLlm({ apiKey: activeApiKey(), model: resolveAiModel(), system: SYSTEM, messages: [{ role: 'user', content: user }], maxTokens: 400, temperature: 0 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CLEANUP_TIMEOUT_MS)),
    ]);
    if (!reply) return text;
    const cleaned = reply.text.trim().replace(/^["“]|["”]$/g, '');
    // A wildly different length means the model did something other than
    // clean — keep what was said.
    if (!cleaned || cleaned.length > text.length * 2 + 20) return text;
    return cleaned;
  } catch {
    return text;
  }
}
