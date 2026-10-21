/**
 * "Ask" and "Suggest" for the open article.
 *
 * The prompts are the ones the panel's original server handlers use
 * (qwksearch-research-agent/packages/research-agent-ui/src/api/handlers/article-qa.ts
 * and article-followups.ts), kept word for word so answers read the same here
 * as they do in the app this was ported from. What changed is where they run:
 * there a server loaded a model from its own registry, here the request goes
 * straight to the provider of the key the reader saved in the Debate AI app's
 * settings, or, without one, to their debate-ai.com account — see ./providers.
 */
import { NotSignedInError, authorizedFetch, isSignedIn } from '@/src/auth/session';

import { getAppAiKey } from './app-key';
import { PROVIDER_ORIGINS, getProvider, type AiProviderId } from './providers';

/** Article text is capped before it is sent; the panel's original cap. */
export const MAX_ARTICLE_CHARS = 15000;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface GenerateRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  signal?: AbortSignal;
}

/** Raised when a provider is selected but cannot be used yet. */
export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiNotConfiguredError';
  }
}

/** The error text a provider put in its response body, when it put one there. */
async function providerError(response: Response, label: string): Promise<Error> {
  let detail = '';
  try {
    const payload = (await response.json()) as Record<string, any>;
    detail =
      payload?.error?.message ??
      payload?.error ??
      payload?.message ??
      payload?.details ??
      '';
  } catch {
    // Not JSON — the status is all there is to report.
  }
  if (typeof detail !== 'string') detail = JSON.stringify(detail);
  if (response.status === 401 || response.status === 403) {
    return new Error(detail || `${label} rejected the API key (${response.status}).`);
  }
  return new Error(detail || `${label} request failed (${response.status}).`);
}

/** The reader's account: the server holds the model key, we hold the session. */
async function generateWithAccount(request: GenerateRequest): Promise<string> {
  let response: Response;
  try {
    response = await authorizedFetch('/api/reason-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
        maxTokens: request.maxTokens,
      }),
      signal: request.signal,
    });
  } catch (error) {
    if (error instanceof NotSignedInError) {
      throw new AiNotConfiguredError(
        'Sign in to your Debate AI account, or add your OpenRouter or Anthropic key in Debate AI Settings → General.',
      );
    }
    throw error;
  }

  if (response.status === 401) {
    throw new AiNotConfiguredError(
      'Your Debate AI session has expired — sign in again from the panel.',
    );
  }
  if (!response.ok) throw await providerError(response, 'Debate AI');

  const payload = (await response.json()) as { content?: unknown; text?: unknown };
  // /api/reason-ai is a passthrough to the Anthropic Messages API, so the
  // answer arrives either already flattened or as the raw content blocks.
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.content === 'string') return payload.content;
  if (Array.isArray(payload.content)) {
    return payload.content
      .map((block: any) => (block?.type === 'text' ? String(block.text ?? '') : ''))
      .join('');
  }
  return '';
}

/** OpenRouter's chat-completions API, which takes `max_tokens` and translates it per model. */
async function generateWithOpenRouter(
  request: GenerateRequest,
  { apiKey, model }: { apiKey: string; model: string },
): Promise<string> {
  const response = await fetch(`${PROVIDER_ORIGINS.openrouter}/api/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter attributes usage to these; they are the extension, not the
      // page being read, so nothing about the reader's browsing leaks.
      'HTTP-Referer': 'https://debate-ai.com',
      'X-Title': 'Debate AI extension',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.prompt },
      ],
    }),
    signal: request.signal,
  });
  if (!response.ok) throw await providerError(response, 'OpenRouter');
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
  };
  const message = payload.choices?.[0]?.message;
  if (message?.refusal) throw new Error(message.refusal);
  return message?.content ?? '';
}

async function generateWithAnthropic(
  request: GenerateRequest,
  { apiKey, model }: { apiKey: string; model: string },
): Promise<string> {
  const response = await fetch(`${PROVIDER_ORIGINS.anthropic}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Anthropic requires callers to opt in before it will answer a request
      // made from a browser context, which an extension page is.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
    }),
    signal: request.signal,
  });
  if (!response.ok) throw await providerError(response, 'Anthropic');
  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return (payload.content ?? [])
    .map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
    .join('');
}

/** Runs one prompt on the app's saved key, or through the reader's account without one. */
async function generate(request: GenerateRequest): Promise<string> {
  const own = await getAppAiKey();
  if (!own) return generateWithAccount(request);
  const model = getProvider(own.provider).defaultModel;
  return own.provider === 'openrouter'
    ? generateWithOpenRouter(request, { apiKey: own.key, model })
    : generateWithAnthropic(request, { apiKey: own.key, model });
}

/** Which provider the next request will use, for the panel's status line. */
export async function describeActiveProvider(): Promise<{
  id: AiProviderId;
  label: string;
  ready: boolean;
}> {
  const own = await getAppAiKey();
  const provider = getProvider(own?.provider ?? 'account');
  return {
    id: provider.id,
    label: provider.label,
    ready: own ? true : await isSignedIn(),
  };
}

const QA_SYSTEM_PROMPT = `You are a helpful AI assistant that answers questions about articles.
Provide clear, concise, and accurate answers based on the article content provided.
If the answer is not in the article, say so.`;

function historyContext(chatHistory: ChatTurn[], heading: string): string {
  if (chatHistory.length === 0) return '';
  return `\n\n${heading}\n${chatHistory
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
    .join('\n')}`;
}

/** Answers `question` about `article`, the article body as plain text. */
export async function askArticleQuestion({
  article,
  question,
  chatHistory = [],
  signal,
}: {
  article: string;
  question: string;
  chatHistory?: ChatTurn[];
  signal?: AbortSignal;
}): Promise<string> {
  if (!article) throw new Error('Article content is empty');
  if (!question.trim()) throw new Error('Ask a question first.');

  const prompt = `Article content:
${article.slice(0, MAX_ARTICLE_CHARS)}
${historyContext(chatHistory, 'Previous conversation:')}

User question: ${question}

Please provide a helpful answer based on the article content above.`;

  return generate({ system: QA_SYSTEM_PROMPT, prompt, maxTokens: 2048, signal });
}

/** Generates up to `maxQuestions` follow-up questions about `article`. */
export async function suggestFollowups({
  article,
  chatHistory = [],
  maxQuestions = 4,
  signal,
}: {
  article: string;
  chatHistory?: ChatTurn[];
  maxQuestions?: number;
  signal?: AbortSignal;
}): Promise<string[]> {
  if (!article) throw new Error('Article content is empty');

  const system = `You are a helpful AI that generates insightful follow-up questions about articles.
Generate ${maxQuestions} thought-provoking questions that would help readers understand the article better.
Return ONLY the questions, one per line, without numbering or bullet points.`;

  const asked = chatHistory.filter((turn) => turn.role === 'user');
  const prompt = `Article content:
${article.slice(0, MAX_ARTICLE_CHARS)}
${
  asked.length > 0
    ? `\n\nPrevious questions asked:\n${asked.map((turn) => `- ${turn.content}`).join('\n')}`
    : ''
}

Generate ${maxQuestions} follow-up questions that would help readers dive deeper into this article.`;

  const answer = await generate({ system, prompt, maxTokens: 1024, signal });

  return answer
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[\d\-*.)]+\s*/, '').trim())
    .filter((line) => line.length > 10)
    .slice(0, maxQuestions);
}
