/**
 * @fileoverview Pins the profile pages' round filter: competitor phrases match
 * whole words in a round's aff/neg team, fall back to the title only when no
 * team is recorded, and the style list keeps rounds in any listed division.
 */

import { describe, expect, it } from "vitest";
import type { VideoRow } from "../src/videos/video-rows";
import {
  competitorMatches,
  competitorPhrases,
  filterVideoRows,
  phraseInText,
} from "../src/videos/video-query";

function row(over: Partial<VideoRow>): VideoRow {
  return {
    videoId: "v",
    source: "round",
    title: "",
    affTeam: null,
    negTeam: null,
    style: 2,
    searchText: "",
    ...over,
  } as VideoRow;
}

describe("competitorPhrases", () => {
  it("normalizes, de-duplicates and keeps only plain words", () => {
    expect(competitorPhrases(["Strake-Jesuit", "strake jesuit", " ", "x", "50%"])).toEqual(["strake jesuit"]);
    expect(competitorPhrases(null)).toEqual([]);
  });
});

describe("phraseInText", () => {
  it("matches whole words only", () => {
    expect(phraseInText("Strake Jesuit FS", "strake jesuit")).toBe(true);
    expect(phraseInText("Harker LL vs. Strake Jesuit: FS", "strake jesuit")).toBe(true);
    expect(phraseInText("Harkerville AB", "harker")).toBe(false);
    expect(phraseInText(null, "harker")).toBe(false);
    expect(phraseInText("O'Dea & Co AB", "o dea and co")).toBe(true);
  });

  it("anchors short shorthand to the start, so it can't hit initials", () => {
    expect(phraseInText("SJ FS", "sj")).toBe(true);
    expect(phraseInText("Harker SJ", "sj")).toBe(false);
  });
});

describe("competitorMatches", () => {
  it("searches the aff and neg teams when either is recorded, never the title", () => {
    const r = row({ affTeam: "Harker LL", negTeam: "Strake Jesuit FS", title: "Glenbrook North round" });
    expect(competitorMatches(r, ["strake jesuit"])).toBe(true);
    expect(competitorMatches(r, ["glenbrook north"])).toBe(false);
  });

  it("falls back to the title when no team is recorded", () => {
    const r = row({ title: "TOC Finals: Strake Jesuit FS vs Harker LL" });
    expect(competitorMatches(r, ["strake jesuit fs"])).toBe(true);
    expect(competitorMatches(r, ["strake jesuit sf"])).toBe(false);
  });
});

describe("filterVideoRows competitors and styles", () => {
  const rows = [
    row({ videoId: "pf", style: 2, affTeam: "Harker LL" }),
    row({ videoId: "cx", style: 1, negTeam: "Harker AB" }),
    row({ videoId: "ndt", style: 4, title: "Harker AB vs Emory" }),
    row({ videoId: "lecture", style: null, title: "Harker lecture" }),
    row({ videoId: "other", style: 1, affTeam: "Glenbrook North CR" }),
  ];

  it("keeps the school's rounds in the listed divisions only", () => {
    const ids = filterVideoRows(rows, { competitors: ["harker"], styles: [1, 4] }).map((r) => r.videoId);
    expect(ids).toEqual(["cx", "ndt"]);
  });

  it("leaves rows alone when neither filter is set", () => {
    expect(filterVideoRows(rows, {})).toHaveLength(rows.length);
  });
});
