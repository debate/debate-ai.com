import { describe, expect, it } from "vitest";

import {
  APP_FEATURES,
  FEATURE_CATEGORY_DESCRIPTIONS,
  FEATURE_CATEGORY_LABELS,
  buildFeatureCatalogSummaryText,
  buildFeatureSections,
  featureDocUrl,
  searchFeatures,
  type FeatureCategory,
  type FeatureEntry,
} from "../src/ui/features/feature-catalog";

const entry = (over: Partial<FeatureEntry> = {}): FeatureEntry => ({
  id: "a",
  title: "Alpha",
  description: "First thing",
  href: "/alpha",
  category: "evidence",
  ...over,
});

describe("APP_FEATURES", () => {
  it("gives every entry a unique id and a unique route", () => {
    const ids = APP_FEATURES.map((feature) => feature.id);
    const hrefs = APP_FEATURES.map((feature) => feature.href);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("gives every entry an in-app route, a title and a description", () => {
    for (const feature of APP_FEATURES) {
      expect(feature.href.startsWith("/")).toBe(true);
      expect(feature.title.trim().length).toBeGreaterThan(0);
      expect(feature.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("files every entry under a labelled category", () => {
    for (const feature of APP_FEATURES) {
      expect(FEATURE_CATEGORY_LABELS[feature.category]).toBeTruthy();
      expect(FEATURE_CATEGORY_DESCRIPTIONS[feature.category]).toBeTruthy();
    }
  });

  it("uses every declared category at least once", () => {
    const used = new Set(APP_FEATURES.map((feature) => feature.category));
    for (const category of Object.keys(FEATURE_CATEGORY_LABELS) as FeatureCategory[]) {
      expect(used.has(category)).toBe(true);
    }
  });

  it("points each doc reference at a markdown file", () => {
    for (const feature of APP_FEATURES) {
      if (feature.doc) expect(feature.doc.endsWith(".md")).toBe(true);
    }
  });
});

describe("buildFeatureSections", () => {
  it("orders sections by FEATURE_CATEGORY_LABELS and omits empty ones", () => {
    const sections = buildFeatureSections([
      entry({ id: "r", category: "recognition" }),
      entry({ id: "w", category: "workspaces" }),
      entry({ id: "e", category: "evidence" }),
    ]);
    expect(sections.map((section) => section.category)).toEqual([
      "workspaces",
      "evidence",
      "recognition",
    ]);
  });

  it("preserves entry order within a category and carries the category copy", () => {
    const sections = buildFeatureSections([
      entry({ id: "one", category: "practice" }),
      entry({ id: "two", category: "practice" }),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].entries.map((feature) => feature.id)).toEqual(["one", "two"]);
    expect(sections[0].label).toBe(FEATURE_CATEGORY_LABELS.practice);
    expect(sections[0].description).toBe(FEATURE_CATEGORY_DESCRIPTIONS.practice);
  });

  it("defaults to the whole catalog", () => {
    const total = buildFeatureSections().reduce((sum, section) => sum + section.entries.length, 0);
    expect(total).toBe(APP_FEATURES.length);
  });
});

describe("searchFeatures", () => {
  it("returns every entry for an empty or whitespace query", () => {
    expect(searchFeatures(APP_FEATURES, "")).toBe(APP_FEATURES);
    expect(searchFeatures(APP_FEATURES, "   ")).toBe(APP_FEATURES);
  });

  it("matches titles and descriptions case-insensitively", () => {
    const matches = searchFeatures(APP_FEATURES, "JUDGE PARADIGM");
    expect(matches.map((feature) => feature.id)).toContain("judge-paradigm-picker");
  });

  it("matches a route", () => {
    const matches = searchFeatures(APP_FEATURES, "/cards/streaks");
    expect(matches.map((feature) => feature.id)).toEqual(["quest-streaks"]);
  });

  it("matches jargon that only appears in tags", () => {
    // "elo" appears nowhere in Team Rankings' visible title/description copy.
    const matches = searchFeatures(APP_FEATURES, "elo");
    expect(matches.map((feature) => feature.id)).toEqual(["team-rankings"]);
  });

  it("preserves order and returns nothing for a miss", () => {
    const entries = [entry({ id: "a", title: "Flow" }), entry({ id: "b", title: "Flow log" })];
    expect(searchFeatures(entries, "flow").map((feature) => feature.id)).toEqual(["a", "b"]);
    expect(searchFeatures(entries, "kritik")).toEqual([]);
  });
});

describe("featureDocUrl", () => {
  it("builds a docs URL for an entry with a doc", () => {
    expect(featureDocUrl(entry({ doc: "task-inbox.md" }))).toBe(
      "https://github.com/debate/debate-ai.com/blob/master/docs/features/task-inbox.md",
    );
  });

  it("returns undefined when the entry has no doc", () => {
    expect(featureDocUrl(entry())).toBeUndefined();
  });
});

describe("buildFeatureCatalogSummaryText", () => {
  it("counts features and categories with a per-category breakdown", () => {
    const text = buildFeatureCatalogSummaryText(
      buildFeatureSections([
        entry({ id: "w", category: "workspaces" }),
        entry({ id: "e1", category: "evidence" }),
        entry({ id: "e2", category: "evidence" }),
      ]),
    );
    expect(text).toBe(
      "3 features across 2 categories: Core Workspaces (1), Evidence & Research (2)",
    );
  });

  it("singularizes a lone feature in a lone category", () => {
    expect(buildFeatureCatalogSummaryText(buildFeatureSections([entry()]))).toBe(
      "1 feature across 1 category: Evidence & Research (1)",
    );
  });
});
