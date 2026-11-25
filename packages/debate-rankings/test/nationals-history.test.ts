import { describe, expect, it } from "vitest";
import { findNationalsTeamFinishes, schoolNationals } from "../src/leaderboard/profile/nationalsHistory";
import { teamHref } from "../src/leaderboard/profile/rankingProfileHelpers";
import { schoolSeasonKey } from "../src/index";

describe("nationals team finishes", () => {
  it("finds a nationals-only team by the handle its school page links to", () => {
    const school = "St. Mark's School of Texas (TX)";
    const row = schoolNationals(school).rows.find((r) => r.competitors.includes("Steven Sklaver"));
    expect(row).toBeTruthy();
    const slug = teamHref({ school, name: row!.competitors }).slice(2);
    const finishes = findNationalsTeamFinishes(school, schoolSeasonKey(school), slug);
    expect(finishes.length).toBeGreaterThan(0);
    expect(finishes.every((r) => r.competitors.includes("Sklaver"))).toBe(true);
  });

  it("finds nothing for a handle no finish spells", () => {
    const school = "St. Mark's School of Texas (TX)";
    expect(findNationalsTeamFinishes(school, schoolSeasonKey(school), "st-mark-s-school-of-texas-tx-nobody-noone")).toEqual([]);
  });
});
