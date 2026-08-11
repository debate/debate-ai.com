import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  SEARCH_DEBOUNCE_MS,
  buildSearchParams,
  buildSearchUrl,
} from "../src/lib/search-query";

const base = {
  searchTerm: "",
  sortBy: "_text_match:desc",
  filters: EMPTY_FILTERS,
};

describe("buildSearchParams", () => {
  it("always sends the sort order", () => {
    expect(buildSearchParams(base).get("sort")).toBe("_text_match:desc");
  });

  it("omits a blank or whitespace-only query", () => {
    expect(buildSearchParams(base).has("q")).toBe(false);
    expect(buildSearchParams({ ...base, searchTerm: "   " }).has("q")).toBe(
      false,
    );
  });

  it("trims the query before sending it", () => {
    expect(buildSearchParams({ ...base, searchTerm: "  warming " }).get("q")).toBe(
      "warming",
    );
  });

  it("passes through non-empty text filters only", () => {
    const params = buildSearchParams({
      ...base,
      filters: { ...EMPTY_FILTERS, year: "2024", school: "Michigan" },
    });

    expect(params.get("year")).toBe("2024");
    expect(params.get("school")).toBe("Michigan");
    expect(params.has("team")).toBe(false);
    expect(params.has("tournament")).toBe(false);
  });

  it("treats the 'all' event sentinel as no event filter", () => {
    const all = buildSearchParams({
      ...base,
      filters: { ...EMPTY_FILTERS, event: "all" },
    });
    const ld = buildSearchParams({
      ...base,
      filters: { ...EMPTY_FILTERS, event: "LD" },
    });

    expect(all.has("event")).toBe(false);
    expect(ld.get("event")).toBe("LD");
  });

  it("serializes enabled boolean filters as 1 and drops disabled ones", () => {
    const params = buildSearchParams({
      ...base,
      filters: {
        ...EMPTY_FILTERS,
        searchHighlighted: true,
        searchQuotes: true,
      },
    });

    expect(params.get("searchHighlighted")).toBe("1");
    expect(params.get("searchQuotes")).toBe("1");
    expect(params.has("searchUnderlined")).toBe(false);
    expect(params.has("searchAllText")).toBe(false);
  });

  it("sends nothing but the sort order for the empty filter state", () => {
    expect([...buildSearchParams(base).keys()]).toEqual(["sort"]);
  });
});

describe("buildSearchUrl", () => {
  it("prefixes the serialized params with the search path", () => {
    expect(buildSearchUrl({ ...base, searchTerm: "nuclear war" })).toBe(
      "search?sort=_text_match%3Adesc&q=nuclear+war",
    );
  });
});

describe("search constants", () => {
  it("debounces searches by 300ms", () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it("starts with every filter cleared", () => {
    expect(Object.values(EMPTY_FILTERS).every((v) => v === "" || v === false)).toBe(
      true,
    );
  });
});
