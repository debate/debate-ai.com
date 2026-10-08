// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SEARCH_CACHE_KEY,
  DEFAULT_SEARCH_CACHE_MAX_AGE_MS,
  DEFAULT_SEARCH_SORT,
  isDefaultSearch,
  readDefaultSearchCache,
  writeDefaultSearchCache,
} from "../src/lib/default-search-cache";
import { DEFAULT_SEARCH_FILTERS } from "../src/lib/search-query";
import type { SearchResult } from "../src/types";

const results = [{ id: "1" }, { id: "2" }] as unknown as SearchResult[];

describe("default search cache", () => {
  beforeEach(() => localStorage.clear());

  it("recognises only the search the page opens with", () => {
    expect(isDefaultSearch({ searchTerm: "", sortBy: DEFAULT_SEARCH_SORT, filters: DEFAULT_SEARCH_FILTERS })).toBe(true);
    expect(isDefaultSearch({ searchTerm: "  ", sortBy: DEFAULT_SEARCH_SORT, filters: DEFAULT_SEARCH_FILTERS })).toBe(true);
    expect(isDefaultSearch({ searchTerm: "nuclear", sortBy: DEFAULT_SEARCH_SORT, filters: DEFAULT_SEARCH_FILTERS })).toBe(false);
    expect(isDefaultSearch({ searchTerm: "", sortBy: "year:desc", filters: DEFAULT_SEARCH_FILTERS })).toBe(false);
    expect(
      isDefaultSearch({ searchTerm: "", sortBy: DEFAULT_SEARCH_SORT, filters: { ...DEFAULT_SEARCH_FILTERS, year: "2024" } }),
    ).toBe(false);
  });

  it("round-trips the results", () => {
    writeDefaultSearchCache(results, 2, 1_000);
    expect(readDefaultSearchCache(2_000)).toEqual({ results, total: 2 });
  });

  it("drops an entry past its max age", () => {
    writeDefaultSearchCache(results, 2, 0);
    expect(readDefaultSearchCache(DEFAULT_SEARCH_CACHE_MAX_AGE_MS + 1)).toBeNull();
  });

  it("ignores empty result lists and malformed entries", () => {
    writeDefaultSearchCache([], 0);
    expect(localStorage.getItem(DEFAULT_SEARCH_CACHE_KEY)).toBeNull();
    localStorage.setItem(DEFAULT_SEARCH_CACHE_KEY, "{not json");
    expect(readDefaultSearchCache()).toBeNull();
  });
});
