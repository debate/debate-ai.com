import { describe, expect, it } from "vitest";
import { parseNdtSchoolHistory } from "@debate-ai/data-sync/src/rankings/ndt-school-history";
import { findNdtSchoolHistory } from "../src/panels/leaderboard/profile/rankingProfileHelpers";

const HTML = `
<button class="accordion" aria-expanded="false">Harvard University (MA)</button>
<div class="panel" hidden="">
  <div class="section"><p><strong>Years in Attendance (2): </strong>
    <a href="x">1950</a> <a href="y">1961</a></p></div>
  <div class="section"><strong>Elim Qualifiers (1):</strong><ul><li>
    <a href="x">1961</a> Octas - Gene Clements &amp; Laurence Tribe (6-2, Seed: 5)</li></ul></div>
  <div class="section"><strong>Speaker Awards (1):</strong><ul><li>
    <a href="x">1954</a> - Robert O'Neil ( 11 )</li></ul></div>
  <div class="section"><strong>Coaching Awards (1):</strong><ul><li>
    1990 - Dallas Perkins - Ross K. Smith National Coach of the Year</li></ul></div>
</div>
<button class="accordion" aria-expanded="false">Michigan State University (MI)</button>
<div class="panel" hidden=""><div class="section"><p><strong>Years in Attendance (1): </strong><a href="x">1970</a></p></div></div>
<button class="accordion" aria-expanded="false">University of Michigan (MI)</button>
<div class="panel" hidden=""><div class="section"><p><strong>Years in Attendance (1): </strong><a href="x">1971</a></p></div></div>
`;

describe("parseNdtSchoolHistory", () => {
  const schools = parseNdtSchoolHistory(HTML);

  it("reads every school and its attendance", () => {
    expect(schools.map((s) => s.school)).toEqual([
      "Harvard University (MA)",
      "Michigan State University (MI)",
      "University of Michigan (MI)",
    ]);
    expect(schools[0].years).toEqual([1950, 1961]);
  });

  it("reads elims, speaker and coaching awards", () => {
    expect(schools[0].elims).toEqual([
      { year: 1961, team: "Gene Clements & Laurence Tribe", round: "Octas", record: "6-2", seed: 5 },
    ]);
    expect(schools[0].speakerAwards).toEqual([{ year: 1954, speaker: "Robert O'Neil", rank: 11 }]);
    expect(schools[0].coachingAwards[0]).toEqual({
      year: 1990,
      coach: "Dallas Perkins",
      award: "Ross K. Smith National Coach of the Year",
    });
  });

  it("matches ranking school names to NDT names", () => {
    expect(findNdtSchoolHistory(schools, "Harvard")?.school).toBe("Harvard University (MA)");
    expect(findNdtSchoolHistory(schools, "Michigan")?.school).toBe("University of Michigan (MI)");
    expect(findNdtSchoolHistory(schools, "Michigan State")?.school).toBe("Michigan State University (MI)");
    expect(findNdtSchoolHistory(schools, "Yale")).toBeNull();
  });

  it("prefers the university over a same-named college unless the name says College", () => {
    const named = [
      { school: "Boston College (MA)" },
      { school: "Boston University (MA)" },
      { school: "Georgetown College (KY)" },
      { school: "Georgetown University (DC)" },
    ];
    expect(findNdtSchoolHistory(named, "Georgetown")?.school).toBe("Georgetown University (DC)");
    expect(findNdtSchoolHistory(named, "Georgetown University")?.school).toBe("Georgetown University (DC)");
    expect(findNdtSchoolHistory(named, "Georgetown College")?.school).toBe("Georgetown College (KY)");
    expect(findNdtSchoolHistory(named, "Boston College")?.school).toBe("Boston College (MA)");
    expect(findNdtSchoolHistory(named, "Boston University")?.school).toBe("Boston University (MA)");
  });
});
