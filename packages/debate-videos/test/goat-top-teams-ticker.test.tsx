/**
 * @fileoverview The Greatest of All-Time ticker: each top team links to its
 * page with a "#N All Time" badge and its years, drawn twice for the loop.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GoatTopTeamsTickerRow,
  teamYears,
} from "../src/components/navigation/category-gallery/GoatTopTeamsTicker";
import type { NdtAllTimeTopTeam } from "@debate-ai/rankings/src/leaderboard/profile/ndtAllTimeRanks";

const team: NdtAllTimeTopTeam = {
  rank: 2,
  school: "Northwestern University (IL)",
  schoolName: "Northwestern",
  team: "Alex Miles & Arjun Vellayappan",
  debaters: "Miles & Vellayappan",
  firstYear: 2014,
  lastYear: 2015,
  total: 123.75,
  href: "/@northwestern-miles-vellayappan",
};

describe("GoatTopTeamsTickerRow", () => {
  it("links each team to its page with its rank badge, last names and years", () => {
    const html = renderToStaticMarkup(<GoatTopTeamsTickerRow teams={[team]} />);
    expect(html).toContain('href="/@northwestern-miles-vellayappan"');
    expect(html).toContain("#2 All Time");
    expect(html).toContain("Miles &amp; Vellayappan");
    expect(html).toContain("2014–2015");
  });

  it("draws a hidden, unfocusable copy for the seamless loop and stops for reduced motion", () => {
    const html = renderToStaticMarkup(<GoatTopTeamsTickerRow teams={[team]} />);
    expect(html.match(/href="\/@northwestern-miles-vellayappan"/g)).toHaveLength(2);
    expect(html).toMatch(/<ul class="goat-ticker-copy flex" aria-hidden="true">/);
    expect(html).toContain('tabindex="-1"');
    expect(html).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*\.goat-ticker-track \{ animation: none; \}/);
  });

  it("renders nothing before the teams load", () => {
    expect(renderToStaticMarkup(<GoatTopTeamsTickerRow teams={[]} />)).toBe("");
  });
});

describe("teamYears", () => {
  it("shows a range, or one year for a single NDT", () => {
    expect(teamYears({ firstYear: 2014, lastYear: 2015 })).toBe("2014–2015");
    expect(teamYears({ firstYear: 2025, lastYear: 2025 })).toBe("2025");
  });
});
