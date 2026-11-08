/**
 * @fileoverview Pins that every mascot thumbnail is mapped, and that a
 * school's long names and nicknames find the same mascot as its short name.
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as mascotIcons from "@debate-ai/icons/mascots";
import { getSchoolMascot, SCHOOL_MASCOT_MAP } from "../src/leaderboard/lib/schoolMascots";

const THUMBS = readdirSync(fileURLToPath(new URL("../../debate-icons/mascots/thumbs", import.meta.url)))
  .filter((file) => file.endsWith(".webp"))
  .map((file) => file.replace(/\.webp$/, ""));

describe("getSchoolMascot", () => {
  it("maps and exports every thumbnail", () => {
    expect(THUMBS.length).toBeGreaterThan(0);
    expect([...THUMBS].sort()).toEqual(
      Object.keys(SCHOOL_MASCOT_MAP).filter((k) => THUMBS.includes(k)).sort()
    );
    expect(Object.keys(mascotIcons)).toHaveLength(THUMBS.length);
  });

  it.each([
    ["University of Kansas", "kansas"],
    ["Kansas", "kansas"],
    ["Wake", "wake-forest"],
    ["Wake Forest University", "wake-forest"],
    ["Cal", "uc-berkeley"],
    ["University of California - Berkeley", "uc-berkeley"],
    ["University of Texas - Austin", "texas"],
    ["University of Texas at Austin", "texas"],
    ["The University of Texas at Austin", "texas"],
    ["Texas-Austin", "texas"],
    ["UT Austin", "texas"],
    ["Michigan St", "michigan-state"],
    ["OU", "oklahoma"],
    ["Michigan State University", "michigan-state"],
    ["University of Michigan", "michigan"],
    ["Dartmouth College", "dartmouth"],
  ])("finds %s", (school, key) => {
    expect(getSchoolMascot(school)).toBe(SCHOOL_MASCOT_MAP[key]);
  });

  it("leaves schools without a mascot, and other campuses, without one", () => {
    expect(getSchoolMascot("Harvard University")).toBeNull();
    expect(getSchoolMascot("University of Texas - Dallas")).toBeNull();
    expect(getSchoolMascot("University of Texas at Dallas")).toBeNull();
    expect(getSchoolMascot("Kansas State University")).toBeNull();
    expect(getSchoolMascot("")).toBeNull();
    expect(getSchoolMascot(null)).toBeNull();
  });
});
