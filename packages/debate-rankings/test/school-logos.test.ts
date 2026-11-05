/**
 * @fileoverview Pins that a school's full official name, its " - Campus"
 * form, and common nicknames and typos resolve to the same logo as the short
 * name, while a different campus of a system does not borrow its logo.
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as schoolIcons from "@debate-ai/icons/schools";
import { getSchoolLogo, SCHOOL_LOGO_MAP } from "../src/leaderboard/lib/schoolLogos";

/** School logos live in `colleges/` and `high-schools/`; `organizations/` holds tournaments and leagues. */
const SCHOOL_PNGS = ["colleges", "high-schools"].flatMap((folder) =>
  readdirSync(fileURLToPath(new URL(`../../debate-icons/${folder}`, import.meta.url)))
    .filter((file) => file.endsWith(".png"))
    .map((file) => file.replace(/\.png$/, "")),
);

describe("getSchoolLogo", () => {
  it.each([
    ["University of Kansas", "Kansas"],
    ["California State University - Long Beach", "CSU Long Beach"],
    ["CSULB", "CSU Long Beach"],
    ["University of California - Berkeley", "UC Berkeley"],
    ["Cal", "UC Berkeley"],
    ["Berkeley", "UC Berkeley"],
    ["Western Kentucky University", "Western Kentucky"],
    ["Michigan State University", "Michigan State"],
    ["University of Michigan", "Michigan"],
    ["Dartmouth College", "Dartmouth"],
    ["Emory University", "Emory"],
    ["Georgetown University", "Georgetown"],
    ["Harvard University", "Harvard"],
    ["Northwestern University", "Northwestern"],
    ["University of Iowa", "Iowa"],
    ["Kentcuky", "Kentucky"],
    ["Wake", "Wake Forest"],
    ["Wake Forest University", "Wake Forest"],
    ["University of Texas - Austin", "Texas"],
    ["St Mark's School of Texas", "St. Marks"],
    ["St. Mark’s School of Texas", "St. Marks"],
    ["Bronx Science", "Bronx"],
    ["Bronx High School of Science", "Bronx"],
    ["The Bronx HS of Science", "Bronx"],
    ["Liberty University", "Liberty"],
    ["Lynbrook High School", "Lynbrook"],
    ["Lynbrook HS", "Lynbrook"],
    ["Plano West Senior High School", "Plano West"],
    ["USC", "Southern California"],
    ["University of Southern California", "Southern California"],
    ["Walter Payton College Prep", "Walter Payton"],
    ["Payton", "Walter Payton"],
    ["Montgomery Bell Academy", "Montgomery Bell"],
    ["MBA", "Montgomery Bell"],
    ["Glenbrook North High School", "Glenbrook North"],
    ["GBS", "Glenbrook South"],
    ["Harvard-Westlake School", "Harvard Westlake"],
    ["The Harker School", "Harker"],
    ["The Blake School", "Blake"],
    ["The Westminster Schools", "Westminster"],
    ["New Trier Township High School", "New Trier"],
    ["Strake Jesuit College Preparatory", "Strake Jesuit"],
    ["The College Preparatory School", "College Prep"],
    ["Marlborough School", "Marlborough"],
    ["Greenhill School", "Greenhill"],
    ["University of KY", "Kentucky"],
    ["UK", "Kentucky"],
    ["WFU", "Wake Forest"],
    ["University of Redlands", "Redlands"],
    ["George Mason University", "George Mason"],
    ["GMU", "George Mason"],
    ["University of Houston", "Houston"],
    ["Macalester College", "Macalester"],
    ["University of North Texas", "North Texas"],
    ["UNT", "North Texas"],
    ["Loyola University Chicago", "Loyola Chicago"],
    ["Loyola University - Chicago (IL)", "Loyola Chicago"],
    ["Whitney Young Magnet High School", "Whitney Young"],
    ["Whitney M. Young Magnet High School", "Whitney Young"],
  ])("resolves %s like %s", (long, short) => {
    expect(getSchoolLogo(short)).toBeTruthy();
    expect(getSchoolLogo(long)).toBe(getSchoolLogo(short));
  });

  it.each(SCHOOL_PNGS)("maps the %s.png logo", (name) => {
    expect(Object.values(SCHOOL_LOGO_MAP).length).toBeGreaterThan(0);
    expect(getSchoolLogo(name.replace(/-/g, " "))).toBeTruthy();
  });

  it("gives every school png its own map entry", () => {
    const missing = SCHOOL_PNGS.filter((name) => !getSchoolLogo(name));
    expect(missing).toEqual([]);
  });

  it("keeps another campus of a system off the flagship's logo", () => {
    expect(getSchoolLogo("University of Texas - Dallas")).toBe(getSchoolLogo("UT Dallas"));
    expect(getSchoolLogo("University of Texas - Dallas")).not.toBe(getSchoolLogo("Texas"));
    expect(getSchoolLogo("Old School Swing")).toBeNull();
    expect(getSchoolLogo("Kansas State")).toBeNull();
    expect(getSchoolLogo("Boston College")).toBeNull();
    expect(getSchoolLogo("Liberty Christian")).toBeNull();
  });

  it.each(["Loyola", "Loyola (CA)", "Loyola High School", "Loyola Marymount"])(
    "keeps %s off Loyola Chicago's logo",
    (name) => {
      expect(getSchoolLogo(name)).toBeNull();
    },
  );
});

describe("@debate-ai/icons/schools", () => {
  const pascalCase = (slug: string) =>
    slug.replace(/(?:^|-)(\w)/g, (_, letter: string) => letter.toUpperCase());

  it.each(["colleges", "high-schools", "organizations"].flatMap((folder) =>
    readdirSync(fileURLToPath(new URL(`../../debate-icons/${folder}`, import.meta.url)))
      .filter((file) => file.endsWith(".png"))
      .map((file) => [folder, file.replace(/\.png$/, "")]),
  ))("exports %s/%s.png by name", (_folder, name) => {
    const exportName = name === "debate-ai" ? "IconOrgDebateAi" : `IconSchool${pascalCase(name)}`;
    expect(schoolIcons[exportName as keyof typeof schoolIcons]).toBeTruthy();
  });
});
