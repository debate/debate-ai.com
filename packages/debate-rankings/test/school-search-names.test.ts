/**
 * @fileoverview Pins the phrases a profile page searches round videos for: a
 * school's full name, the name with trailing filler dropped, circuit shorthand,
 * and for a team those followed by its initials.
 */

import { describe, expect, it } from "vitest";
import { schoolSearchNames, teamSearchNames } from "../src/team-lookup";

describe("schoolSearchNames", () => {
  it("drops trailing filler words", () => {
    expect(schoolSearchNames("Gunn HS Independent")).toEqual(["gunn hs independent", "gunn"]);
    expect(schoolSearchNames("The Harker School")).toEqual(["harker school", "harker"]);
    expect(schoolSearchNames("Russellville HS - Russellville, AR")).toEqual(["russellville hs", "russellville"]);
  });

  it("cuts at the first filler word and adds known shorthand", () => {
    expect(schoolSearchNames("Strake Jesuit College Preparatory")).toEqual([
      "strake jesuit college preparatory",
      "strake jesuit",
      "sj",
    ]);
    expect(schoolSearchNames("Glenbrook North")).toEqual(["glenbrook north", "gbn"]);
  });

  it("keeps a name made only of filler whole", () => {
    expect(schoolSearchNames("College Prep")).toEqual(["college prep"]);
    expect(schoolSearchNames("")).toEqual([]);
  });
});

describe("teamSearchNames", () => {
  it("pairs each school name with the team's initials in either order", () => {
    expect(teamSearchNames({ school: "Strake Jesuit", name: "Falk & Sabnani" })).toEqual([
      "strake jesuit fs",
      "strake jesuit sf",
      "sj fs",
      "sj sf",
    ]);
  });

  it("also matches a single debater by full name", () => {
    expect(teamSearchNames({ school: "Harker", name: "Siddhartha Daswani" })).toEqual([
      "siddhartha daswani",
      "harker sd",
      "harker ds",
    ]);
  });
});
