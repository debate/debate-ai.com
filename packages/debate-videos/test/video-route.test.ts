/**
 * @fileoverview The canonical video address: `/videos/<season>/<tournament>/<round>/<teams>`
 * for a tagged round, `/videos/<season>/<event>/<matchup>` for anything else.
 *
 * What is pinned here is what a URL scheme has to guarantee to be worth
 * changing to:
 *   - the season comes from the *season*, not the upload date, or a March
 *     final files under the wrong year;
 *   - stale segments are detected, so a corrected title or tournament
 *     redirects instead of leaving two addresses for one video;
 *   - the matchup segment stays bounded, however many arguments a round has.
 */

import { describe, expect, it } from "vitest";
import {
  eventSegment,
  isCanonicalVideoRoute,
  legacyVideoRouteHref,
  previousVideoRouteHref,
  matchupSegment,
  parseRoundTitle,
  parseVideoRouteMatchup,
  seasonSegment,
  teamsSegment,
  videoRouteHref,
  videoRouteParts,
  videoRouteSegments,
} from "../src/lib/video-route";
import type { VideoType } from "../src/types/videos";

/** A fully tagged college round, as the feed hands one over. */
const ndtFinal: VideoType = [
  "dQw4w9WgXcQ",
  "2006 NDT Finals — Northwestern vs Michigan State",
  "2006-03-27",
  "Debate Archive",
  48_000,
  "The final round of the 2006 National Debate Tournament.",
  4,
  "2006 NDT",
  "Finals",
  "Northwestern GW",
  "Michigan State BP",
  true,
  "4-1",
  null,
  null,
  true,
  null,
  2006,
];

describe("videoRouteSegments", () => {
  it("files a round under its season, tournament, round and teams", () => {
    expect(videoRouteSegments(videoRouteParts(ndtFinal))).toEqual({
      season: "2006",
      event: "ndt",
      matchup: "finals",
      teams: "northwestern-gw-michigan-state-bp",
    });
  });

  it("builds the whole path from a tuple", () => {
    expect(videoRouteHref(ndtFinal)).toBe("/videos/2006/ndt/finals/northwestern-gw-michigan-state-bp");
  });

  it("falls back to the format for a round with no tournament", () => {
    expect(
      videoRouteHref({
        videoId: "abcdefghijk",
        title: "t",
        seasonYear: 2022,
        style: 4,
        roundLevel: "Semifinals",
        affTeam: "Dartmouth SV",
      }),
    ).toBe("/videos/2022/college/semifinals/dartmouth-sv");
  });

  it("keeps three segments for a video with no round or no teams", () => {
    expect(
      videoRouteHref({
        videoId: "abcdefghijk",
        title: "How to give a 2NR",
        seasonYear: 2019,
        style: "Kritik / Critical Theory",
      }),
    ).toBe("/videos/2019/kritik-critical-theory/how-to-give-a-2nr");
    expect(
      videoRouteHref({
        videoId: "abcdefghijk",
        title: "t",
        seasonYear: 2022,
        style: 4,
        tournament: "NDT",
        affTeam: "Dartmouth SV",
        negTeam: "Michigan PR",
      }),
    ).toBe("/videos/2022/college-ndt/dartmouth-sv-vs-michigan-pr");
  });
});

describe("parseRoundTitle", () => {
  it("reads year, tournament, round and teams out of a title", () => {
    expect(
      parseRoundTitle(
        "2022 NDT Finals - Dartmouth SV vs Michigan PR  - Round Analysis Infographic for Classrooms",
      ),
    ).toEqual({
      season: "2022",
      tournament: "NDT",
      round: "Finals",
      affTeam: "Dartmouth SV",
      negTeam: "Michigan PR",
    });
  });

  it("handles bracketed years, pipes and side labels", () => {
    expect(parseRoundTitle("[2026] Tournament of Champions Round 6 - Lynbrook BZ vs Peninsula SU [1/2]")).toMatchObject({
      tournament: "Tournament of Champions",
      round: "Round 6",
      affTeam: "Lynbrook BZ",
      negTeam: "Peninsula SU",
    });
    expect(
      parseRoundTitle(
        "Round Analysis | Glenbrooks 2016 Quarters Ardrey Kell KM (Aff) vs Mission KM | Public Forum Debate",
      ),
    ).toMatchObject({ season: "2016", tournament: "Glenbrooks", affTeam: "Ardrey Kell KM", negTeam: "Mission KM" });
    expect(
      parseRoundTitle("2015 Tournament of Champions LD Quarters Sacred Heart AT vs. University DB Round Analysis"),
    ).toMatchObject({ negTeam: "University DB" });
  });

  it("leaves a lecture alone", () => {
    expect(parseRoundTitle("DDI 2020 - Cap K vs Critical Affs - Garrett")).toBeNull();
    expect(parseRoundTitle("Non-Framework Strategies vs K Affs")).toBeNull();
    expect(parseRoundTitle("2019 November December Practice Round Pranav (Aff) vs Elijah (Neg)")).toBeNull();
  });
});

