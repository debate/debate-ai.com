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
      "2026 NDT Octas: Kansas OW #14 (K) vs CSULB MO #7 (Policy)",
    );
  });

  it("leaves out a rank or argument that is not known", () => {
    const noArgs: VideoType = [...ndtOctas];
    noArgs[13] = null;
    noArgs[14] = null;
    expect(videoPageTitle(noArgs, { aff: 14 })).toBe("2026 NDT Octas: Kansas OW #14 vs CSULB MO");
    expect(videoPageTitle(ndtOctas)).toBe("2026 NDT Octas: Kansas OW (K) vs CSULB MO (Policy)");
  });

  it("dates an autumn tournament by the autumn, not the season's end year", () => {
    const kentucky: VideoType = [...ndtOctas];
    kentucky[2] = "2025-09-21";
    kentucky[7] = "Kentucky";
    kentucky[8] = "Round 4";
    expect(videoPageTitle(kentucky)).toBe("2025 Kentucky Round 4: Kansas OW (K) vs CSULB MO (Policy)");
  });

  it("prefers a year the tournament's name gives", () => {
    const named: VideoType = [...ndtOctas];
    named[7] = "2024 NDT";
    expect(videoPageTitle(named)).toMatch(/^2024 NDT Octas: /);
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

  it("omits the redundant College level word for a college round named in its title", () => {
    const gsu: VideoType = [
      "hij000",
      "2013 GSU College Final: Northwestern Miles & Vellayappan #1 vs Harvard Bolman & Suo #4",
      "2013-04-06",
      "Debate Archive",
      500,
      "",
      4,
    ];
    expect(videoPageTitle(gsu)).toBe(
      "2013 GSU College Final: Northwestern Miles & Vellayappan #1 vs Harvard Bolman & Suo #4",
    );
  });

  it("keeps a lecture's own title", () => {
    const lecture: VideoType = ["ghi789", "How to give a 2NR", "2020-01-01", "Coach", 10, "", "Critique"];
    expect(videoPageTitle(lecture)).toBe("How to give a 2NR");
  });

  it("substitutes each team's code with its debaters' last names when names are known", () => {
    const dartmouthRR: VideoType = [
      "abc123",
      "Emory vs Michigan State - Dartmouth RR Round 3",
      "2026-10-24",
      "Debate Archive",
      1_200,
      "",
      4,
      "Dartmouth RR",
      "Round 3",
      "Emory GS",
      "Michigan State GL",
      null,
      null,
      null,
      null,
      false,
      null,
      2026,
    ];
    expect(
      videoPageTitle(dartmouthRR, { aff: 1, neg: 10, affNames: "Gallow & Stern", negNames: "Lee & Kim" }),
    ).toBe("2026 Dartmouth RR Round 3: Emory Gallow & Stern #1 vs Michigan State Lee & Kim #10");
  });

  it("leaves the code as-is when no names are provided", () => {
    const dartmouthRR: VideoType = [
      "abc123",
      "Emory vs Michigan State - Dartmouth RR Round 3",
      "2026-10-24",
      "Debate Archive",
      1_200,
      "",
      4,
      "Dartmouth RR",
      "Round 3",
      "Emory GS",
      "Michigan State GL",
      null,
      null,
      null,
      null,
      false,
      null,
      2026,
    ];
    expect(videoPageTitle(dartmouthRR, { aff: 1, neg: 10 })    ).toBe(
      "2026 Dartmouth RR Round 3: Emory GS #1 vs Michigan State GL #10",
    );
  });

  it("substitutes only the aff name when only aff names are known", () => {
    const dartmouthRR: VideoType = [
      "abc123",
      "Emory vs Michigan State - Dartmouth RR Round 3",
      "2026-10-24",
      "Debate Archive",
      1_200,
      "",
      4,
      "Dartmouth RR",
      "Round 3",
      "Emory GS",
      "Michigan State GL",
      null,
      null,
      null,
      null,
      false,
      null,
      2026,
    ];
    expect(
      videoPageTitle(dartmouthRR, { aff: 1, neg: 10, affNames: "Gallow & Stern" }),
    ).toBe("2026 Dartmouth RR Round 3: Emory Gallow & Stern #1 vs Michigan State GL #10");
  });

  it("keeps a team without trailing initials unchanged when names are given", () => {
    const unnamed: VideoType = [
      "abc123",
      "Boston College vs Emory GS",
      "2026-10-24",
      "Debate Archive",
      1_200,
      "",
      4,
      "Dartmouth RR",
      "Round 3",
      "Boston College",
      "Emory GS",
      null,
      null,
      null,
      null,
      false,
      null,
      2026,
    ];
    expect(
      videoPageTitle(unnamed, { neg: 10, negNames: "Gallow & Stern" }),
    ).toBe("2026 Dartmouth RR Round 3: Boston College vs Emory Gallow & Stern #10");
  });
});
