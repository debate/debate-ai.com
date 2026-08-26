import { describe, expect, it } from "vitest";
import { tupleToVideoRow, type VideoRow } from "../src/videos/video-rows";
import {
  clampPageSize,
  computeLectureCategories,
  computeVideoFacets,
  filterVideoRows,
  parseSeasonFilter,
  queryVideoRows,
  searchTokens,
  seasonKeys,
  sortVideoRows,
  DEFAULT_VIDEO_PAGE_SIZE,
  MAX_VIDEO_PAGE_SIZE,
} from "../src/videos/video-query";

/** Builds a row from a compact spec, filling in the fields a test ignores. */
function row(spec: {
  id: string;
  title?: string;
  date: string;
  views?: number;
  style?: number | null;
  category?: string | null;
  source?: "round" | "lecture";
  topPick?: boolean;
  description?: string;
}): VideoRow {
  return tupleToVideoRow(
    [
      spec.id,
      spec.title ?? spec.id,
      spec.date,
      "Channel",
      spec.views ?? 0,
      spec.description ?? "",
      spec.style ?? spec.category ?? null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      spec.topPick ?? false,
    ],
    spec.source ?? (spec.category ? "lecture" : "round"),
  )!;
}

const ROWS: VideoRow[] = [
  row({ id: "policy-new", date: "2025-09-01", style: 1, views: 10, title: "Policy finals" }),
  row({ id: "pf-new", date: "2025-10-02", style: 2, views: 500, title: "PF octas" }),
  row({ id: "pf-old", date: "2013-02-02", style: 2, views: 50, title: "PF classic" }),
  row({ id: "legacy", date: "2008-01-01", style: 1, views: 5, title: "Ancient round" }),
  row({ id: "lecture-k", date: "2025-08-08", category: "Kritik / Critical Theory", views: 200, title: "Kritik lecture" }),
  row({ id: "lecture-demo", date: "2024-08-08", category: "Demo Debates", views: 900, title: "Demo debate" }),
  row({ id: "lecture-award", date: "2024-08-09", category: "Awards", views: 3, title: "Award ceremony" }),
  row({ id: "lecture-round", date: "2025-01-05", style: 4, source: "lecture", views: 7, title: "College round in lectures" }),
];

describe("searchTokens", () => {
  it("splits and lowercases the query", () => {
    expect(searchTokens("  TOC   Finals ")).toEqual(["toc", "finals"]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchTokens("")).toEqual([]);
    expect(searchTokens(null)).toEqual([]);
  });
});

describe("parseSeasonFilter", () => {
  it("maps the legacy key to season 0", () => {
    expect(parseSeasonFilter("legacy")).toBe(0);
  });

  it("parses a year and ignores an empty filter", () => {
    expect(parseSeasonFilter("2026")).toBe(2026);
    expect(parseSeasonFilter("")).toBeNull();
    expect(parseSeasonFilter(undefined)).toBeNull();
  });
});

describe("clampPageSize", () => {
  it("defaults and caps the page size", () => {
    expect(clampPageSize(undefined)).toBe(DEFAULT_VIDEO_PAGE_SIZE);
    expect(clampPageSize(0)).toBe(DEFAULT_VIDEO_PAGE_SIZE);
    expect(clampPageSize(10_000)).toBe(MAX_VIDEO_PAGE_SIZE);
    expect(clampPageSize(25)).toBe(25);
  });
});

describe("seasonKeys", () => {
  it("counts down from the newest season to 2011", () => {
    const keys = seasonKeys(2026);
    expect(keys[0]).toBe("2026");
    expect(keys.at(-1)).toBe("2011");
  });
});

describe("filterVideoRows", () => {
  const ids = (params: Parameters<typeof filterVideoRows>[1]) =>
    filterVideoRows(ROWS, params).map((r) => r.videoId);

  it("filters by source", () => {
    expect(ids({ source: "lecture" })).toEqual([
      "lecture-k",
      "lecture-demo",
      "lecture-award",
      "lecture-round",
    ]);
  });

  it("keeps only style-less videos for the lectures tab", () => {
    expect(ids({ lecturesOnly: true })).toEqual(["lecture-k", "lecture-demo", "lecture-award"]);
  });

  it("filters by debate style across both sources", () => {
    expect(ids({ style: 2 })).toEqual(["pf-new", "pf-old"]);
    expect(ids({ style: 4 })).toEqual(["lecture-round"]);
  });

  it("filters by season, including the legacy bucket", () => {
    expect(ids({ year: "2026" })).toEqual(["policy-new", "pf-new", "lecture-k"]);
    expect(ids({ year: "legacy" })).toEqual(["legacy"]);
  });

  it("filters by lecture category slug", () => {
    expect(ids({ categoryKey: "demo_debates" })).toEqual(["lecture-demo"]);
  });

  it("requires every search token to match", () => {
    expect(ids({ q: "pf" })).toEqual(["pf-new", "pf-old"]);
    expect(ids({ q: "pf classic" })).toEqual(["pf-old"]);
    expect(ids({ q: "pf nonexistent" })).toEqual([]);
  });

  it("restricts to an explicit id list", () => {
    expect(ids({ ids: ["legacy", "pf-old"] })).toEqual(["pf-old", "legacy"]);
  });

  it("combines filters", () => {
    expect(ids({ style: 2, year: "2026", q: "octas" })).toEqual(["pf-new"]);
  });
});

