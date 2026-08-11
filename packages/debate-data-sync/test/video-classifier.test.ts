import { describe, expect, it } from "vitest";
import { isRound } from "../src/youtube/parsers/video-classifier";
import { classifyLecture } from "../src/youtube/parsers/lecture-classifier";

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
    expect(isRound("Kritik Analysis: Michigan KM vs Northwestern BC", "")).toBe(
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

  it("always returns a non-empty category", () => {
    expect(classifyLecture("Some unrelated debate video", "").length).toBeGreaterThan(
      0,
    );
  });
});
