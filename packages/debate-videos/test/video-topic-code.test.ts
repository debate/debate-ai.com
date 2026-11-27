/**
 * @fileoverview The topic code a round's short address starts with
 * (`/cpd27/…`): the format, the season's end year, and for LD and PF the
 * letter of the topic the round was published under.
 */

import { describe, expect, it } from "vitest";
import { seasonalTopicLetter, videoTopicCode } from "../src/lib/video-topic-code";
import { videoRouteHref, videoRouteParts } from "../src/lib/video-route";
import type { VideoType } from "../src/types/videos";

describe("videoTopicCode", () => {
  it("names a policy season by its format and the year it ends in", () => {
    expect(videoTopicCode(4, 2027)).toBe("cpd27");
    expect(videoTopicCode(4, 2006)).toBe("cpd06");
    expect(videoTopicCode(1, 2024)).toBe("vcx24");
    expect(videoTopicCode(1, 2000)).toBe("vcx00");
  });

  it("letters an LD video by the topic in force when it was published", () => {
    // 2022-23: September, November, January, March, June.
    expect(videoTopicCode(3, 2023, "2022-09-20")).toBe("lda23");
    expect(videoTopicCode(3, 2023, "2022-11-12")).toBe("ldb23");
    expect(videoTopicCode(3, 2023, "2023-01-14")).toBe("ldc23");
    expect(videoTopicCode(3, 2023, "2023-03-18")).toBe("ldd23");
    expect(videoTopicCode(3, 2023, "2023-04-30")).toBe("ldd23");
    expect(videoTopicCode(3, 2023, "2023-06-20")).toBe("lde23");
  });

  it("letters a PF video the same way, from its own month table", () => {
    expect(videoTopicCode(2, 2023, "2022-12-01")).toBe("pfb23");
    expect(videoTopicCode(2, 2023, "2023-02-20")).toBe("pfd23");
    expect(videoTopicCode(2, 2027, "2026-10-05")).toBe("pfa27");
    expect(videoTopicCode(2, 2027, "2026-11-05")).toBe("pfb27");
  });

  it("gives July and August to the topic that opens the season", () => {
    expect(videoTopicCode(3, 2024, "2023-07-15")).toBe("lda24");
    expect(seasonalTopicLetter("ld", 2024, "2023-08-30")).toBe("a");
  });

  it("has no code for a format without topics, or a season it cannot name", () => {
    for (const style of [5, 6, 7, 8, 9]) expect(videoTopicCode(style as 5, 2027)).toBeNull();
    expect(videoTopicCode("Round Analysis", 2027)).toBeNull();
    expect(videoTopicCode(null, 2027)).toBeNull();
    expect(videoTopicCode(4, null)).toBeNull();
    expect(videoTopicCode(4, 1999)).toBeNull();
    expect(videoTopicCode(4, 2100)).toBeNull();
  });

  it("has no code for an LD or PF video whose topic cannot be told", () => {
    expect(videoTopicCode(3, 2027)).toBeNull();
    expect(videoTopicCode(3, 2027, "not a date")).toBeNull();
    // Published in another season than the one it is filed under.
    expect(videoTopicCode(3, 2023, "2023-09-10")).toBeNull();
    // No topics on record for the season.
    expect(videoTopicCode(3, 2035, "2034-10-10")).toBeNull();
  });
});

describe("the short address of a round", () => {
  const round = (style: number, date: string, seasonYear: number): VideoType =>
    [
      "abcdefghijk",
      "Round",
      date,
      "Channel",
      1,
      "",
      style,
      "Shirley",
      "Octafinals",
      "Kansas SS",
      "Harvard AB",
      false,
      null,
      null,
      null,
      false,
      null,
      seasonYear,
    ] as unknown as VideoType;

  it("starts with the topic code, then the tournament, round and teams", () => {
    expect(videoRouteHref(round(4, "2027-01-12", 2027))).toBe("/cpd27/shirley/octafinals/kansas-ss-harvard-ab");
    expect(videoRouteHref(round(3, "2022-11-12", 2023))).toBe("/ldb23/shirley/octafinals/kansas-ss-harvard-ab");
  });

  it("keeps the /videos path when the format has no code or the topic is unknown", () => {
    expect(videoRouteHref(round(8, "2027-01-12", 2027))).toBe("/videos/26-27/parli/shirley/octafinals/kansas-ss-harvard-ab");
    expect(videoRouteHref(round(3, "2027-09-12", 2027))).toBe("/videos/26-27/ld/shirley/octafinals/kansas-ss-harvard-ab");
  });

  it("keeps a variant after the teams", () => {
    const parts = { ...videoRouteParts(round(4, "2027-01-12", 2027)), title: "Shirley - Part 2" };
    expect(videoRouteHref(parts)).toBe("/cpd27/shirley/octafinals/kansas-ss-harvard-ab/part-2");
  });

  it("never gives the bare-year or pre-format spellings a short address", () => {
    const video = round(4, "2027-01-12", 2027);
    expect(videoRouteHref(video, "year")).toBe("/videos/2027/cpd/shirley/octafinals/kansas-ss-harvard-ab");
    expect(videoRouteHref(video, "season", false)).toBe("/videos/26-27/shirley/octafinals/kansas-ss-harvard-ab");
  });
});
