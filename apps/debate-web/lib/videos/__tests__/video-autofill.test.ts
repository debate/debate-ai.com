/**
 * @fileoverview "Auto-fill with AI": the reply parser (including each side's
 * arguments) and the provider call — openrouter/free through write-language,
 * the caller's own key first, and the next key tried when one fails.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env: Record<string, string | undefined> = {};
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: (...args: unknown[]) => generateText(...args),
}));

const createLLMProvider = vi.fn((provider: string, _key: string, model: string, _temperature: number) => ({ provider, model }));
vi.mock("write-language", () => ({
  createLLMProvider: (...args: [string, string, string, number]) => createLLMProvider(...args),
}));

const { askModel, autofillKeys, autofillVideo, parseAutofillReply, VIDEO_AUTOFILL_PROMPT } = await import("../video-autofill");

const ANSWER = {
  style: "college",
  category: "none",
  tournament: "Dartmouth RR",
  roundLevel: "Round 3",
  affTeam: "Michigan KS",
  negTeam: "Harvard HS",
  winner: "neg",
  judgeDecision: "2-1 Neg",
  speechDocsUrl: "",
  affArguments: "Space cooperation plan; Asteroid and Russia advantages",
  negArguments: "Cap K, Politics DA",
};

describe("parseAutofillReply", () => {
  it("reads a fenced answer, including both sides' arguments", () => {
    const fields = parseAutofillReply("```json\n" + JSON.stringify(ANSWER) + "\n```");
    expect(fields).toMatchObject({
      style: 4,
      category: null,
      tournament: "Dartmouth RR",
      affWin: false,
      arg1ac: "Space cooperation plan; Asteroid and Russia advantages",
      arg2nr: "Cap K, Politics DA",
      speechDocsUrl: null,
    });
  });

  it("treats blank arguments as no suggestion", () => {
    expect(parseAutofillReply(JSON.stringify({ ...ANSWER, affArguments: " ", negArguments: "" }))).toMatchObject({
      arg1ac: null,
      arg2nr: null,
    });
  });

  it("returns null for a reply with no object", () => {
    expect(parseAutofillReply("Sorry, I can't tell.")).toBeNull();
  });
});

describe("VIDEO_AUTOFILL_PROMPT", () => {
  it("spells out the answer keys and the allowed styles", () => {
    expect(VIDEO_AUTOFILL_PROMPT).toContain('"affArguments"');
    expect(VIDEO_AUTOFILL_PROMPT).toContain('"negArguments"');
    expect(VIDEO_AUTOFILL_PROMPT).toContain('"college"');
  });
});

describe("askModel", () => {
  beforeEach(() => {
    for (const key of Object.keys(env)) delete env[key];
    generateText.mockReset();
    createLLMProvider.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks OpenRouter's free router on the shared key", async () => {
    env.OPENROUTER_API_KEY = '"sk-or-v1-shared"\n';
    generateText.mockResolvedValue({ text: JSON.stringify(ANSWER), finishReason: "stop" });

    const fields = await askModel("Title: x");

    expect(fields.arg2nr).toBe("Cap K, Politics DA");
    expect(createLLMProvider).toHaveBeenCalledTimes(1);
    expect(createLLMProvider.mock.calls[0].slice(0, 3)).toEqual(["openrouter", "sk-or-v1-shared", "openrouter/free"]);
    expect(generateText.mock.calls[0][0]).toMatchObject({ system: VIDEO_AUTOFILL_PROMPT });
  });

  it("uses the caller's own key first, from x-user-ai-key", async () => {
    env.OPENROUTER_API_KEY = "sk-or-v1-shared";
    generateText.mockResolvedValue({ text: JSON.stringify(ANSWER), finishReason: "stop" });
    const request = new Request("https://debate-ai.com/api/admin/videos/library/autofill", {
      headers: { "x-user-ai-key": "sk-or-v1-mine" },
    });

    await askModel("Title: x", autofillKeys(request));

    expect(createLLMProvider).toHaveBeenCalledTimes(1);
    expect(createLLMProvider.mock.calls[0].slice(0, 3)).toEqual(["openrouter", "sk-or-v1-mine", "openrouter/free"]);
  });

  it("falls through to the shared keys when a key fails", async () => {
    env.OPENROUTER_API_KEY = "sk-or-v1-shared";
    env.ANTHROPIC_API_KEY = "sk-ant-shared";
    generateText
      .mockRejectedValueOnce(new Error("User not found"))
      .mockResolvedValueOnce({ text: "not json", finishReason: "stop" })
      .mockResolvedValueOnce({ text: JSON.stringify(ANSWER), finishReason: "stop" });
    const request = new Request("https://debate-ai.com/x", { headers: { "x-user-ai-key": "sk-or-v1-mine" } });

    const fields = await askModel("Title: x", autofillKeys(request));

    expect(fields.tournament).toBe("Dartmouth RR");
    expect(createLLMProvider.mock.calls.map((c) => c[2])).toEqual(["openrouter/free", "openrouter/free", "claude-sonnet-4-6"]);
  });

  it("throws with each provider's message when every key fails", async () => {
    env.OPENROUTER_API_KEY = "sk-or-v1-shared";
    generateText.mockRejectedValue(new Error("Invalid model"));

    await expect(askModel("Title: x")).rejects.toThrow("OpenRouter: Network error contacting AI provider: Invalid model");
  });

  it("says how to configure a key when none is set", async () => {
    await expect(askModel("Title: x")).rejects.toThrow("AI features are not configured");
  });
});

describe("autofillVideo", () => {
  beforeEach(() => {
    for (const key of Object.keys(env)) delete env[key];
    generateText.mockReset();
    createLLMProvider.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("fills a fully stated round from the title without calling the model", async () => {
    env.OPENROUTER_API_KEY = "sk-or-v1-shared";
    const result = await autofillVideo({
      videoId: "aaaaaaaaaaa",
      title: "2024 Tournament of Champions LD Finals: Horace Greeley SG vs Monta Vista EY",
      description: "Final round.",
    });
    expect(generateText).not.toHaveBeenCalled();
    expect(result).toMatchObject({ fromTitle: true, fromAi: false });
    expect(result.fields).toMatchObject({ style: 3, tournament: "TOC", affTeam: "Horace Greeley SG" });
  });

  it("asks the model for the rest, keeps the title's readings, and tells the model about them", async () => {
    env.OPENROUTER_API_KEY = "sk-or-v1-shared";
    generateText.mockResolvedValue({
      text: JSON.stringify({ ...ANSWER, style: "policy", affTeam: "Wrong Team", tournament: "" }),
      finishReason: "stop",
    });
    const result = await autofillVideo({
      videoId: "aaaaaaaaaaa",
      title: "2012 TOC Finals -- Northwestern BK v Georgetown AM",
      description: "",
    });
    expect(result.fromAi).toBe(true);
    expect(result.fields).toMatchObject({ style: 1, affTeam: "Northwestern BK", tournament: "TOC", arg2nr: "Cap K, Politics DA" });
    const sent = generateText.mock.calls[0][0].messages[0].content as string;
    expect(sent).toContain("Already read from the title");
    expect(sent).toContain("affTeam: Northwestern BK");
  });

  it("returns the title's readings with a warning when the model fails", async () => {
    env.OPENROUTER_API_KEY = "sk-or-v1-shared";
    generateText.mockRejectedValue(new Error("busy"));
    const result = await autofillVideo({
      videoId: "aaaaaaaaaaa",
      title: "2012 TOC Finals -- Northwestern BK v Georgetown AM",
      description: "",
    });
    expect(result.fromAi).toBe(false);
    expect(result.fields.negTeam).toBe("Georgetown AM");
    expect(result.warnings.join(" ")).toContain("busy");
  });
});
