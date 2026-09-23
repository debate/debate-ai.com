import { describe, expect, it, vi } from "vitest";
import {
  FIND_FLAWS_AND_EXTENSIONS_PROMPT,
  MAX_ANALYSIS_CONTENT_CHARS,
  buildCardAnalysisContent,
  htmlToPlainText,
  requestCardAiAnalysis,
  sha256Hex,
} from "../src/lib/card-ai-analysis";

describe("FIND_FLAWS_AND_EXTENSIONS_PROMPT", () => {
  it("asks for both flaws and extensions", () => {
    expect(FIND_FLAWS_AND_EXTENSIONS_PROMPT).toMatch(/flaws/i);
    expect(FIND_FLAWS_AND_EXTENSIONS_PROMPT).toMatch(/extensions/i);
  });
});

describe("htmlToPlainText", () => {
  it("drops tags and decodes common entities", () => {
    expect(htmlToPlainText("<p>Warming <b>is</b> real &amp; bad</p><p>Next</p>")).toBe("Warming is real & bad\nNext");
  });
});

describe("buildCardAnalysisContent", () => {
  it("joins tag, cite and card text", () => {
    expect(buildCardAnalysisContent({ tag: "Tag", cite: "Smith 24", html: "<p>Body</p>" })).toBe("Tag\n\nSmith 24\n\nBody");
  });

  it("falls back to the summary and truncates long cards", () => {
    expect(buildCardAnalysisContent({ tag: "", cite: "", html: "", summary: "Sum" })).toBe("Sum");
    const long = buildCardAnalysisContent({ tag: "T", cite: "C", html: "x".repeat(MAX_ANALYSIS_CONTENT_CHARS * 2) });
    expect(long.length).toBe(MAX_ANALYSIS_CONTENT_CHARS);
  });
});

describe("sha256Hex", () => {
  it("is stable across whitespace differences", async () => {
    const a = await sha256Hex("a  card\n text");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex(" a card text ")).toBe(a);
    expect(await sha256Hex("another card")).not.toBe(a);
  });
});

describe("requestCardAiAnalysis", () => {
  it("returns the result and cache flag", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ result: "ok", cached: true }), { status: 200 }));
    await expect(requestCardAiAnalysis({ content: "c", prompt: "p" }, "/x", fetchImpl)).resolves.toEqual({
      result: "ok",
      cached: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith("/x", expect.objectContaining({ method: "POST" }));
  });

  it("throws the server's error message", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "Sign in" }), { status: 401 }));
    await expect(requestCardAiAnalysis({ content: "c", prompt: "p" }, "/x", fetchImpl)).rejects.toThrow("Sign in");
  });
});
