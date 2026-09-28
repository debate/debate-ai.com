/**
 * @fileoverview Guards the per-category phrase sets behind the search dropdown:
 * each category resolves to its own set, and no phrase is shared between sets.
 */

import { describe, it, expect } from "vitest";
import { ALL_PHRASE_SETS, getSearchPhrases } from "../src/components/video-search/searchPhrases";

describe("getSearchPhrases", () => {
  it("never repeats a phrase across categories", () => {
    const all = ALL_PHRASE_SETS.flat().map((p) => p.toLowerCase());
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives each debate style a different set", () => {
    const pf = getSearchPhrases({ currentCategory: "rounds", selectedStyle: 2 });
    const ld = getSearchPhrases({ currentCategory: "rounds", selectedStyle: 3 });
    expect(pf.length).toBeGreaterThan(0);
    expect(pf).not.toEqual(ld);
  });

  it("resolves a lecture category by label or slug", () => {
    const byLabel = getSearchPhrases({ currentCategory: "lectures", selectedCategory: "Kritik / Critical Theory" });
    const bySlug = getSearchPhrases({ currentCategory: "lectures", selectedCategory: "kritik___critical_theory" });
    expect(byLabel).toContain("capitalism kritik");
    expect(bySlug).toEqual(byLabel);
  });

  it("prefers the style over the lecture category and falls back to the view", () => {
    expect(getSearchPhrases({ currentCategory: "lectures", selectedStyle: 1, selectedCategory: "Disadvantages" }))
      .toContain("NDT finals");
    expect(getSearchPhrases({ currentCategory: "lectures", selectedCategory: "unknown" }))
      .toEqual(getSearchPhrases({ currentCategory: "lectures" }));
  });
});
