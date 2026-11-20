import { describe, expect, it } from "vitest";
import { findNdtSchoolHistory } from "../src/leaderboard/profile/rankingProfileHelpers";
import { findTeamRanking, schoolLevel, schoolMatchScore } from "../src/team-lookup";
import type { RankingEntry } from "../src/upstream";

describe("schoolLevel", () => {
  it("reads high school and college markers, high school first", () => {
    expect(schoolLevel("Harvard-Westlake School")).toBe("high-school");
    expect(schoolLevel("Strake Jesuit College Prep")).toBe("high-school");
    expect(schoolLevel("University High School")).toBe("high-school");
    expect(schoolLevel("Harvard University (MA)")).toBe("college");
    expect(schoolLevel("Boston College")).toBe("college");
    expect(schoolLevel("Harvard")).toBeNull();
    expect(schoolLevel("Naval Academy")).toBeNull();
  });
});

describe("schoolMatchScore keeps Harvard and Harvard-Westlake apart", () => {
  it("never matches Harvard to Harvard-Westlake, however it is spelled", () => {
    for (const hw of ["Harvard-Westlake", "Harvard-Westlake School", "Harvard Westlake", "HW"]) {
      expect(schoolMatchScore("Harvard", hw)).toBe(0);
      expect(schoolMatchScore(hw, "Harvard")).toBe(0);
      expect(schoolMatchScore("Harvard University", hw)).toBe(0);
    }
  });

  it("still matches every spelling of Harvard-Westlake to itself", () => {
    expect(schoolMatchScore("Harvard Westlake", "Harvard-Westlake School")).toBe(3);
    expect(schoolMatchScore("HW", "Harvard-Westlake")).toBe(3);
    expect(schoolMatchScore("Harvard", "Harvard University")).toBeGreaterThan(0);
  });

  it("never matches a college to a high school of the same name", () => {
    expect(schoolMatchScore("Bellarmine University", "Bellarmine College Prep")).toBe(0);
    expect(schoolMatchScore("Georgetown University", "Georgetown Day School")).toBe(0);
    expect(schoolMatchScore("Bellarmine", "Bellarmine College Prep")).toBe(3);
  });

  it("keeps the loose matches that are right", () => {
    expect(schoolMatchScore("Fremd", "William Fremd")).toBe(1);
    expect(schoolMatchScore("MBA", "Montgomery Bell Academy")).toBe(2);
  });
});

describe("Harvard-Westlake in lookups", () => {
  const entry = (school: string, name: string, rank: number) => ({ school, name, rank }) as RankingEntry;

  it("finds a Harvard-Westlake team, never a Harvard one, from a video label", () => {
    const entries = [entry("Harvard", "Anna Lee & Ben Lo", 1), entry("Harvard-Westlake School", "Cara Lee & Dan Lo", 5)];
    expect(findTeamRanking(entries, "Harvard Westlake LL")?.name).toBe("Cara Lee & Dan Lo");
    expect(findTeamRanking(entries, "Harvard LL")?.name).toBe("Anna Lee & Ben Lo");
  });

  it("never hands Harvard's NDT record to Harvard-Westlake", () => {
    const ndt = [{ school: "Harvard University (MA)" }, { school: "University of Michigan (MI)" }];
    expect(findNdtSchoolHistory(ndt, "Harvard")?.school).toBe("Harvard University (MA)");
    expect(findNdtSchoolHistory(ndt, "Harvard-Westlake")).toBeNull();
    expect(findNdtSchoolHistory(ndt, "Harvard Westlake")).toBeNull();
    expect(findNdtSchoolHistory(ndt, "Harvard-Westlake School")).toBeNull();
  });
});
