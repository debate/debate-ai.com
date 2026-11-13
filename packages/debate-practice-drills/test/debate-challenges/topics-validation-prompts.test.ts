/**
 * @fileoverview The Online Challenge topic list, request validation, and the
 * AI prompts and judge-reply reader.
 */

import { describe, expect, it } from "vitest";

import { aiSpeechPrompt, judgePrompt, parseJudgeReply } from "../../src/debate-challenges/prompts";
import { buildChallengeTopics, challengeTopicLabel, challengeTopicsFor, seasonLabel } from "../../src/debate-challenges/topics";
import { parseChallengeUpdate, parseNewDebateChallenge, readStoredSpeeches } from "../../src/debate-challenges/validation";

describe("challenge topics", () => {
  it("lists every format's resolutions from debate-topics.json, newest season first", () => {
    for (const format of ["pf", "ld", "policy", "ndt"] as const) {
      const topics = challengeTopicsFor(format);
      expect(topics.length, format).toBeGreaterThan(0);
      expect(topics[0].text.length).toBeGreaterThan(10);
      expect(new Set(topics.map((topic) => topic.key)).size).toBe(topics.length);
    }
    expect(challengeTopicsFor("parli")).toEqual([]);
  });

  it("labels seasons by their ending year", () => {
    expect(seasonLabel(2027)).toBe("2026-27");
    expect(seasonLabel(2100)).toBe("2099-00");
    const [first] = buildChallengeTopics(
      [
        { year: 2020, pf_topics: [{ topic: "Old" }] },
        { year: 2024, pf_topics: [{ start_month: "September", topic_name: "Data", emoji: "💾", topic: "Resolved: data." }] },
      ],
      "pf",
    );
    expect(first).toMatchObject({ season: "2023-24", name: "Data" });
    expect(challengeTopicLabel(first)).toBe("2023-24 · Sep · 💾 Data");
  });
});

describe("parseNewDebateChallenge", () => {
  const base = { opponentId: "bob", format: "ld", topic: "  Resolved:   space.  ", side: "neg" };

  it("normalizes a valid challenge", () => {
    expect(parseNewDebateChallenge(base)).toEqual({
      ok: true,
      value: { opponentId: "bob", vsAi: false, aiLevel: null, format: "ld", topic: "Resolved: space.", side: "neg", speech: "", note: "" },
    });
  });

  it("defaults the AI to varsity and checks its level", () => {
    const ai = parseNewDebateChallenge({ ...base, opponentId: "ai" });
    expect(ai.ok && ai.value).toMatchObject({ vsAi: true, aiLevel: "varsity" });
    expect(parseNewDebateChallenge({ ...base, opponentId: "ai", aiLevel: "god" }).ok).toBe(false);
  });

  it("refuses anything off the lists", () => {
    expect(parseNewDebateChallenge({ ...base, format: "chess" }).ok).toBe(false);
    expect(parseNewDebateChallenge({ ...base, side: "both" }).ok).toBe(false);
    expect(parseNewDebateChallenge({ ...base, topic: "" }).ok).toBe(false);
    expect(parseNewDebateChallenge({ ...base, topic: "x".repeat(500) }).ok).toBe(false);
    expect(parseNewDebateChallenge({ ...base, opponentId: "" }).ok).toBe(false);
    expect(parseNewDebateChallenge(null).ok).toBe(false);
  });
});

describe("parseChallengeUpdate and readStoredSpeeches", () => {
  it("reads known actions only", () => {
    expect(parseChallengeUpdate({ action: "speak", text: "hi" })).toEqual({ ok: true, value: { action: "speak", text: "hi" } });
    expect(parseChallengeUpdate({ action: "explode" }).ok).toBe(false);
  });

  it("drops malformed stored speeches", () => {
    const raw = JSON.stringify([{ side: "aff", authorId: "a", text: "t", submittedAt: 1 }, { side: "up" }, null]);
    expect(readStoredSpeeches(raw)).toEqual([{ side: "aff", authorId: "a", text: "t", submittedAt: 1 }]);
    expect(readStoredSpeeches("not json")).toEqual([]);
  });
});

describe("prompts", () => {
  const round = {
    format: "pf" as const,
    topic: "Resolved: The USFG should ban data centers.",
    speeches: [{ side: "aff" as const, authorId: "a", text: "Aff case here.", submittedAt: 1 }],
  };

  it("asks the AI for the next speech on its side, in the level's style", () => {
    const prompt = aiSpeechPrompt(round, "champion");
    expect(prompt).toContain("Negative constructive");
    expect(prompt).toContain("Negative (against the resolution)");
    expect(prompt).toContain("national-champion");
    expect(prompt).toContain("Aff case here.");
  });

  it("asks the judge for JSON and reads its answer", () => {
    expect(judgePrompt(round)).toContain('"winner"');
    expect(parseJudgeReply('Sure! {"winner": "NEG", "reason": "Better weighing."}')).toEqual({ winner: "neg", reason: "Better weighing." });
    expect(parseJudgeReply('winner: aff because...')?.winner).toBe("aff");
    expect(parseJudgeReply("I can't decide.")).toBeNull();
  });
});
