/**
 * "Ask" and "Suggest questions" for a text being read, independent of where
 * the model runs.
 *
 * The prompts are the ones the extension's article panel has always used
 * (originally research-agent-ui's article-qa.ts and article-followups.ts
 * handlers), kept word for word so answers read the same in the extension and
 * in the docs' reading mode. Each host passes its own `generate`: the
 * extension calls the reader's saved provider key or their account, the docs
 * call the site's `/api/reason-ai`.
 */

/** Text is capped at this many characters before it is sent, unless a host asks for more. */
export const MAX_ARTICLE_CHARS = 15000;

/** One turn of an earlier conversation about the text. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** One model call: a system prompt and one user prompt. */
export interface GenerateRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  signal?: AbortSignal;
}

/** Runs one prompt and resolves to the model's text. */
export type Generate = (request: GenerateRequest) => Promise<string>;

export const QA_SYSTEM_PROMPT = `You are a helpful AI assistant that answers questions about articles.
Provide clear, concise, and accurate answers based on the article content provided.
If the answer is not in the article, say so.`;

/** The system prompt asking for `maxQuestions` follow-up questions. */
export function followupSystemPrompt(maxQuestions: number): string {
  return `You are a helpful AI that generates insightful follow-up questions about articles.
Generate ${maxQuestions} thought-provoking questions that would help readers understand the article better.
Return ONLY the questions, one per line, without numbering or bullet points.`;
}

function historyContext(chatHistory: ChatTurn[], heading: string): string {
  if (chatHistory.length === 0) return '';
  return `\n\n${heading}\n${chatHistory
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
    .join('\n')}`;
}

/** The user prompt for answering `question` about `article`. */
export function questionPrompt({
  article,
  question,
  chatHistory = [],
  maxChars = MAX_ARTICLE_CHARS,
}: {
  article: string;
  question: string;
  chatHistory?: ChatTurn[];
  maxChars?: number;
}): string {
  return `Article content:
${article.slice(0, maxChars)}
${historyContext(chatHistory, 'Previous conversation:')}

User question: ${question}

Please provide a helpful answer based on the article content above.`;
}

/** The user prompt asking for `maxQuestions` follow-ups, skipping questions already asked. */
export function followupPrompt({
  article,
  chatHistory = [],
  maxQuestions = 4,
  maxChars = MAX_ARTICLE_CHARS,
}: {
  article: string;
  chatHistory?: ChatTurn[];
  maxQuestions?: number;
  maxChars?: number;
}): string {
  const asked = chatHistory.filter((turn) => turn.role === 'user');
  return `Article content:
${article.slice(0, maxChars)}
${
  asked.length > 0
    ? `\n\nPrevious questions asked:\n${asked.map((turn) => `- ${turn.content}`).join('\n')}`
    : ''
}

Generate ${maxQuestions} follow-up questions that would help readers dive deeper into this article.`;
}

/** A model's follow-up answer as clean questions: one per line, numbering and bullets removed. */
export function parseFollowupQuestions(answer: string, maxQuestions = 4): string[] {
  return answer
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[\d\-*.)]+\s*/, '').trim())
    .filter((line) => line.length > 10)
    .slice(0, maxQuestions);
}

/**
 * Questions with any line that crams several together split apart, so each
 * is separately clickable (a model asked for one per line sometimes doesn't).
 */
export function splitQuestions(questions: string[]): string[] {
  const result: string[] = [];
  for (const question of questions) {
    if (question.includes('?') && question.split('?').length > 2) {
      question
        .split('?')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => result.push(part.endsWith('?') ? part : `${part}?`));
    } else {
      result.push(question);
    }
  }
  return result;
}

/** Answers `question` about `article` (plain text) with `generate`. */
export async function askQuestion(
  generate: Generate,
  {
    article,
    question,
    chatHistory = [],
    maxChars,
    signal,
  }: {
    article: string;
    question: string;
    chatHistory?: ChatTurn[];
    maxChars?: number;
    signal?: AbortSignal;
  },
): Promise<string> {
  if (!article) throw new Error('Article content is empty');
  if (!question.trim()) throw new Error('Ask a question first.');
  const prompt = questionPrompt({ article, question, chatHistory, maxChars });
  return generate({ system: QA_SYSTEM_PROMPT, prompt, maxTokens: 2048, signal });
}

/** Up to `maxQuestions` suggested questions about `article` (plain text), with `generate`. */
export async function suggestQuestions(
  generate: Generate,
  {
    article,
    chatHistory = [],
    maxQuestions = 4,
    maxChars,
    signal,
  }: {
    article: string;
    chatHistory?: ChatTurn[];
    maxQuestions?: number;
    maxChars?: number;
    signal?: AbortSignal;
  },
): Promise<string[]> {
  if (!article) throw new Error('Article content is empty');
  const answer = await generate({
    system: followupSystemPrompt(maxQuestions),
    prompt: followupPrompt({ article, chatHistory, maxQuestions, maxChars }),
    maxTokens: 1024,
    signal,
  });
  return parseFollowupQuestions(answer, maxQuestions);
}
