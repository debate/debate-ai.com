import { describe, expect, it } from "vitest";
import { teamDisplayParts } from "../src/team-display";

describe("teamDisplayParts", () => {
  it("uses the debaters' last names and the rankings school when the team is known", () => {
    expect(teamDisplayParts({ label: "Harker LL", school: "Harker", name: "Le & Luo" })).toEqual({
      school: "Harker",
      debaters: "Le & Luo",
    });
    expect(teamDisplayParts({ school: "Strake Jesuit", name: "Siddhartha Daswani" })).toEqual({
      school: "Strake Jesuit",
      debaters: "Daswani",
    });
  });

  it("falls back to the code's school and initials", () => {
    expect(teamDisplayParts({ label: " William  Fremd IB " })).toEqual({ school: "William Fremd", debaters: "IB" });
  });

  it("treats a label with no initials as a school", () => {
    expect(teamDisplayParts({ label: "Boston College" })).toEqual({ school: "Boston College", debaters: null });
    expect(teamDisplayParts({})).toEqual({ school: null, debaters: null });
  });
});
