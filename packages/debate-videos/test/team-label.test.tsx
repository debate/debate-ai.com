/**
 * @fileoverview Pins the site-wide team label: a pill bordered blue (aff, and
 * the default) or red (neg) holding the school's logo — or its name when it
 * has none — then the debaters' last names, or the code's initials.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

const { TeamCodeLabel, TeamLabel, teamRankStats } = await import("@debate-ai/rankings/src/leaderboard/team-label/TeamLabel");

describe("TeamCodeLabel", () => {
  it("shows the school logo and the ranked debaters' last names", () => {
    const html = renderToStaticMarkup(
      createElement(TeamCodeLabel, { label: "Harker LL", ranking: { school: "Harker", name: "Le & Luo" }, side: "neg" }),
    );
    expect(html).toMatch(/<img[^>]*harker\.png/);
    expect(html).toContain('<span class="sr-only">Harker</span>');
    expect(html).toContain("Le &amp; Luo");
    expect(html).not.toContain(">LL<");
    expect(html).toContain('data-side="neg"');
    expect(html).toContain("border-red-500/80");
    // A side gets a mostly white surface with a faint tint, not a solid color.
    expect(html).toContain("bg-red-50/95");
    // With a logo the names go on a second row under it.
    expect(html).toContain("data-stacked");
    expect(html).toContain("flex-col");
  });

  it("falls back to the school's name and the code's initials", () => {
    const html = renderToStaticMarkup(createElement(TeamCodeLabel, { label: "Nowhere High AB", side: "aff" }));
    expect(html).not.toContain("<img");
    expect(html).toContain('<span class="truncate">Nowhere High</span>');
    expect(html).toContain(">AB</span>");
    expect(html).toContain("border-blue-500/80");
    // No logo: school name on first row, initials on second.
    expect(html).toContain("data-stacked");
    expect(html).toContain("flex-col");
  });
});

describe("TeamLabel", () => {
  it("uses the aff blue with no side, links each part, and drops its border when bare", () => {
    const html = renderToStaticMarkup(
      createElement(TeamLabel, { school: "Nowhere High", debaters: "Doe & Roe", href: "/@nowhere-dr", schoolHref: "/schools/nowhere-high" }),
    );
    expect(html).toContain("border-blue-500/80");
    expect(html).toContain('href="/@nowhere-dr"');
    expect(html).toContain('href="/schools/nowhere-high"');
    const bare = renderToStaticMarkup(createElement(TeamLabel, { school: "Nowhere High", debaters: "DR", side: "neg", bare: true }));
    expect(bare).not.toContain("border-red-500/80");
    // No side (rankings, profiles): no tinted surface.
    expect(html).not.toContain("bg-blue-50/95");
    expect(renderToStaticMarkup(createElement(TeamLabel, {}))).toBe("");
  });
});

describe("rank badge", () => {
  const ranking = {
    school: "Nowhere High",
    name: "Vadathavoor & Sridharan",
    rank: 7,
    adjustedRating: 81.25,
    deviation: 3.4,
    matches: 42,
    affWinRate: 60,
    negWinRate: 55.5,
  } as never;

  it("sits inside the pill and never truncates the last names", () => {
    const html = renderToStaticMarkup(createElement(TeamCodeLabel, { label: "Nowhere VS", ranking, side: "neg", showRank: true }));
    const pill = html.indexOf("data-team-label");
    const badge = html.indexOf("data-team-rank");
    expect(pill).toBeGreaterThanOrEqual(0);
    expect(badge).toBeGreaterThan(pill);
    expect(html).toContain(">#7</span>");
    expect(html).toContain("bg-red-600");
    expect(html).toContain("Vadathavoor &amp; Sridharan");
    expect(html).not.toMatch(/class="[^"]*truncate[^"]*font-medium/);
    // Without showRank (or a rank), no badge.
    expect(renderToStaticMarkup(createElement(TeamCodeLabel, { label: "Nowhere VS", ranking }))).not.toContain("data-team-rank");
  });

  it("lists the team's stats for the tooltip", () => {
    expect(teamRankStats(ranking)).toEqual([
      ["Rank", "#7"],
      ["Rating", "81.3 ±3.4"],
      ["Rounds", "42"],
      ["Win % aff / neg", "60% / 55.5%"],
    ]);
  });
});

describe("VideoTeamRankingContext", () => {
  it("gives a card's team badge the grid's rankings row, so it prints last names", async () => {
    const { VideoTeamRankingContext, useContextTeamRanking } = await import("../src/hooks/useVideoTeamRankings");
    const video = ["vid"] as never;
    function Badge() {
      const ranking = useContextTeamRanking(video, "Harker LL");
      return createElement(TeamCodeLabel, { label: "Harker LL", ranking, side: "aff", bare: true });
    }
    const lookup = (_v: unknown, team: string | null | undefined) =>
      team === "Harker LL" ? ({ school: "Harker", name: "Le & Luo" } as never) : null;
    const inGrid = renderToStaticMarkup(createElement(VideoTeamRankingContext.Provider, { value: lookup }, createElement(Badge)));
    expect(inGrid).toContain("Le &amp; Luo");
    // Outside a grid there is no lookup, so the code's initials show.
    expect(renderToStaticMarkup(createElement(Badge))).toContain(">LL</span>");
  });
});
