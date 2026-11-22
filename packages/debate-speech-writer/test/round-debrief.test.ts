/**
 * @fileoverview The Practice vs AI Coach debrief: system prompt per coaching
 * style, the scorecard/speech user prompt (with its length limits), the reply
 * parser, and the `/api/reason-ai` client.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_DEBRIEF_ARGUMENTS,
  MAX_DEBRIEF_ARGUMENT_SUMMARY_CHARS,
  MAX_DEBRIEF_OPPONENT_SPEECHES_CHARS,
  MAX_DEBRIEF_SPEECH_CHARS,
  ROUND_DEBRIEF_AI_SYSTEM_PROMPT,
  buildRoundDebriefSystemPrompt,
  buildRoundDebriefUserPrompt,
  parseRoundDebriefResponse,
  type RoundDebriefInput,
} from "../src/coach/round-debrief-ai";
import { requestRoundDebrief } from "../src/coach/round-debrief-client";

const INPUT: RoundDebriefInput = {
  topic: "Resolved: The US should ban TikTok.",
  userStance: "For",
  opponentName: "Professor Logic",
  phases: [
    { title: "Opening Statement", userScore: 5, opponentScore: 8, userReason: "Weak warrants.", opponentReason: "Clear framing." },
    { title: "Closing Statement", userScore: 7, opponentScore: 6, userReason: "Good weighing." },
  ],
  verdict: { winner: "Professor Logic", reason: "Won the framing debate." },
  userSpeeches: [{ phase: "Opening Statements", text: "TikTok is a national security risk." }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildRoundDebriefSystemPrompt", () => {
  it("keeps the base prompt for Standard, missing or unknown styles", () => {
    expect(buildRoundDebriefSystemPrompt()).toBe(ROUND_DEBRIEF_AI_SYSTEM_PROMPT);
    expect(buildRoundDebriefSystemPrompt("standard")).toBe(ROUND_DEBRIEF_AI_SYSTEM_PROMPT);
    expect(buildRoundDebriefSystemPrompt("drill-sergeant")).toBe(ROUND_DEBRIEF_AI_SYSTEM_PROMPT);
  });

  it("appends the persona after the base prompt", () => {
    const prompt = buildRoundDebriefSystemPrompt("socratic");
    expect(prompt.startsWith(ROUND_DEBRIEF_AI_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("Coaching style — Socratic:");
  });
});

describe("buildRoundDebriefUserPrompt", () => {
  it("includes the topic, sides, every phase with both scores and reasons, the decision and speeches", () => {
    const prompt = buildRoundDebriefUserPrompt(INPUT);
    expect(prompt).toContain("Topic: Resolved: The US should ban TikTok.");
    expect(prompt).toContain("Student's side: For");
    expect(prompt).toContain("Opponent: Professor Logic");
    expect(prompt).toContain("- Opening Statement: student 5/10, opponent 8/10.");
    expect(prompt).toContain("Judge on the student: Weak warrants.");
    expect(prompt).toContain("Judge on the opponent: Clear framing.");
    expect(prompt).toContain("- Closing Statement: student 7/10, opponent 6/10.");
    expect(prompt).toContain("Decision: Professor Logic won.");
    expect(prompt).toContain("Reason for decision: Won the framing debate.");
    expect(prompt).toContain("[Opening Statements] TikTok is a national security risk.");
  });

  it("omits empty fields and blank speeches, and names a generic opponent", () => {
    const prompt = buildRoundDebriefUserPrompt({
      phases: [{ title: "Opening Statement", userScore: Number.NaN, opponentScore: 4, userReason: "  " }],
      userSpeeches: [{ text: "   " }],
    });
    expect(prompt).not.toContain("Topic:");
    expect(prompt).not.toContain("Decision:");
    expect(prompt).not.toContain("The student's speeches");
    expect(prompt).not.toContain("Judge on the student");
    expect(prompt).toContain("Opponent: the opponent");
    expect(prompt).toContain("student ?/10");
  });

  it("clips long speeches and leaves out speeches past the total budget", () => {
    const long = "x".repeat(MAX_DEBRIEF_SPEECH_CHARS + 500);
    const prompt = buildRoundDebriefUserPrompt({
      phases: [],
      userSpeeches: Array.from({ length: 6 }, () => ({ phase: "Closing", text: long })),
    });
    expect(prompt).toContain(`${"x".repeat(MAX_DEBRIEF_SPEECH_CHARS)}…`);
    expect(prompt).not.toContain("x".repeat(MAX_DEBRIEF_SPEECH_CHARS + 1));
    // Clipped speeches are 1501 chars each: 3 fit in 6000, a 4th would pass it.
    expect(prompt.match(/\[Closing\]/g)).toHaveLength(3);
    expect(prompt).toContain("(3 more speeches left out for length.)");
  });
});

describe("buildRoundDebriefUserPrompt — the opponent's speeches", () => {
  it("quotes the opponent's speeches after the student's", () => {
    const prompt = buildRoundDebriefUserPrompt({
      ...INPUT,
      opponentSpeeches: [{ phase: "Opening Statements", text: "Banning apps violates free speech." }],
    });
    const student = prompt.indexOf("The student's speeches:");
    const opponent = prompt.indexOf("The opponent's speeches:");
    expect(student).toBeGreaterThan(-1);
    expect(opponent).toBeGreaterThan(student);
    expect(prompt.slice(opponent)).toContain("[Opening Statements] Banning apps violates free speech.");
    expect(prompt.slice(opponent)).not.toContain("TikTok is a national security risk.");
  });

  it("adds no opponent heading when there are none or all are blank", () => {
    expect(buildRoundDebriefUserPrompt(INPUT)).not.toContain("The opponent's speeches");
    expect(buildRoundDebriefUserPrompt({ ...INPUT, opponentSpeeches: [{ text: "  " }] })).not.toContain(
      "The opponent's speeches",
    );
  });

  it("quotes the opponent even when the student said nothing", () => {
    const prompt = buildRoundDebriefUserPrompt({ phases: [], opponentSpeeches: [{ text: "Only the bot spoke." }] });
    expect(prompt).not.toContain("The student's speeches");
    expect(prompt).toContain("The opponent's speeches:\n[Speech] Only the bot spoke.");
  });

  it("keeps the opponent on its own, smaller budget, so it never crowds out the student", () => {
    const long = "y".repeat(MAX_DEBRIEF_SPEECH_CHARS + 500);
    const prompt = buildRoundDebriefUserPrompt({
      phases: [],
      userSpeeches: Array.from({ length: 3 }, () => ({ phase: "Closing", text: "x".repeat(MAX_DEBRIEF_SPEECH_CHARS) })),
      opponentSpeeches: Array.from({ length: 4 }, () => ({ phase: "Rebuttal", text: long })),
    });
    // All three of the student's fit in their 6000-char budget.
    expect(prompt.match(/\[Closing\]/g)).toHaveLength(3);
    // Clipped opponent speeches are 1501 chars: 1 fits in 3000, a 2nd would pass it.
    expect(MAX_DEBRIEF_OPPONENT_SPEECHES_CHARS).toBe(3000);
    expect(prompt.match(/\[Rebuttal\]/g)).toHaveLength(1);
    expect(prompt).toContain("(3 more speeches left out for length.)");
  });

  it("tells the coach to use the opponent's speeches only to judge the student's answers", () => {
    expect(ROUND_DEBRIEF_AI_SYSTEM_PROMPT).toContain("the student's own speeches and the opponent's");
    expect(ROUND_DEBRIEF_AI_SYSTEM_PROMPT).toContain("the debrief is about the student");
  });
});

describe("buildRoundDebriefUserPrompt — the chosen arguments", () => {
  it("lists each side's arguments before the scorecard", () => {
    const prompt = buildRoundDebriefUserPrompt({
      ...INPUT,
      userArguments: [{ title: "Security advantage", summary: "Data flows to a foreign government." }, { title: "Privacy" }],
      opponentArguments: [{ title: "Free speech DA", summary: "Bans chill expression." }],
    });
    expect(prompt).toContain(
      "Arguments the student chose to run:\n- Security advantage: Data flows to a foreign government.\n- Privacy",
    );
    expect(prompt).toContain("Arguments the opponent ran:\n- Free speech DA: Bans chill expression.");
    expect(prompt.indexOf("Arguments the opponent ran:")).toBeLessThan(prompt.indexOf("Judge's scorecard:"));
  });

  it("skips untitled arguments and empty lists", () => {
    const prompt = buildRoundDebriefUserPrompt({
      ...INPUT,
      userArguments: [{ title: "  ", summary: "No name." }],
      opponentArguments: [],
    });
    expect(prompt).not.toContain("Arguments the");
    expect(prompt).not.toContain("No name.");
  });

  it("caps the list and clips long summaries", () => {
    const prompt = buildRoundDebriefUserPrompt({
      phases: [],
      userArguments: Array.from({ length: MAX_DEBRIEF_ARGUMENTS + 2 }, (_, i) => ({
        title: `Arg ${i + 1}`,
        summary: "s".repeat(MAX_DEBRIEF_ARGUMENT_SUMMARY_CHARS + 50),
      })),
    });
    expect(prompt).toContain(`- Arg ${MAX_DEBRIEF_ARGUMENTS}:`);
    expect(prompt).not.toContain(`- Arg ${MAX_DEBRIEF_ARGUMENTS + 1}:`);
    expect(prompt).toContain("(2 more arguments not listed.)");
    expect(prompt).toContain(`${"s".repeat(MAX_DEBRIEF_ARGUMENT_SUMMARY_CHARS)}…`);
    expect(prompt).not.toContain("s".repeat(MAX_DEBRIEF_ARGUMENT_SUMMARY_CHARS + 1));
  });
});

describe("parseRoundDebriefResponse", () => {
  it("trims, strips a code fence, and returns null for nothing usable", () => {
    expect(parseRoundDebriefResponse("  Work on warrants.  ")).toBe("Work on warrants.");
    expect(parseRoundDebriefResponse("```text\nWork on warrants.\n```")).toBe("Work on warrants.");
    expect(parseRoundDebriefResponse("   ")).toBeNull();
    expect(parseRoundDebriefResponse("```\n\n```")).toBeNull();
  });
});

describe("requestRoundDebrief", () => {
  it("posts the styled system prompt and the scorecard prompt to /api/reason-ai", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: "Priority one: warrants." }) }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestRoundDebrief(INPUT, { personaId: "fact-checker" })).resolves.toBe("Priority one: warrants.");

    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe(buildRoundDebriefSystemPrompt("fact-checker"));
    expect(body.messages).toEqual([{ role: "user", content: buildRoundDebriefUserPrompt(INPUT) }]);
    expect(body.maxTokens).toBeGreaterThan(0);
  });

  it("throws the proxy's error message, or a status fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "Sign in to use AI features." }) })),
    );
    await expect(requestRoundDebrief(INPUT)).rejects.toThrow("Sign in to use AI features.");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new Error("not json"); } })),
    );
    await expect(requestRoundDebrief(INPUT)).rejects.toThrow("Coach debrief request failed (502).");
  });

  it("throws on an empty reply", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: "  " }) })));
    await expect(requestRoundDebrief(INPUT)).rejects.toThrow("empty or unusable debrief");
  });
});
