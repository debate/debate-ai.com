/**
 * @fileoverview Pins that a school's full official name, its " - Campus"
 * form, and common nicknames and typos resolve to the same logo as the short
 * name, while a different campus of a system does not borrow its logo.
 */

import { describe, it, expect } from "vitest";
import { getSchoolLogo } from "../src/leaderboard/lib/schoolLogos";

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
  ])("resolves %s like %s", (long, short) => {
    expect(getSchoolLogo(short)).toBeTruthy();
    expect(getSchoolLogo(long)).toBe(getSchoolLogo(short));
  });

  it("keeps another campus of a system off the flagship's logo", () => {
    expect(getSchoolLogo("University of Texas - Dallas")).toBeNull();
    expect(getSchoolLogo("Old School Swing")).toBeNull();
    expect(getSchoolLogo("Macalester")).toBeNull();
  });
});
