import { describe, expect, it } from "vitest";
import {
  buildVideoRows,
  formatSeasonLabel,
  normalizeCategoryKey,
  publishedMsForDate,
  seasonYearForDate,
  stripTournamentYear,
  tupleToVideoRow,
  videoRowToTuple,
  LEGACY_SEASON,
} from "../src/videos/video-rows";

const ROUND_TUPLE = [
  "vid-round",
  "TOC FINALS - GBN CR vs MBA HL",
  "2026-04-14",
  "LASA Debate",
  3657,
  "Elimination round",
  1,
  "2026 TOC",
  "Finals",
  "GBN CR",
  "MBA HL",
  false,
  null,
  null,
  null,
  true,
  "https://example.com/docs",
];

const LECTURE_TUPLE = [
  "vid-lecture",
  "Kritik basics",
  "2019-11-02",
  "Coach Channel",
  1200,
  "Intro to the K",
  "Kritik / Critical Theory",
];

describe("seasonYearForDate", () => {
  it("puts a post-June date in the next season", () => {
    expect(seasonYearForDate("2025-09-14")).toBe(2026);
    expect(seasonYearForDate("2025-06-01")).toBe(2026);
  });

  it("puts a pre-June date in the current season", () => {
    expect(seasonYearForDate("2026-04-14")).toBe(2026);
    expect(seasonYearForDate("2026-05-31")).toBe(2026);
  });

  it("marks pre-2010 content as legacy", () => {
    expect(seasonYearForDate("2009-12-31")).toBe(LEGACY_SEASON);
    expect(seasonYearForDate("2010-05-31")).toBe(LEGACY_SEASON);
  });

  it("falls back to legacy for unparseable dates", () => {
    expect(seasonYearForDate("not a date")).toBe(LEGACY_SEASON);
    expect(seasonYearForDate("")).toBe(LEGACY_SEASON);
  });
});

describe("stripTournamentYear", () => {
  it("drops a leading calendar year", () => {
    expect(stripTournamentYear("2026 TOC")).toBe("TOC");
    expect(stripTournamentYear("2019 Apple Valley")).toBe("Apple Valley");
  });

  it("leaves a title with no leading year untouched", () => {
    expect(stripTournamentYear("TOC")).toBe("TOC");
  });

  it("passes through null", () => {
    expect(stripTournamentYear(null)).toBeNull();
  });
});

describe("formatSeasonLabel", () => {
  it("formats a season year as a two-digit range", () => {
    expect(formatSeasonLabel(2025)).toBe("24-25");
    expect(formatSeasonLabel(2020)).toBe("19-20");
  });

  it("labels the legacy sentinel", () => {
    expect(formatSeasonLabel(LEGACY_SEASON)).toBe("Legacy");
  });
});

describe("publishedMsForDate", () => {
  it("parses long-form dates so they sort with the ISO ones", () => {
    expect(publishedMsForDate("May 14, 2013")).toBe(Date.parse("May 14, 2013"));
    expect(publishedMsForDate("2013-05-14")).toBeGreaterThan(0);
  });

  it("returns 0 for unparseable dates", () => {
    expect(publishedMsForDate("whenever")).toBe(0);
  });
});

describe("normalizeCategoryKey", () => {
  it("slugifies a category label", () => {
    expect(normalizeCategoryKey("Kritik / Critical Theory")).toBe("kritik___critical_theory");
    expect(normalizeCategoryKey("Demo Debates")).toBe("demo_debates");
  });

  it("is idempotent, so an already-slugged value passes through", () => {
    expect(normalizeCategoryKey("demo_debates")).toBe("demo_debates");
  });
});

describe("tupleToVideoRow", () => {
  it("maps a round tuple onto its columns", () => {
    const row = tupleToVideoRow(ROUND_TUPLE, "round")!;
    expect(row).toMatchObject({
      videoId: "vid-round",
      source: "round",
      style: 1,
      category: null,
      categoryKey: null,
      tournament: "TOC",
      roundLevel: "Finals",
      affTeam: "GBN CR",
      negTeam: "MBA HL",
      affWin: false,
      isTopPick: true,
      speechDocsUrl: "https://example.com/docs",
      seasonYear: 2026,
    });
    expect(row.searchText).toContain("toc finals");
    expect(row.searchText).toContain("lasa debate");
  });

  it("maps a lecture tuple's category and leaves the style unset", () => {
    const row = tupleToVideoRow(LECTURE_TUPLE, "lecture")!;
    expect(row.style).toBeNull();
    expect(row.category).toBe("Kritik / Critical Theory");
    expect(row.categoryKey).toBe("kritik___critical_theory");
    expect(row.isTopPick).toBe(false);
  });

  it("flags videos listed in the top-picks asset", () => {
    const row = tupleToVideoRow(LECTURE_TUPLE, "lecture", new Set(["vid-lecture"]))!;
    expect(row.isTopPick).toBe(true);
  });

  it("skips tuples with no video id", () => {
    expect(tupleToVideoRow([], "round")).toBeNull();
    expect(tupleToVideoRow(["   "], "round")).toBeNull();
  });
});

describe("videoRowToTuple", () => {
  it("round-trips a round back into its tuple form, minus the tournament year plus the trailing season", () => {
    const row = tupleToVideoRow(ROUND_TUPLE, "round")!;
    expect(videoRowToTuple(row)).toEqual([
      ...ROUND_TUPLE.slice(0, 7),
      "TOC",
      ...ROUND_TUPLE.slice(8),
      2026,
    ]);
  });

  it("keeps the trailing season slot so trimming stops there", () => {
    const row = tupleToVideoRow(LECTURE_TUPLE, "lecture")!;
    const tuple = videoRowToTuple(row);
    expect(tuple).toHaveLength(18);
    expect(tuple[6]).toBe("Kritik / Critical Theory");
    expect(tuple[17]).toBe(2020);
  });
});

describe("buildVideoRows", () => {
  const assets = {
    rounds: [{ data: [ROUND_TUPLE] }],
    lectures: { data: [LECTURE_TUPLE, ROUND_TUPLE] },
    topPicks: { data: ["vid-lecture"] },
  };

  it("merges the assets into one row per video id", () => {
    const rows = buildVideoRows(assets);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.videoId)).toEqual(["vid-round", "vid-lecture"]);
  });

  it("keeps the round metadata for a video that appears in both assets", () => {
    const rows = buildVideoRows(assets);
    expect(rows.find((r) => r.videoId === "vid-round")?.source).toBe("round");
  });

  it("applies the top-picks list", () => {
    const rows = buildVideoRows(assets);
    expect(rows.find((r) => r.videoId === "vid-lecture")?.isTopPick).toBe(true);
  });
});
