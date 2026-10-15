/**
 * @fileoverview "Auto-fill with AI": the reply parser (including each side's
 * arguments) and the provider call — a plain chat request, the provider's own
 * error surfaced, and Anthropic tried when OpenRouter fails.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { askModel, parseAutofillReply, VIDEO_AUTOFILL_PROMPT } from "../video-autofill";

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
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("sends a plain chat request to OpenRouter, without a response_format", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(reply({ choices: [{ message: { content: JSON.stringify(ANSWER) } }] }));

    const fields = await askModel("Title: x");

    expect(fields.arg2nr).toBe("Cap K, Politics DA");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    expect(body).not.toHaveProperty("response_format");
    expect(body.model).toBe("anthropic/claude-sonnet-4.6");
  });

  it("falls back to Anthropic when OpenRouter fails", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "an-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(reply({ error: { message: "No endpoints found" } }, 404))
      .mockResolvedValueOnce(reply({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(ANSWER) }] }));

    const fields = await askModel("Title: x");

    expect(fields.tournament).toBe("Dartmouth RR");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body).not.toHaveProperty("output_config");
  });

  it("throws with the provider's own message when every provider fails", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ error: { message: "Invalid model" } }, 400));

    await expect(askModel("Title: x")).rejects.toThrow("OpenRouter returned 400: Invalid model");
  });
});
