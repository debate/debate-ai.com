// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isRound } from "../src/sync/youtube/parsers/video-classifier";
import {
  classifyLecture,
  classifyRoundCollection,
  forcedLectureCategory,
  isNsdaChannel,
  isSuperDebateVideo,
  lectureCategoryForChannel,
  LECTURE_CATEGORIES,
} from "@debate-ai/videos/src/data/lecture-classifier";

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

describe("parliamentary debate", () => {
  it("reads a parli final with a \"v.\" matchup as a round", () => {
    expect(isRound("2024 NPDA Finals Rice University RS v. Parli Debate at Berkeley SK (Neg)", "")).toBe(true);
  });

  it("files parli rounds and lectures on the Parli shelf", () => {
    expect(classifyRoundCollection("2024 NPDA Finals Rice RS v. Berkeley SK")).toBe("Parli");
    expect(classifyRoundCollection("NPTE Quarters: Washington vs Oregon")).toBe("Parli");
    expect(classifyLecture("What is NPDA: DebateSensei NPDA S1:E1", "")).toBe("Parli");
    expect(classifyLecture("How to run a parli kritik", "")).toBe("Parli");
  });

  it("keeps ACC tournament rounds and non-parli words where they were", () => {
    expect(classifyRoundCollection("2024 ACC Debate Tournament - Notre Dame vs Georgia Tech")).toBe("ACC");
    expect(classifyRoundCollection("Parlay strategy at the Parliament of Canada")).toBeNull();
    expect(classifyRoundCollection("TOC Finals: Michigan KM vs Northwestern BC")).toBeNull();
  });
});

describe("congressional debate", () => {
  it("files Congress rounds and lectures on the Congress shelf", () => {
    expect(classifyRoundCollection("2024 Congress Finals - Bellaire vs Harvard")).toBe("Congress");
    expect(classifyRoundCollection("Congress Semis: Greenhill vs Bronx")).toBe("Congress");
    expect(classifyLecture("Congress legislation strategy", "")).toBe("Congress");
  });

  it("keeps ACC congressional lectures and other rounds where they were", () => {
    expect(classifyLecture("American Congressional Debate lecture", "")).toBe("ACC");
    expect(classifyRoundCollection("2024 ACC Debate Tournament - Notre Dame vs Georgia Tech")).toBe("ACC");
    expect(classifyRoundCollection("TOC Finals: Michigan KM vs Northwestern BC")).toBeNull();
  });
});

describe("NSDA Speech shelf", () => {
  it("files every NSDA channel lecture under NSDA Speech, whatever the title", () => {
    expect(classifyLecture("Intro to Policy Debate", "", "National Speech & Debate Association")).toBe("NSDA Speech");
    expect(classifyLecture("WSD Rebuttals", "", "National Speech and Debate Association")).toBe("NSDA Speech");
    expect(classifyLecture("Judge training", "", "nsdaspeechanddebate")).toBe("NSDA Speech");
  });

  it("leaves other channels to the title", () => {
    expect(classifyLecture("Intro to Policy Debate", "", "Victory Briefs")).toBe("Novice & Introductory");
    expect(classifyLecture("Intro to Policy Debate", "")).toBe("Novice & Introductory");
  });

  it("recognises the NSDA channel only", () => {
    expect(isNsdaChannel("National Speech & Debate Association")).toBe(true);
    expect(isNsdaChannel("@nsdaspeechanddebate")).toBe(true);
    expect(isNsdaChannel("Indiana Speech and Debate")).toBe(false);
    expect(isNsdaChannel("")).toBe(false);
    expect(lectureCategoryForChannel(null)).toBeNull();
  });
});

describe("Open Super Debates shelf", () => {
  it("is one of the categories a person can pick", () => {
    expect(LECTURE_CATEGORIES).toContain("Open Super Debates");
  });

  it("files the queued Super Debate lectures under it, whatever their keywords", () => {
    expect(classifyLecture("Chicago Super Debate Night 1 Recap", "", "SuperDebate")).toBe("Open Super Debates");
    expect(
      classifyLecture("Will AI Eliminate More Jobs Than It Creates? Martin Ford vs. Pedro Domingos", "research on jobs", "SuperDebate"),
    ).toBe("Open Super Debates");
    expect(classifyLecture("Welcome to our live show!", "", "SuperDebate")).toBe("Open Super Debates");
  });

  it("matches the channel in any spelling", () => {
    for (const channel of ["Super Debate", "SuperDebate", "Super Debater", "@SuperDebate", "SUPER DEBATERS", "super-debate"]) {
      expect(classifyLecture("Welcome to our live show!", "", channel)).toBe("Open Super Debates");
      expect(isSuperDebateVideo("Welcome", channel)).toBe(true);
    }
  });

  it("matches a title containing Super Debate in any case, on any channel", () => {
    expect(classifyLecture("Intro to the SUPER DEBATE format", "", "Victory Briefs")).toBe("Open Super Debates");
    expect(classifyLecture("highlights from super debate 3", "")).toBe("Open Super Debates");
    expect(classifyLecture("Super Debater finals", "", null)).toBe("Open Super Debates");
  });

  it("wins over the NSDA channel and the other collections", () => {
    expect(classifyLecture("Super Debate: Congress edition", "", "National Speech & Debate Association")).toBe(
      "Open Super Debates",
    );
    expect(classifyRoundCollection("Super Debate Night: ACC Debate Tournament Final")).toBe("Open Super Debates");
    expect(classifyRoundCollection("TOC Finals: A vs B", "SuperDebate")).toBe("Open Super Debates");
  });

  it("only reads the title and channel, not the description or similar words", () => {
    expect(classifyLecture("Intro to Policy Debate", "from the super debate series", "Victory Briefs")).toBe(
      "Novice & Introductory",
    );
    expect(isSuperDebateVideo("Super duper debate", "Superb Debaters Club")).toBe(false);
    expect(forcedLectureCategory("Intro to Policy Debate", "Victory Briefs")).toBeNull();
    expect(lectureCategoryForChannel("SuperDebate")).toBe("Open Super Debates");
  });
});