describe("sortVideoRows", () => {
  it("sorts by recency by default", () => {
    const sorted = sortVideoRows([...ROWS]).map((r) => r.videoId);
    expect(sorted[0]).toBe("pf-new");
    expect(sorted.at(-1)).toBe("legacy");
  });

  it("sorts by view count when asked", () => {
    const sorted = sortVideoRows([...ROWS], "Views").map((r) => r.videoId);
    expect(sorted[0]).toBe("lecture-demo");
    expect(sorted[1]).toBe("pf-new");
  });

  it("breaks ties by id so paging stays stable", () => {
    const tied = [
      row({ id: "b", date: "2025-01-01", views: 1 }),
      row({ id: "a", date: "2025-01-01", views: 1 }),
    ];
    expect(sortVideoRows([...tied]).map((r) => r.videoId)).toEqual(["a", "b"]);
    expect(sortVideoRows([...tied], "Views").map((r) => r.videoId)).toEqual(["a", "b"]);
  });
});

describe("queryVideoRows", () => {
  it("returns one page plus the unpaginated total", () => {
    const first = queryVideoRows(ROWS, { limit: 3, offset: 0 });
    expect(first.rows.map((r) => r.videoId)).toEqual(["pf-new", "policy-new", "lecture-k"]);
    expect(first.total).toBe(ROWS.length);

    const second = queryVideoRows(ROWS, { limit: 3, offset: 3 });
    expect(second.total).toBe(ROWS.length);
    expect(second.rows.map((r) => r.videoId)).not.toContain("pf-new");
  });

  it("pages through every match exactly once", () => {
    const seen: string[] = [];
    for (let offset = 0; offset < ROWS.length; offset += 2) {
      seen.push(...queryVideoRows(ROWS, { limit: 2, offset }).rows.map((r) => r.videoId));
    }
    expect(new Set(seen).size).toBe(ROWS.length);
  });
});

describe("computeVideoFacets", () => {
  it("counts seasons while ignoring the active season filter", () => {
    const facets = computeVideoFacets(ROWS, { year: "2026" });
    expect(facets.yearCounts["2026"]).toBe(3);
    expect(facets.yearCounts["2013"]).toBe(1);
    expect(facets.yearCounts.legacy).toBe(1);
  });

  it("applies the style filter to the season counts", () => {
    const facets = computeVideoFacets(ROWS, { style: 2 });
    expect(facets.yearCounts["2026"]).toBe(1);
    expect(facets.yearCounts.legacy).toBeUndefined();
  });

  it("counts styles while ignoring the active style filter", () => {
    const facets = computeVideoFacets(ROWS, { style: 1 });
    expect(facets.styleCounts[1]).toBe(2);
    expect(facets.styleCounts[2]).toBe(2);
  });

  it("applies the season filter to the style counts", () => {
    const facets = computeVideoFacets(ROWS, { year: "2026" });
    expect(facets.styleCounts).toEqual({ 1: 1, 2: 1 });
  });

  it("ignores the search term, so dropdowns keep showing library totals", () => {
    expect(computeVideoFacets(ROWS, { q: "octas" })).toEqual(computeVideoFacets(ROWS, {}));
  });
});

describe("computeLectureCategories", () => {
  it("returns one card per category, most popular first", () => {
    const categories = computeLectureCategories(ROWS);
    expect(categories.map((c) => c.key)).toEqual(["demo_debates", "kritik___critical_theory"]);
    expect(categories[0]).toMatchObject({ label: "Demo Debates", count: 1, maxViews: 900 });
  });

  it("leaves out rounds and the hidden Awards category", () => {
    const labels = computeLectureCategories(ROWS).map((c) => c.label);
    expect(labels).not.toContain("Awards");
    expect(labels).toHaveLength(2);
  });
});
