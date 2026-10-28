import { describe, expect, it } from "vitest";
import {
  findTocSchoolRecord,
  TOC_EVENTS,
  TOC_RESULTS,
  tocRecordsBySchool,
  tocSchoolKey,
} from "@debate-ai/data-sync/src/rankings/toc-champions";

describe("Tournament of Champions history", () => {
  it("has one champion per event and year, except close-outs and shared titles", () => {
    const champions = TOC_RESULTS.filter((r) => r.place === "Champion");
    const keys = champions.map((r) => `${r.event} ${r.year}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(TOC_RESULTS.filter((r) => r.place === "Co-champion").map((r) => `${r.event} ${r.year}`)).toEqual([
      "Lincoln-Douglas 1988",
      "Lincoln-Douglas 1988",
      "Lincoln-Douglas 2011",
      "Lincoln-Douglas 2011",
      "Public Forum 2006",
      "Public Forum 2006",
    ]);
  });

  it("covers every event, policy from 1972 with a top speaker each year", () => {
    expect(new Set(TOC_RESULTS.map((r) => r.event))).toEqual(new Set(TOC_EVENTS));
    const policy = TOC_RESULTS.filter((r) => r.event === "Policy" && r.place === "Champion").map((r) => r.year);
    expect(Math.min(...policy)).toBe(1972);
    expect(Math.max(...policy)).toBe(2026);
    expect(TOC_RESULTS.filter((r) => r.place === "Top speaker")).toHaveLength(2026 - 1972 + 1);
  });

  it("counts a school's titles, runner-ups and top speakers across events", () => {
    const greenhill = findTocSchoolRecord("Greenhill");
    expect(greenhill?.school).toBe("Greenhill School (TX)");
    expect(greenhill?.events).toEqual([
      "Policy",
      "Lincoln-Douglas",
      "World Schools",
      "Oral Interpretation",
      "Program Oral Interpretation",
    ]);
    expect(greenhill?.titles).toBe(11);
    expect(greenhill?.runnerUps).toBe(4);
    expect(greenhill?.topSpeakers).toBe(1);

    const mba = findTocSchoolRecord("Montgomery Bell");
    expect(mba?.titles).toBe(3);
    expect(mba?.runnerUps).toBe(3);
    expect(mba?.topSpeakers).toBe(3);
  });

  it("merges a school's spellings into one record", () => {
    expect(tocSchoolKey("The Bronx High School of Science (NY)")).toBe(tocSchoolKey("Bronx Science"));
    expect(findTocSchoolRecord("Bronx Science")?.results).toHaveLength(12);
    expect(findTocSchoolRecord("Harvard Westlake")?.school).toBe("Harvard-Westlake School (CA)");
    expect(findTocSchoolRecord("Harvard-Westlake")?.results.find((r) => r.year === 1990)?.formerName).toBe(
      "Harvard School",
    );
    expect(findTocSchoolRecord("Strake Jesuit College Prep")?.titles).toBe(3);
    expect(findTocSchoolRecord("NSU")?.school).toBe("NSU University School (FL)");
    expect(findTocSchoolRecord("University School (FL)")?.school).toBe("NSU University School (FL)");
    expect(findTocSchoolRecord("Harker")?.titles).toBe(6);
    expect(findTocSchoolRecord("West Des Moines Valley")?.school).toBe("Valley High School (IA)");
    expect(findTocSchoolRecord("Chicago Labs")?.topSpeakers).toBe(1);
    expect(findTocSchoolRecord("Whitney Young")?.runnerUps).toBe(1);
  });

  it("tells same-named schools apart by state, and never guesses", () => {
    expect(findTocSchoolRecord("Lexington")?.school).toBe("Lexington High School (MA)");
    expect(findTocSchoolRecord("Westwood")?.school).toBe("Westwood High School (TX)");
    expect(findTocSchoolRecord("Highland Park (MN)")?.titles).toBe(1);
    expect(findTocSchoolRecord("Highland Park (TX)")?.runnerUps).toBe(1);
    expect(findTocSchoolRecord("Highland Park")).toBeNull();
    expect(findTocSchoolRecord("University")).toBeNull();
    expect(findTocSchoolRecord("University School (OH)")?.runnerUps).toBe(1);
    expect(findTocSchoolRecord("Lexington (KY)")).toBeNull();
    expect(findTocSchoolRecord("St Thomas")).toBeNull();
    expect(findTocSchoolRecord("St. Thomas Academy (MN)")?.topSpeakers).toBe(1);
    expect(findTocSchoolRecord("Stratford")).toBeNull();
  });

  it("never credits a different school that shares words", () => {
    expect(findTocSchoolRecord("Montgomery")).toBeNull();
    expect(findTocSchoolRecord("Westlake")?.school).toBe("Westlake (TX)");
    expect(findTocSchoolRecord("American Heritage Palm Beach")).toBeNull();
    expect(findTocSchoolRecord("Valley Christian")).toBeNull();
    expect(findTocSchoolRecord("Glenbrook North")?.school).not.toBe(findTocSchoolRecord("Glenbrook South")?.school);
    expect(findTocSchoolRecord("Harvard University (MA)")).toBeNull();
    expect(findTocSchoolRecord("Georgetown")).toBeNull();
  });

  it("gives every school one record", () => {
    const records = tocRecordsBySchool();
    expect(new Set(records.map((r) => r.school)).size).toBe(records.length);
    expect(records.reduce((sum, r) => sum + r.results.length, 0)).toBe(TOC_RESULTS.length);
  });
});
