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

const { TeamCodeLabel, TeamLabel } = await import("../src/components/team-label/TeamLabel");

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
    // No logo: school name and initials share one line.
    expect(html).not.toContain("data-stacked");
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
    expect(renderToStaticMarkup(createElement(TeamLabel, {}))).toBe("");
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
