/**
 * @fileoverview The watch page's shared AI results: what a write must look
 * like to be saved for every viewer, and how stored rows read back.
 */

import { describe, expect, it } from "vitest";
import {
  collectSharedVideoAi,
  lensPanel,
  outcomeKey,
  parseSharedVideoAiWrite,
  sharedVideoAiId,
} from "../src/lib/shared-video-ai";
import { aggregatePanel, type SpeechOutcomeSimulation } from "../src/lib/speech-outcomes";

const videoId = "dQw4w9WgXcQ";

const flowBallot = (affWinProbability: number, rfd: string) =>
  aggregatePanel([{ judge: "flow", winner: affWinProbability > 50 ? "aff" : "neg", affWinProbability, rfd, decisive: "the DA" }]);

const simulation: SpeechOutcomeSimulation = {
  actual: { assessment: "Dropped the DA.", ballot: flowBallot(30, "Neg on the DA.") },
  alternatives: [
    { title: "Collapse to the turn", approach: "collapse", outline: ["Extend the turn"], tradeoff: "Less coverage", ballot: flowBallot(60, "Aff on the turn.") },
  ],
  keyClash: ["The DA"],
};

describe("parseSharedVideoAiWrite", () => {
  it("accepts a segmentation and keeps what the reply parser keeps", () => {
    const parsed = parseSharedVideoAiWrite({
      videoId,
      kind: "segmentation",
      data: {
        format: "policy",
        speeches: [
          { name: "1AC", startSeconds: 30, endSeconds: 510, confidence: 0.9 },
          { name: "junk", startSeconds: "nope", endSeconds: null },
        ],
      },
    });
    expect(parsed.ok && parsed.value).toMatchObject({
      kind: "segmentation",
      key: "",
      replace: false,
      data: { format: "policy", speeches: [{ name: "1AC", startSeconds: 30, endSeconds: 510, confidence: 0.9 }] },
    });
  });

  it("round-trips an outcome run under its panel", () => {
    const parsed = parseSharedVideoAiWrite({ videoId, kind: "outcome", key: outcomeKey("1AR#1", "flow"), data: simulation, replace: true });
    expect(parsed.ok && parsed.value.data).toEqual(simulation);
    expect(parsed.ok && parsed.value.replace).toBe(true);
  });

  it("accepts a trimmed summary", () => {
    const parsed = parseSharedVideoAiWrite({ videoId, kind: "summary", key: "1AC#1", data: "  - Point one  " });
    expect(parsed.ok && parsed.value.data).toBe("- Point one");
  });

  it.each([
    [{ videoId: "short", kind: "summary", key: "1AC#1", data: "x" }, /videoId/],
    [{ videoId, kind: "other", key: "", data: {} }, /kind/],
    [{ videoId, kind: "summary", key: "", data: "x" }, /speech key/],
    [{ videoId, kind: "summary", key: "1AC#1", data: "   " }, /empty/],
    [{ videoId, kind: "outcome", key: "1AR#1::wizard", data: simulation }, /speechKey::panel/],
    [{ videoId, kind: "outcome", key: "1AR#1::flow", data: { actual: {} } }, /outcome simulation/],
    [{ videoId, kind: "segmentation", data: { speeches: [] } }, /segmentation/],
    [{ videoId, kind: "summary", key: "1AC#1", data: "x".repeat(70_000) }, /too large/],
  ])("rejects %j", (body, error) => {
    const parsed = parseSharedVideoAiWrite(body);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(error);
  });
});

describe("lensPanel", () => {
  it("reads back only keys panelKey could have made", () => {
    expect(lensPanel("flow")).toEqual(["flow"]);
    expect(lensPanel("flow+lay")).toEqual(["flow", "lay"]);
    expect(lensPanel("lay+flow")).toBeNull();
    expect(lensPanel("flow+flow")).toBeNull();
    expect(lensPanel("")).toBeNull();
  });
});

describe("collectSharedVideoAi", () => {
  it("folds rows into one record and skips unreadable ones", () => {
    const shared = collectSharedVideoAi([
      { kind: "segmentation", key: "", data: JSON.stringify({ format: "pf", speeches: [{ name: "Pro Constructive", startSeconds: 5, endSeconds: null }] }) },
      { kind: "summary", key: "1AC#1", data: JSON.stringify("- Outline") },
      { kind: "outcome", key: "1AR#1::flow", data: JSON.stringify(simulation) },
      { kind: "summary", key: "broken", data: "{not json" },
    ]);
    expect(shared.segmentation?.speeches[0]).toMatchObject({ name: "Pro Constructive", startSeconds: 5 });
    expect(shared.summaries).toEqual({ "1AC#1": "- Outline" });
    expect(shared.outcomes["1AR#1::flow"]).toEqual(simulation);
  });

  it("ids one row per video, kind and key", () => {
    expect(sharedVideoAiId(videoId, "summary", "1AC#1")).toBe(`${videoId}::summary::1AC#1`);
  });
});
