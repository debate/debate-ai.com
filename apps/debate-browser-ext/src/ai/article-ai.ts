/**
 * "Ask" and "Suggest" for the open article.
 *
 * The prompts are the ones the panel's original server handlers use
 * (qwksearch-research-agent/packages/research-agent-ui/src/api/handlers/article-qa.ts
 * and article-followups.ts), kept word for word in `@debate-ai/reading-mode`,
 * which the docs' reading mode shares. What changed is where they run:
 * there a server loaded a model from its own registry, here the request goes
 * straight to the provider of the key the reader saved in the Debate AI app's
 * settings, or, without one, to their debate-ai.com account — see ./providers.
 */
import { NotSignedInError, authorizedFetch, isSignedIn } from '@/src/auth/session';

import {
  askQuestion,
  suggestQuestions,
  type ChatTurn,
  type GenerateRequest,
} from '@debate-ai/reading-mode/questions';

import { getAppAiKey } from './app-key';
import { PROVIDER_ORIGINS, getProvider, type AiProviderId } from './providers';

export { MAX_ARTICLE_CHARS, type ChatTurn } from '@debate-ai/reading-mode/questions';

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

/** Answers `question` about `article`, the article body as plain text. */
export function askArticleQuestion(options: {
  article: string;
  question: string;
  chatHistory?: ChatTurn[];
  signal?: AbortSignal;
}): Promise<string> {
  return askQuestion(generate, options);
}

/** Generates up to `maxQuestions` follow-up questions about `article`. */
export function suggestFollowups(options: {
  article: string;
  chatHistory?: ChatTurn[];
  maxQuestions?: number;
  signal?: AbortSignal;
}): Promise<string[]> {
  return suggestQuestions(generate, options);
}
