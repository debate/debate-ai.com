import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What each AI provider is actually sent, and how its answer is read back.
 *
 * `wxt/browser` is swapped for an in-memory storage only so settings and keys
 * can be chosen per test; what is asserted is the HTTP request the panel makes
 * (the part a provider rejects when it is wrong) and the text it returns.
 */
const storage = vi.hoisted(() => ({
  sync: {} as Record<string, unknown>,
  local: {} as Record<string, unknown>,
}));

vi.mock('wxt/browser', () => {
  const area = (data: Record<string, unknown>) => ({
    get: async (keys?: string | Record<string, unknown>) => {
      if (typeof keys === 'string') return keys in data ? { [keys]: data[keys] } : {};
      return { ...(keys ?? {}), ...data };
    },
    set: async (items: Record<string, unknown>) => Object.assign(data, items),
    remove: async (key: string) => void delete data[key],
  });
  return { browser: { storage: { sync: area(storage.sync), local: area(storage.local) } } };
});

import { AiNotConfiguredError, askArticleQuestion, suggestFollowups } from '@/src/ai/article-ai';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The single request the code under test made. */
function sentRequest() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  return {
    url: String(url),
    headers: new Headers(init?.headers),
    body: JSON.parse(String(init?.body)),
  };
}

beforeEach(() => {
  for (const area of [storage.sync, storage.local]) {
    for (const key of Object.keys(area)) delete area[key];
  }
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ask = () =>
  askArticleQuestion({ article: 'The article body.', question: 'What is the main claim?' });

describe('OpenAI (my key)', () => {
  beforeEach(() => {
    storage.sync.aiProvider = 'openai';
    storage.local.aiApiKeys = { openai: 'sk-test' };
  });

  it('calls chat completions with max_completion_tokens, which current models require', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { role: 'assistant', content: 'It argues X.' } }] }),
    );
    await expect(ask()).resolves.toBe('It argues X.');

    const { url, headers, body } = sentRequest();
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(headers.get('Authorization')).toBe('Bearer sk-test');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.max_completion_tokens).toBe(2048);
    expect(body).not.toHaveProperty('max_tokens');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1]).toMatchObject({ role: 'user' });
    expect(body.messages[1].content).toContain('The article body.');
    expect(body.messages[1].content).toContain('What is the main claim?');
  });

  it('uses the model named in Settings', async () => {
    storage.sync.aiModel = 'gpt-5-mini';
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    await ask();
    expect(sentRequest().body.model).toBe('gpt-5-mini');
  });

  it("surfaces OpenAI's own error message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: 'Incorrect API key provided' } }, 401),
    );
    await expect(ask()).rejects.toThrow('Incorrect API key provided');
  });

  it('reports a refusal instead of an empty answer', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: null, refusal: 'I can’t help with that.' } }] }),
    );
    await expect(ask()).rejects.toThrow('I can’t help with that.');
  });

  it('asks for a key rather than calling out without one', async () => {
    storage.local.aiApiKeys = {};
    await expect(ask()).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('OpenRouter (my key)', () => {
  it('keeps max_tokens, which OpenRouter translates per model', async () => {
    storage.sync.aiProvider = 'openrouter';
    storage.local.aiApiKeys = { openrouter: 'sk-or-test' };
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    await ask();
    const { url, body } = sentRequest();
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(body.max_tokens).toBe(2048);
  });
});

describe('Anthropic (my key)', () => {
  it('sends the Messages API shape and joins the text blocks', async () => {
    storage.sync.aiProvider = 'anthropic';
    storage.local.aiApiKeys = { anthropic: 'sk-ant-test' };
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: 'Part one. ' }, { type: 'text', text: 'Two.' }] }),
    );
    await expect(ask()).resolves.toBe('Part one. Two.');
    const { url, headers, body } = sentRequest();
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers.get('x-api-key')).toBe('sk-ant-test');
    expect(headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(typeof body.system).toBe('string');
  });
});

describe('Debate AI account', () => {
  it('sends the question to /api/reason-ai with the session token', async () => {
    storage.local.debateAccountSession = {
      token: 'session-token',
      user: { id: 'u1' },
      apiBase: 'https://debate-ai.com',
    };
    fetchMock.mockResolvedValue(jsonResponse({ text: 'From the account.' }));
    await expect(ask()).resolves.toBe('From the account.');
    const { url, headers, body } = sentRequest();
    expect(url).toBe('https://debate-ai.com/api/reason-ai');
    expect(headers.get('Authorization')).toBe('Bearer session-token');
    expect(typeof body.system).toBe('string');
    expect(body.messages).toHaveLength(1);
  });

  it('asks the reader to sign in when there is no session', async () => {
    await expect(ask()).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('suggestFollowups', () => {
  it('turns the answer into clean questions', async () => {
    storage.sync.aiProvider = 'openai';
    storage.local.aiApiKeys = { openai: 'sk-test' };
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: '1. What evidence supports the claim?\n- Who funded the study here?\nshort',
            },
          },
        ],
      }),
    );
    await expect(suggestFollowups({ article: 'Body', maxQuestions: 4 })).resolves.toEqual([
      'What evidence supports the claim?',
      'Who funded the study here?',
    ]);
  });
});
