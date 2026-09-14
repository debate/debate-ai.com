/**
 * @fileoverview Covers the three provider clients the vs-bot backend can be
 * wired to. Each is a plain `fetch` call, so the request shape and the reply
 * unwrapping are what these tests pin — a provider quietly returning nothing is
 * the failure mode that reaches a debater as an empty bot turn.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  cleanModelOutput,
  createAnthropicModelClient,
  createGeminiModelClient,
  createOpenAiModelClient,
  createStaticModelClient,
} from "../src/backend/model-client";

let fetchMock: ReturnType<typeof vi.fn>;

const ok = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;
const failure = (status: number, text = "boom") =>
  ({ ok: false, status, text: async () => text }) as unknown as Response;

/** The parsed JSON body of the most recent fetch call. */
const sentBody = () =>
  JSON.parse((fetchMock.mock.lastCall?.[1] as RequestInit).body as string);
const sentHeaders = () =>
  (fetchMock.mock.lastCall?.[1] as RequestInit).headers as Record<string, string>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cleanModelOutput", () => {
  it("leaves plain text alone", () => {
    expect(cleanModelOutput("hello")).toBe("hello");
  });

  it("trims surrounding whitespace", () => {
    expect(cleanModelOutput("  hello  ")).toBe("hello");
  });

  it.each(["```json", "```JSON", "```"])(
    "unwraps a %s fence around JSON",
    (fence) => {
      expect(cleanModelOutput(`${fence}\n{"a":1}\n\`\`\``)).toBe('{"a":1}');
    },
  );

  it("unwraps an unterminated fence", () => {
    expect(cleanModelOutput('```json\n{"a":1}')).toBe('{"a":1}');
  });

  it("strips only the first fence marker", () => {
    expect(cleanModelOutput("``````")).toBe("");
  });

  it("returns an empty string for empty input", () => {
    expect(cleanModelOutput("")).toBe("");
  });
});

describe("createAnthropicModelClient", () => {
  it("posts the prompt as a single user message", async () => {
    fetchMock.mockResolvedValue(ok({ content: [{ type: "text", text: "hi" }] }));
    const client = createAnthropicModelClient({ apiKey: "k" });

    await client.generateText("debate me");

    expect(sentBody()).toMatchObject({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: "debate me" }],
    });
  });

  it("authenticates with the api key and a pinned api version", async () => {
    fetchMock.mockResolvedValue(ok({ content: [] }));
    await createAnthropicModelClient({ apiKey: "secret" }).generateText("x");

    expect(sentHeaders()).toMatchObject({
      "x-api-key": "secret",
      "anthropic-version": "2023-06-01",
    });
  });

  it("honors a model and token override", async () => {
    fetchMock.mockResolvedValue(ok({ content: [] }));
    await createAnthropicModelClient({
      apiKey: "k",
      model: "claude-opus-4-6",
      maxTokens: 100,
    }).generateText("x");

    expect(sentBody()).toMatchObject({
      model: "claude-opus-4-6",
      max_tokens: 100,
    });
  });

  it("posts to a base url override", async () => {
    fetchMock.mockResolvedValue(ok({ content: [] }));
    await createAnthropicModelClient({
      apiKey: "k",
      baseUrl: "https://proxy.test/v1/messages",
    }).generateText("x");

    expect(fetchMock.mock.lastCall?.[0]).toBe("https://proxy.test/v1/messages");
  });

  it("joins the text blocks and drops the others", async () => {
    fetchMock.mockResolvedValue(
      ok({
        content: [
          { type: "text", text: "one " },
          { type: "thinking", text: "ignored" },
          { type: "text", text: "two" },
        ],
      }),
    );
    expect(
      await createAnthropicModelClient({ apiKey: "k" }).generateText("x"),
    ).toBe("one two");
  });

  it("unwraps a fenced reply", async () => {
    fetchMock.mockResolvedValue(
      ok({ content: [{ type: "text", text: '```json\n{"a":1}\n```' }] }),
    );
    expect(
      await createAnthropicModelClient({ apiKey: "k" }).generateText("x"),
    ).toBe('{"a":1}');
  });

  it("returns an empty string when the reply has no content", async () => {
    fetchMock.mockResolvedValue(ok({}));
    expect(
      await createAnthropicModelClient({ apiKey: "k" }).generateText("x"),
    ).toBe("");
  });

  it("reports the status and body of a failed call", async () => {
    fetchMock.mockResolvedValue(failure(429, "rate limited"));
    await expect(
      createAnthropicModelClient({ apiKey: "k" }).generateText("x"),
    ).rejects.toThrow("Anthropic API error 429: rate limited");
  });

  it("passes an abort signal through", async () => {
    fetchMock.mockResolvedValue(ok({ content: [] }));
    const controller = new AbortController();
    await createAnthropicModelClient({ apiKey: "k" }).generateText(
      "x",
      controller.signal,
    );
    expect((fetchMock.mock.lastCall?.[1] as RequestInit).signal).toBe(
      controller.signal,
    );
  });
});