describe("videoRouteHref for untagged videos", () => {
  it("gives a lecture whose title is a round the round's shape, marked with its category", () => {
    expect(
      videoRouteHref({
        videoId: "Afl7_hl-H0c",
        title: "2022 NDT Finals - Dartmouth SV vs Michigan PR  - Round Analysis Infographic for Classrooms",
        seasonYear: 2027,
        style: "Round Analysis",
      }),
    ).toBe("/videos/2022/ndt/finals/dartmouth-sv-michigan-pr/analysis");
  });

  it("gives each part of a round uploaded in pieces its own address", () => {
    const part = (n: number) =>
      videoRouteHref({
        videoId: "abcdefghijk",
        title: `2025 Shirley - Finals - Emory GS vs Kansas LS - Part ${n}`,
        seasonYear: 2025,
        style: 4,
        tournament: "Shirley",
        roundLevel: "Finals",
        affTeam: "Emory GS",
        negTeam: "Kansas LS",
      });
    expect(part(1)).toBe("/videos/2025/shirley/finals/emory-gs-kansas-ls/part-1");
    expect(part(2)).toBe("/videos/2025/shirley/finals/emory-gs-kansas-ls/part-2");
  });

  it("drops a year trailing the tournament name", () => {
    expect(
      videoRouteHref({
        videoId: "abcdefghijk",
        title: "t",
        seasonYear: 2026,
        style: 4,
        tournament: "NDT 2026",
        roundLevel: "Octafinals",
        affTeam: "Michigan State GL",
        negTeam: "Dartmouth CG",
      }),
    ).toBe("/videos/2026/ndt/octafinals/michigan-state-gl-dartmouth-cg");
  });
});

describe("legacyVideoRouteHref", () => {
  it("rebuilds the three-segment path a round had before", () => {
    expect(legacyVideoRouteHref(ndtFinal)).toBe(
      "/videos/2006/college-ndt/northwestern-gw-vs-michigan-state-bp-finals",
    );
  });
});

describe("previousVideoRouteHref", () => {
  it("rebuilds the four-segment path whose teams carried vs and the variant", () => {
    expect(previousVideoRouteHref(ndtFinal)).toBe(
      "/videos/2006/ndt/finals/northwestern-gw-vs-michigan-state-bp",
    );
    expect(
      previousVideoRouteHref({
        videoId: "Afl7_hl-H0c",
        title: "2022 NDT Finals - Dartmouth SV vs Michigan PR  - Round Analysis Infographic for Classrooms",
        seasonYear: 2027,
        style: "Round Analysis",
      }),
    ).toBe("/videos/2022/ndt/finals/dartmouth-sv-vs-michigan-pr-round-analysis");
    expect(
      previousVideoRouteHref({ videoId: "x", title: "How to give a 2NR", style: "Kritik" }),
    ).toBeNull();
  });
});

describe("teamsSegment", () => {
  it("names both teams, or the one recorded", () => {
    expect(teamsSegment({ videoId: "x", title: "t", affTeam: "Dartmouth SV", negTeam: "Michigan PR" })).toBe(
      "dartmouth-sv-michigan-pr",
    );
    expect(teamsSegment({ videoId: "x", title: "t", negTeam: "Michigan PR" })).toBe("michigan-pr");
    expect(teamsSegment({ videoId: "x", title: "t" })).toBe("");
  });
});

