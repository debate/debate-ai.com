/**
 * AI flashcard generation — "Convert to Flashcard" on an AI thread.
 *
 * Given the passage the user highlighted (plus its card context) and the
 * Q&A conversation they had about it, ask the model to author ONE
 * spaced-repetition flashcard — a Q&A pair or a single cloze deletion.
 *
 * The system prompt below is grounded in the mnemonic-medium research
 * corpus (`reference-docs/mnemonic-medium/`). Two ideas drive it:
 *
 *  1. **Highlights → interests.** The user's highlight, their questions,
 *     and the card's tag are the strongest available signal of what
 *     *they* find worth remembering — stronger than what the source
 *     author emphasizes. The prompt leans on the conversation to pick the
 *     angle to reinforce. (Matuschak, "From Highlights to Interests";
 *     "In prompt generation LLMs often need extra hints about what angle
 *     to reinforce.")
 *  2. **Screen the known pathologies.** AI-generated prompts fail in
 *     recognizable ways — shallow, narrow, wordy, ambiguous-lacks-context,
 *     ambiguous-solicits-multiple-responses (the `probes/` test suite) —
 *     so the prompt names them as explicit constraints, plus the positive
 *     attributes of good prompts (atomic, self-contained, unambiguous,
 *     concise; Q&A over cloze by default).
 */

import { callLlm, LlmError } from './llm.js';
import type { ExplainContext } from './explain-context.js';
import type { NewCardDef } from '../learn-create-ui.js';

/** A turn in the AI thread, flattened for the generation prompt. */
export interface FlashcardTurn {
  role: 'user' | 'assistant';
  text: string;
}

export const FLASHCARD_SYSTEM_PROMPT =
  "You are a flashcard author embedded in a competitive-debate research " +
  "editor. The user highlighted a passage in a debate card and then had a " +
  "short Q&A conversation with an AI about it. Write exactly ONE spaced-" +
  "repetition flashcard that reinforces what THIS user found worth " +
  "understanding — it will be reviewed in isolation, months later, with no " +
  "access to the source.\n\n" +
  "WHAT TO TARGET (most important): the user's highlight, their questions, " +
  "and the card's tag are strong signals of what they personally care " +
  "about — stronger than whatever the source author emphasizes. Read their " +
  "questions to infer the ANGLE they're after (a cause, a contrast, a " +
  "mechanism, a definition, an implication, a surprising magnitude) and " +
  "build the card around THAT. Don't test an incidental detail, the inner " +
  "workings of a metaphor, or example trivia just because it's present. If " +
  "they asked 'why', test the reason; if they asked how X differs from Y, " +
  "test the contrast.\n\n" +
  "FORMAT — default to Q&A: prefer a question/answer pair. Use a cloze " +
  "deletion ONLY when the passage's exact, evocative wording is itself the " +
  "thing worth remembering (uncommon); then write one sentence with the " +
  "single deletion wrapped in {{double braces}} and leave the answer " +
  "empty. Cloze tends to reward shallow pattern-matching, so when in " +
  "doubt, write Q&A.\n\n" +
  "MAKE A PROMPT THAT STILL WORKS MONTHS LATER:\n" +
  "- ATOMIC — one thing only (the most important rule): the card must " +
  "test a SINGLE fact or idea with a single thing to recall. Review here " +
  "is graded as a binary Remembered/Forgot, so a compound card you only " +
  "half-remember can't be scored and quietly corrupts its schedule. Do " +
  "NOT join two asks with 'and'/'or', do NOT ask for a list or 'the " +
  "three X', and do NOT pair a fact with its reason/significance in one " +
  "card. If the passage holds several ideas worth keeping, pick the ONE " +
  "the user's angle points to — richness goes in SEPARATE cards (they " +
  "can convert again), never in one fat card.\n" +
  "- Self-contained: answerable without the source. Name the actor / " +
  "framework / study / author the question depends on — never lean on " +
  "'the passage', 'the author', or 'this approach' without naming it. If " +
  "the question makes you ask 'which one?' or 'according to whom?', add " +
  "the missing anchor.\n" +
  "- Unambiguous: the question must admit ONE specific answer. Avoid " +
  "'a/an' phrasings, 'primary/main/key' rankings the source doesn't " +
  "establish, and open 'why does this matter' framings that invite many " +
  "valid answers.\n" +
  "- Deep, not shallow: test the concept, causal link, or distinction — " +
  "not a count, name, date, or label unless that exact fact is the " +
  "insight. No yes/no questions.\n" +
  "- Concise: say it in as few words as possible; cut formal filler " +
  "('the fundamental distinction that delineates' -> 'the distinction " +
  "between'). Keep necessary technical terms — precision isn't wordiness.\n" +
  "Keep the QUESTION tight (it's what cues recall); the answer is the one " +
  "thing being recalled — at most a brief clarifying clause, never extra " +
  "facts piled on for completeness.\n\n" +
  "OUTPUT: return ONLY a JSON object — no prose, no code fence, no " +
  "explanation — in one of these shapes:\n" +
  '{"type": "qa", "front": "<question>", "back": "<answer>"}\n' +
  '{"type": "cloze", "front": "<sentence with a {{deletion}}>", "back": ""}';

