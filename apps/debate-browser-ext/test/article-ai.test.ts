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

import {
  AiNotConfiguredError,
  askArticleQuestion,
  describeActiveProvider,
  suggestFollowups,
} from '@/src/ai/article-ai';

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

describe('OpenRouter key from the app settings', () => {
  beforeEach(() => {
    storage.local.appOwnAiKey = 'sk-or-v1-test';
  });

  it('calls chat completions with max_tokens, which OpenRouter translates per model', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    await expect(ask()).resolves.toBe('ok');
    const { url, headers, body } = sentRequest();
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(headers.get('Authorization')).toBe('Bearer sk-or-v1-test');
    expect(body.max_tokens).toBe(2048);
    expect(body.messages[0].role).toBe('system');
  });

  it("surfaces OpenRouter's own error message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Key limit exceeded' } }, 403));
    await expect(ask()).rejects.toThrow('Key limit exceeded');
  });

  it('reports a refusal instead of an empty answer', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: null, refusal: 'No.' } }] }));
    await expect(ask()).rejects.toThrow('No.');
  });
});

describe('Anthropic key from the app settings', () => {
  it('sends the Messages API shape and joins the text blocks', async () => {
    storage.local.appOwnAiKey = 'sk-ant-test';
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

  it('ignores a stored value that is not a key', async () => {
    storage.local.appOwnAiKey = 'not-a-key';
    await expect(ask()).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
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
    storage.local.appOwnAiKey = 'sk-or-v1-test';
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

const textResponse = (body: string, status: number) => new Response(body, { status });
const signIn = () => {
  storage.local.debateAccountSession = { token: 'session-token', user: { id: 'u1' }, apiBase: 'https://debate-ai.com' };
};

describe('provider error messages', () => {
  beforeEach(() => {
    storage.local.appOwnAiKey = 'sk-ant-test';
  });

  it('says the key was rejected when the provider returns 401 with no explanation', async () => {
    fetchMock.mockResolvedValue(textResponse('', 401));
    await expect(ask()).rejects.toThrow('Anthropic rejected the API key (401).');
  });

  it('falls back to the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(textResponse('<html>Bad gateway</html>', 502));
    await expect(ask()).rejects.toThrow('Anthropic request failed (502).');
  });

  it.each([
    ['message', { message: 'Overloaded' }, 'Overloaded'],
    ['details', { details: 'Model unavailable' }, 'Model unavailable'],
    ['a string error', { error: 'quota' }, 'quota'],
    ['an error object without a message', { error: { code: 42 } }, '{"code":42}'],
  ])('reads the detail from %s', async (_label, body, expected) => {
    fetchMock.mockResolvedValue(jsonResponse(body, 500));
    await expect(ask()).rejects.toThrow(expected);
  });

  it('answers with nothing when Anthropic returns no text blocks', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: 'tool_use' }] }));
    await expect(ask()).resolves.toBe('');
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(ask()).resolves.toBe('');
  });

  it('answers with nothing when OpenRouter returns no choices', async () => {
    storage.local.appOwnAiKey = 'sk-or-v1-test';
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(ask()).resolves.toBe('');
  });
});

describe('Debate AI account responses', () => {
  beforeEach(signIn);

  it.each([
    ['flattened text', { text: 'flat' }, 'flat'],
    ['a content string', { content: 'plain' }, 'plain'],
    ['raw content blocks', { content: [{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }] }, 'ab'],
    ['nothing usable', { other: true }, ''],
  ])('reads %s', async (_label, body, expected) => {
    fetchMock.mockResolvedValue(jsonResponse(body));
    await expect(ask()).resolves.toBe(expected);
  });

  it('tells the reader to sign in again when the session has expired', async () => {
    fetchMock.mockResolvedValue(textResponse('', 401));
    const error = await ask().catch((e) => e);
    expect(error).toBeInstanceOf(AiNotConfiguredError);
    expect(error.message).toMatch(/session has expired/);
  });

  it('reports a server failure with its own message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Out of credits' }, 402));
    await expect(ask()).rejects.toThrow('Out of credits');
    fetchMock.mockResolvedValue(textResponse('', 500));
    await expect(ask()).rejects.toThrow('Debate AI request failed (500).');
  });

  it('lets a network failure through unchanged', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(ask()).rejects.toThrow('Failed to fetch');
  });
});

describe('describeActiveProvider', () => {
  it('reports the account as not ready until the reader signs in', async () => {
    expect(await describeActiveProvider()).toEqual({ id: 'account', label: 'My Debate AI account', ready: false });
    signIn();
    expect(await describeActiveProvider()).toMatchObject({ id: 'account', ready: true });
  });

  it('reports a saved key as ready without needing an account', async () => {
    storage.local.appOwnAiKey = 'sk-or-v1-test';
    expect(await describeActiveProvider()).toMatchObject({ id: 'openrouter', ready: true });

    storage.local.appOwnAiKey = 'sk-ant-test';
    expect(await describeActiveProvider()).toMatchObject({ id: 'anthropic', ready: true });
  });
});
