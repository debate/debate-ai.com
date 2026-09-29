import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALTERNATING_EIGHT_SPEECH_PRESET,
  buildSpeechJudgeUserPrompt,
  createPresetSpeeches,
  hasSpeechContent,
  nextSpeechSide,
  requestSpeechJudgeDecision,
  type JudgedSpeech,
} from "../src/round/speech-judge-ai";
import { STANDARD_JUDGE_SYSTEM_PROMPT } from "../src/round/standard-judge-prompt";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SPEECHES: JudgedSpeech[] = [
  { id: "a", name: "1AC", side: "aff", text: "Plan solves warming." },
  { id: "b", name: "1NC", side: "neg", text: "" },
];

describe("8-speech preset", () => {
  it("has 8 speeches alternating Aff and Neg, starting with Aff", () => {
    expect(ALTERNATING_EIGHT_SPEECH_PRESET).toHaveLength(8);
    ALTERNATING_EIGHT_SPEECH_PRESET.forEach((speech, index) => {
      expect(speech.side).toBe(index % 2 === 0 ? "aff" : "neg");
    });
  });

  it("creates empty speeches with unique ids", () => {
    const speeches = createPresetSpeeches();
    expect(new Set(speeches.map((s) => s.id)).size).toBe(8);
    expect(hasSpeechContent(speeches)).toBe(false);
  });
});

describe("nextSpeechSide", () => {
  it("keeps the alternation", () => {
    expect(nextSpeechSide([])).toBe("aff");
    expect(nextSpeechSide(SPEECHES.slice(0, 1))).toBe("neg");
    expect(nextSpeechSide(SPEECHES)).toBe("aff");
  });
});

describe("buildSpeechJudgeUserPrompt", () => {
  it("lists speeches in order with sides and marks empty ones", () => {
    const prompt = buildSpeechJudgeUserPrompt(SPEECHES);
    expect(prompt).toContain("### Speech 1: 1AC (Aff)\n\nPlan solves warming.");
    expect(prompt).toContain("### Speech 2: 1NC (Neg)\n\n[Not provided]");
    expect(prompt).toContain("## Critique and Alternatives");
    expect(prompt.indexOf("1AC")).toBeLessThan(prompt.indexOf("1NC"));
  });
});

describe("requestSpeechJudgeDecision", () => {
  it("posts the Standard Judge system prompt and returns the reply text", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "## Decision\n\n**Winner:** Affirmative" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const text = await requestSpeechJudgeDecision(SPEECHES);

    expect(text).toContain("**Winner:** Affirmative");
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.system).toBe(STANDARD_JUDGE_SYSTEM_PROMPT);
    expect(body.system.startsWith("You are Standard Judge")).toBe(true);
    expect(body.messages[0].content).toContain("Plan solves warming.");
  });

  it("surfaces the proxy's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "Sign in to use AI features." }) })),
    );
    await expect(requestSpeechJudgeDecision(SPEECHES)).rejects.toThrow("Sign in to use AI features.");
  });

  it("rejects an empty reply", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: "  " }) })));
    await expect(requestSpeechJudgeDecision(SPEECHES)).rejects.toThrow("empty decision");
  });
});