describe("createGeminiModelClient", () => {
  it("addresses the default model's generateContent endpoint", async () => {
    fetchMock.mockResolvedValue(ok({ candidates: [] }));
    await createGeminiModelClient({ apiKey: "k" }).generateText("x");

    expect(fetchMock.mock.lastCall?.[0]).toContain(
      `${DEFAULT_GEMINI_MODEL}:generateContent`,
    );
  });

  it("disables every safety filter, as a debate bot argues hard stances", async () => {
    fetchMock.mockResolvedValue(ok({ candidates: [] }));
    await createGeminiModelClient({ apiKey: "k" }).generateText("x");

    const thresholds = sentBody().safetySettings as {
      category: string;
      threshold: string;
    }[];
    expect(thresholds).toHaveLength(4);
    expect(thresholds.every((s) => s.threshold === "BLOCK_NONE")).toBe(true);
  });

  it("authenticates with the google api key header", async () => {
    fetchMock.mockResolvedValue(ok({ candidates: [] }));
    await createGeminiModelClient({ apiKey: "secret" }).generateText("x");
    expect(sentHeaders()).toMatchObject({ "x-goog-api-key": "secret" });
  });

  it("joins the parts of the first candidate", async () => {
    fetchMock.mockResolvedValue(
      ok({
        candidates: [{ content: { parts: [{ text: "a" }, { text: "b" }] } }],
      }),
    );
    expect(await createGeminiModelClient({ apiKey: "k" }).generateText("x")).toBe(
      "ab",
    );
  });

  it("returns an empty string when there are no candidates", async () => {
    fetchMock.mockResolvedValue(ok({}));
    expect(await createGeminiModelClient({ apiKey: "k" }).generateText("x")).toBe(
      "",
    );
  });

  it("reports the status and body of a failed call", async () => {
    fetchMock.mockResolvedValue(failure(500, "server error"));
    await expect(
      createGeminiModelClient({ apiKey: "k" }).generateText("x"),
    ).rejects.toThrow("Gemini API error 500: server error");
  });
});

describe("createOpenAiModelClient", () => {
  it("posts the prompt as a lone user message by default", async () => {
    fetchMock.mockResolvedValue(ok({ choices: [] }));
    await createOpenAiModelClient({ apiKey: "k" }).generateText("debate me");

    expect(sentBody()).toMatchObject({
      model: DEFAULT_OPENAI_MODEL,
      messages: [{ role: "user", content: "debate me" }],
    });
  });

  it("prepends a system message when one is configured", async () => {
    fetchMock.mockResolvedValue(ok({ choices: [] }));
    await createOpenAiModelClient({
      apiKey: "k",
      systemPrompt: "be terse",
    }).generateText("debate me");

    expect(sentBody().messages).toEqual([
      { role: "system", content: "be terse" },
      { role: "user", content: "debate me" },
    ]);
  });

  it("authenticates with a bearer token", async () => {
    fetchMock.mockResolvedValue(ok({ choices: [] }));
    await createOpenAiModelClient({ apiKey: "secret" }).generateText("x");
    expect(sentHeaders()).toMatchObject({ authorization: "Bearer secret" });
  });

  it("reads the first choice's message content", async () => {
    fetchMock.mockResolvedValue(
      ok({ choices: [{ message: { content: "  reply  " } }] }),
    );
    expect(await createOpenAiModelClient({ apiKey: "k" }).generateText("x")).toBe(
      "reply",
    );
  });

  it("returns an empty string when there are no choices", async () => {
    fetchMock.mockResolvedValue(ok({}));
    expect(await createOpenAiModelClient({ apiKey: "k" }).generateText("x")).toBe(
      "",
    );
  });

  it("reports the status and body of a failed call", async () => {
    fetchMock.mockResolvedValue(failure(401, "bad key"));
    await expect(
      createOpenAiModelClient({ apiKey: "k" }).generateText("x"),
    ).rejects.toThrow("OpenAI API error 401: bad key");
  });
});

describe("createStaticModelClient", () => {
  it("returns a fixed reply without touching the network", async () => {
    expect(await createStaticModelClient("canned").generateText("x")).toBe(
      "canned",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can derive its reply from the prompt", async () => {
    const client = createStaticModelClient((prompt) => `echo: ${prompt}`);
    expect(await client.generateText("hello")).toBe("echo: hello");
  });
});
