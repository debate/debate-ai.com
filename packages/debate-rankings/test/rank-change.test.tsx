/**
 * @fileoverview Pins the +/− column: places moved since last season, "new"
 * for teams and schools not ranked last season, and the column showing only
 * when last season's list is given.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  buildRankChanges,
  formatRankChange,
  schoolRankChangeKey,
  teamRankChangeKey,
} from "../src/leaderboard/rankChange";
import { SchoolRankingsTable } from "../src/leaderboard/SchoolRankingsTable";
import { sortSchools } from "../src/leaderboard/leaderboardUtils";
import type { SchoolRanking } from "../src/leaderboard/leaderboardTypes";

const school = (rank: number, name: string): SchoolRanking => ({
  rank,
  school: name,
  bestRating: 90,
  bestEntry: "Doe & Roe",
  bestEvent: "PF",
  avgRating: 80,
  balancedScore: 85,
  teams: 3,
  events: ["PF"],
});

describe("buildRankChanges", () => {
  const current = [school(1, "Strake Jesuit"), school(2, "Harvard-Westlake"), school(3, "Newcomer High")];
  const previous = [school(1, "Harvard Westlake"), school(5, "Strake Jesuit"), school(3, "Gone Prep")];
  const changes = buildRankChanges(current, previous, schoolRankChangeKey);

  it("counts places moved up as positive and down as negative", () => {
    expect(changes.get(schoolRankChangeKey(current[0]))).toBe(4);
    expect(changes.get(schoolRankChangeKey(current[1]))).toBe(-1);
  });

  it("marks schools missing last season as new", () => {
    expect(changes.get(schoolRankChangeKey(current[2]))).toBeNull();
    expect(changes.size).toBe(3);
  });

  it("matches teams whatever order the partners are listed in", () => {
    const team = buildRankChanges(
      [{ rank: 2, school: "Lexington", name: "Smith & Lee" }],
      [{ rank: 10, school: "Lexington", name: "Lee & Smith" }],
      teamRankChangeKey,
    );
    expect([...team.values()]).toEqual([8]);
  });
});

describe("formatRankChange", () => {
  it("prints +8, -4, 0 and new", () => {
    expect(formatRankChange(8)).toBe("+8");
    expect(formatRankChange(-4)).toBe("-4");
    expect(formatRankChange(0)).toBe("0");
    expect(formatRankChange(null)).toBe("new");
  });
});

describe("sortSchools by rank change", () => {
  it("sorts the biggest climbers first and new schools last", () => {
    const rows = [school(1, "A"), school(2, "B"), school(3, "C")];
    const changes = new Map([
      ["a", -2],
      ["b", null],
      ["c", 6],
    ]);
    const sorted = sortSchools(rows, { key: "rankChange", dir: "desc" }, (r) => changes.get(schoolRankChangeKey(r)) ?? null);
    expect(sorted.map((r) => r.school)).toEqual(["C", "A", "B"]);
  });
});

describe("SchoolRankingsTable +/− column", () => {
  const rows = [school(1, "Strake Jesuit"), school(2, "Newcomer High")];
  const render = (rankChanges?: Map<string, number | null>) =>
    renderToStaticMarkup(
      createElement(SchoolRankingsTable, {
        rows,
        legendary: 0,
        sort: { key: "rank", dir: "asc" },
        onToggleSort: () => {},
        rankChanges,
      }),
    );

  it("shows each school's change, or new", () => {
    const html = render(new Map([["strake jesuit", 8], ["newcomer high", null]]));
    expect(html).toContain("+/−");
    expect(html).toContain(">+8<");
    expect(html).toContain(">new<");
    expect(html).toContain("Up 8 places from last season");
  });

  it("hides the column without last season's list", () => {
    expect(render()).not.toContain("+/−");
  });
});
