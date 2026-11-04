/**
 * @fileoverview Pins that a school's full official name, its " - Campus"
 * form, and common nicknames and typos resolve to the same logo as the short
 * name, while a different campus of a system does not borrow its logo.
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getSchoolLogo, SCHOOL_LOGO_MAP } from "../src/leaderboard/lib/schoolLogos";

/** Tournament and league logos, which are not schools. */
const NOT_SCHOOLS = new Set(["toc", "nsda", "ndca"]);
const SCHOOL_PNGS = readdirSync(fileURLToPath(new URL("../../debate-icons/schools", import.meta.url)))
  .filter((file) => file.endsWith(".png"))
  .map((file) => file.replace(/\.png$/, ""))
  .filter((name) => !NOT_SCHOOLS.has(name));

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
    expect(getSchoolLogo("University of Texas - Dallas")).toBeNull();
    expect(getSchoolLogo("Old School Swing")).toBeNull();
    expect(getSchoolLogo("Macalester")).toBeNull();
    expect(getSchoolLogo("Kansas State")).toBeNull();
    expect(getSchoolLogo("Boston College")).toBeNull();
    expect(getSchoolLogo("Liberty Christian")).toBeNull();
  });
});