describe("seasonSegment", () => {
  it("prefers the season over the publish date", () => {
    // A round debated in March 2006 belongs to the 2005-06 season, and an
    // upload posted months later still does.
    expect(seasonSegment({ videoId: "x", title: "t", date: "2007-01-04", seasonYear: 2006 })).toBe(
      "2006",
    );
  });

  it("falls back to the publish year when no season is recorded", () => {
    expect(seasonSegment({ videoId: "x", title: "t", date: "2019-11-02" })).toBe("2019");
  });

  it("files an unparseable date under the archive", () => {
    expect(seasonSegment({ videoId: "x", title: "t", date: "sometime" })).toBe("archive");
    expect(seasonSegment({ videoId: "x", title: "t" })).toBe("archive");
  });
});

describe("eventSegment", () => {
  it("drops the year a tournament name repeats", () => {
    expect(
      eventSegment({ videoId: "x", title: "t", style: 2, tournament: "2026 Tournament of Champions" }),
    ).toBe("pf-tournament-of-champions");
  });

  it("stands on the format alone when there is no tournament", () => {
    expect(eventSegment({ videoId: "x", title: "t", style: 3 })).toBe("ld");
  });

  it("files a lecture under its category", () => {
    expect(eventSegment({ videoId: "x", title: "t", style: "Kritik / Critical Theory" })).toBe(
      "kritik-critical-theory",
    );
  });

  it("has a segment for a video with nothing recorded at all", () => {
    expect(eventSegment({ videoId: "x", title: "t" })).toBe("library");
  });
});

describe("matchupSegment", () => {
  it("names both teams and the round", () => {
    expect(
      matchupSegment({
        videoId: "abcdefghijk",
        title: "Anything",
        affTeam: "Michigan KM",
        negTeam: "Kentucky BC",
        roundLevel: "Octafinals",
      }),
    ).toBe("michigan-km-vs-kentucky-bc-octafinals");
  });

  it("adds the arguments that were run when there is room", () => {
    expect(
      matchupSegment({
        videoId: "abcdefghijk",
        title: "Anything",
        affTeam: "Emory",
        negTeam: "Harvard",
        arg1ac: "Antitrust",
        arg2nr: "Cap K",
      }),
    ).toBe("emory-vs-harvard-antitrust-cap-k");
  });

  it("stops adding pieces rather than growing without bound", () => {
    const segment = matchupSegment({
      videoId: "abcdefghijk",
      title: "Anything",
      affTeam: "A very long university team name that keeps going",
      negTeam: "Another extremely long university team name as well",
      roundLevel: "Quarterfinals",
      arg1ac: "An argument with a name nobody would ever shorten",
    });
    expect(segment.length).toBeLessThanOrEqual(90);
  });

  it("falls back to the title for a video with no teams", () => {
    expect(
      matchupSegment({ videoId: "abcdefghijk", title: "How to give a 2NR" }),
    ).toBe("how-to-give-a-2nr");
  });
});

describe("parseVideoRouteMatchup", () => {
  it("returns the segment as-is", () => {
    expect(parseVideoRouteMatchup("northwestern-vs-michigan-state-finals")).toBe(
      "northwestern-vs-michigan-state-finals",
    );
    expect(parseVideoRouteMatchup("emory-vs-harvard-a-b_c-d1234")).toBe(
      "emory-vs-harvard-a-b_c-d1234",
    );
  });

  it("returns null for empty input", () => {
    expect(parseVideoRouteMatchup("finals")).toBe("finals");
    expect(parseVideoRouteMatchup("")).toBeNull();
  });
});

describe("isCanonicalVideoRoute", () => {
  const parts = videoRouteParts(ndtFinal);
  const canonical = videoRouteSegments(parts);

  it("accepts the address it builds", () => {
    expect(isCanonicalVideoRoute(parts, canonical)).toBe(true);
  });

  it("ignores case, so an uppercased link is not bounced through a redirect", () => {
    expect(
      isCanonicalVideoRoute(parts, { ...canonical, event: canonical.event.toUpperCase() }),
    ).toBe(true);
  });

  it("rejects a segment left over from before a correction", () => {
    // The tournament was re-tagged, so the old link has to be sent onward.
    expect(isCanonicalVideoRoute(parts, { ...canonical, event: "college-ceda" })).toBe(false);
    expect(isCanonicalVideoRoute(parts, { ...canonical, season: "2007" })).toBe(false);
    expect(isCanonicalVideoRoute(parts, { ...canonical, teams: undefined })).toBe(false);
  });
});
