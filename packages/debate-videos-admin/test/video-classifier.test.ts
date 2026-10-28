// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isRound } from "../src/sync/youtube/parsers/video-classifier";
import { classifyLecture, classifyRoundCollection } from "@debate-ai/videos/src/data/lecture-classifier";

describe("isRound", () => {
  it("accepts a video with both teams and a round level", () => {
    expect(
      isRound("TOC Finals: Michigan KM vs Northwestern BC", "Full round video"),
    ).toBe(true);
  });

  it("accepts a team matchup when the description records a decision", () => {
    expect(
      isRound(
        "Berkeley: Michigan KM vs Northwestern BC",
        "3-0 for the affirmative",
      ),
    ).toBe(true);
  });

  it("rejects instructional videos even when they name two teams", () => {
    expect(isRound("Lecture: Michigan KM vs Northwestern BC", "")).toBe(false);
    expect(isRound("Demo round: Michigan KM vs Northwestern BC", "")).toBe(false);
    expect(isRound("Critique Analysis: Michigan KM vs Northwestern BC", "")).toBe(
      false,
    );
  });

  it("rejects a video with no team matchup at all", () => {
    expect(isRound("Impact Calculus Finals", "")).toBe(false);
  });

  it("rejects instructional descriptions", () => {
    expect(
      isRound("Finals: A vs B", "This video teaches you impact calculus"),
    ).toBe(false);
  });
});

describe("classifyLecture", () => {
  it("routes topic analysis videos to Topic Lectures", () => {
    expect(classifyLecture("2024 Topic Analysis", "")).toBe("Topic Lectures");
  });

  it("routes beginner content to Novice & Introductory", () => {
    expect(classifyLecture("Intro to Public Forum", "")).toBe(
      "Novice & Introductory",
    );
  });

  it("classifies aff and neg strategy lectures", () => {
    expect(classifyLecture("Writing a 1AC", "")).toBe("Affirmative Strategy");
    expect(classifyLecture("Block writing for the 2NC", "")).toBe(
      "Negative Strategy",
    );
  });

  it("files World Schools and ACC titles under their own collections", () => {
    expect(classifyLecture("WSD Rebuttals: Weighing Clash", "")).toBe("WSD");
    expect(classifyLecture("Intro to World Schools Debate", "")).toBe("WSD");
    expect(classifyLecture("acc lecture | Speaking in the chamber", "")).toBe("ACC");
    expect(classifyLecture("American Congressional Debate basics", "")).toBe("ACC");
  });

  it("does not read ACC inside other words or WSD from the description", () => {
    expect(classifyLecture("Accent and delivery drills", "")).toBe("Speaking & Delivery");
    expect(classifyLecture("Access to evidence", "")).not.toBe("ACC");
    expect(classifyLecture("Writing a 1AC", "a WSD coach explains")).toBe("Affirmative Strategy");
  });

  it("always returns a non-empty category", () => {
    expect(classifyLecture("Some unrelated debate video", "").length).toBeGreaterThan(
      0,
    );
  });
});

describe("classifyRoundCollection", () => {
  it("files ACC Debate Tournament rounds under ACC", () => {
    expect(
      classifyRoundCollection("2022 ACC Debate Tournament - Final Round - Wake Forest(A) vs Miami (N)"),
    ).toBe("ACC");
    expect(classifyRoundCollection("acc debate tournament 2026 Final - SMU vs Boston College")).toBe("ACC");
  });

  it("leaves other rounds without a collection", () => {
    expect(classifyRoundCollection("TOC FINALS - GBN CR vs MBA HL")).toBeNull();
    expect(classifyRoundCollection("Accent Debate Tournament Finals")).toBeNull();
  });
});
