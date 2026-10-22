/**
 * @fileoverview The watch page's title names the round — the tournament's
 * year, the level and round, then each team with its rank and argument — not
 * the upload's own title, which a lecture still keeps.
 */

import { describe, expect, it } from "vitest";
import { videoPageTitle } from "../src/lib/video-page-title";
import type { VideoType } from "../src/types/videos";

/** A tagged college round from the 2025-26 season, uploaded after the NDT. */
const ndtOctas: VideoType = [
  "abc123",
  "Kansas vs Long Beach - NDT Octos",
  "2026-04-02",
  "Debate Archive",
  1_200,
  "",
  4,
  "NDT",
  "Octafinals",
  "Kansas OW",
  "CSULB MO",
  null,
  null,
  "K",
  "Policy",
  false,
  null,
  2026,
];

describe("videoPageTitle", () => {
  it("names the year, tournament, level, round and teams with rank and argument", () => {
    expect(videoPageTitle(ndtOctas, { aff: 14, neg: 7 })).toBe(
      "2026 NDT College Octas: Kansas OW (#14, K) vs CSULB MO (#7, Policy)",
    );
  });

  it("leaves out a rank or argument that is not known", () => {
    const noArgs: VideoType = [...ndtOctas];
    noArgs[13] = null;
    noArgs[14] = null;
    expect(videoPageTitle(noArgs, { aff: 14 })).toBe("2026 NDT College Octas: Kansas OW (#14) vs CSULB MO");
    expect(videoPageTitle(ndtOctas)).toBe("2026 NDT College Octas: Kansas OW (K) vs CSULB MO (Policy)");
  });

  it("dates an autumn tournament by the autumn, not the season's end year", () => {
    const kentucky: VideoType = [...ndtOctas];
    kentucky[2] = "2025-09-21";
    kentucky[7] = "Kentucky";
    kentucky[8] = "Round 4";
    expect(videoPageTitle(kentucky)).toBe("2025 Kentucky College Round 4: Kansas OW (K) vs CSULB MO (Policy)");
  });

  it("prefers a year the tournament's name gives", () => {
    const named: VideoType = [...ndtOctas];
    named[7] = "2024 NDT";
    expect(videoPageTitle(named)).toMatch(/^2024 NDT College Octas: /);
  });

  it("says high-school policy rather than just Policy", () => {
    const toc: VideoType = [...ndtOctas];
    toc[6] = 1;
    toc[7] = "TOC";
    toc[8] = "Finals";
    expect(videoPageTitle(toc)).toMatch(/^2026 TOC HS Policy Final: /);
  });

  it("reads an untagged round out of its title", () => {
    const untagged: VideoType = [
      "def456",
      "2022 NDT Finals - Dartmouth SV vs Michigan PR",
      "2022-04-10",
      "Debate Archive",
      500,
      "",
      "Round Analysis",
    ];
    expect(videoPageTitle(untagged)).toBe("2022 NDT Final: Dartmouth SV vs Michigan PR");
  });

  it("keeps a lecture's own title", () => {
    const lecture: VideoType = ["ghi789", "How to give a 2NR", "2020-01-01", "Coach", 10, "", "Critique"];
    expect(videoPageTitle(lecture)).toBe("How to give a 2NR");
  });
});
