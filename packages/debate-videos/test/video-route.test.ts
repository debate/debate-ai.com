/**
 * @fileoverview The canonical video address, `/videos/<season>/<event>/<matchup>`.
 *
 * What is pinned here is what a URL scheme has to guarantee to be worth
 * changing to:
 *   - the id survives the round trip, including ids containing `-`;
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
  matchupSegment,
  parseVideoRouteMatchup,
  seasonSegment,
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
  it("files a round under its season, format-tournament and matchup", () => {
    expect(videoRouteSegments(videoRouteParts(ndtFinal))).toEqual({
      season: "2006",
      event: "college-ndt",
      matchup: "northwestern-gw-vs-michigan-state-bp-finals-dQw4w9WgXcQ",
    });
  });

  it("builds the whole path from a tuple", () => {
    expect(videoRouteHref(ndtFinal)).toBe(
      "/videos/2006/college-ndt/northwestern-gw-vs-michigan-state-bp-finals-dQw4w9WgXcQ",
    );
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
    ).toBe("michigan-km-vs-kentucky-bc-octafinals-abcdefghijk");
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
    ).toBe("emory-vs-harvard-antitrust-cap-k-abcdefghijk");
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
    expect(segment.endsWith("-abcdefghijk")).toBe(true);
    expect(segment.length).toBeLessThanOrEqual(90 + "-abcdefghijk".length);
  });

  it("falls back to the title for a video with no teams", () => {
    expect(
      matchupSegment({ videoId: "abcdefghijk", title: "How to give a 2NR" }),
    ).toBe("how-to-give-a-2nr-abcdefghijk");
  });
});

describe("parseVideoRouteMatchup", () => {
  it("reads the id back out of a matchup segment", () => {
    expect(parseVideoRouteMatchup("northwestern-vs-michigan-state-finals-dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("keeps an id that itself contains dashes", () => {
    // Splitting on "-" truncates these, which is why the id is read from the
    // end of the segment rather than by splitting it.
    expect(parseVideoRouteMatchup("emory-vs-harvard-a-b_c-d1234")).toBe("a-b_c-d1234");
  });

  it("rejects a segment carrying no id", () => {
    expect(parseVideoRouteMatchup("finals")).toBeNull();
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
  });
});