/** Build the single user message: the highlight + its card context +
 *  the conversation, with the user's questions called out as the angle
 *  signal and the AI replies marked as background only. */
export function formatFlashcardPrompt(ctx: ExplainContext, turns: FlashcardTurn[]): string {
  const parts: string[] = [];
  parts.push('Highlighted passage (the user selected this):');
  parts.push('"""');
  parts.push(ctx.selection);
  parts.push('"""');

  if (ctx.paragraphs.length > 0) {
    parts.push('');
    parts.push('Surrounding source text:');
    for (const p of ctx.paragraphs) {
      parts.push('"""');
      parts.push(p);
      parts.push('"""');
    }
  }

  const ctxLines: string[] = [];
  if (ctx.tag) {
    ctxLines.push(`Tag (the heading this card sits under — a signal of the user's angle): ${ctx.tag}`);
  }
  if (ctx.analytic) ctxLines.push(`Analytic: ${ctx.analytic}`);
  for (const u of ctx.undertags) ctxLines.push(`Undertag: ${u}`);
  for (const c of ctx.cites) ctxLines.push(`Cite: ${c}`);
  if (ctxLines.length > 0) {
    parts.push('');
    parts.push('Card context:');
    parts.push(...ctxLines);
  }

  const questions = turns.filter((t) => t.role === 'user' && t.text.trim()).map((t) => t.text.trim());
  const answers = turns.filter((t) => t.role === 'assistant' && t.text.trim()).map((t) => t.text.trim());
  if (questions.length > 0) {
    parts.push('');
    parts.push("The user's questions (their angle — weight these heavily):");
    for (const q of questions) parts.push(`- ${q}`);
  }
  if (answers.length > 0) {
    parts.push('');
    parts.push("The AI's replies (background only — test the passage, not these words):");
    for (const a of answers) parts.push(`- ${a}`);
  }

  parts.push('');
  parts.push('Write one flashcard targeting the user\'s angle. Return JSON only.');
  return parts.join('\n');
}

/** Parse a card out of the model's reply. Tolerates a stray code fence
 *  or leading/trailing prose by extracting the outermost `{...}`. */
export function parseFlashcardReply(text: string): NewCardDef | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const type = o['type'] === 'cloze' ? 'cloze' : o['type'] === 'qa' ? 'qa' : null;
  if (!type) return null;
  const front = typeof o['front'] === 'string' ? o['front'].trim() : '';
  const back = typeof o['back'] === 'string' ? o['back'].trim() : '';
  if (!front) return null;
  if (type === 'qa' && !back) return null;
  return { type, front, back };
}

/** Request one flashcard for an AI thread. Throws `LlmError` on a
 *  failed call or an unparseable reply. */
export async function requestFlashcard(
  apiKey: string,
  ctx: ExplainContext,
  turns: FlashcardTurn[],
): Promise<NewCardDef> {
  const reply = await callLlm({
    apiKey,
    system: FLASHCARD_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: formatFlashcardPrompt(ctx, turns) }],
  });
  const card = parseFlashcardReply(reply.text);
  if (!card) {
    throw new LlmError("Couldn't read a flashcard from the AI's reply.", null, 'parse');
  }
  return card;
}
