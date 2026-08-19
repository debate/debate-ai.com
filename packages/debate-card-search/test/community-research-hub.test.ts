import { describe, expect, it } from "vitest";
import {
  COMMUNITY_RESEARCH_HUB_ENTRIES,
  buildCommunityResearchHubSections,
  buildCommunityResearchHubSummaryText,
  searchCommunityResearchHubEntries,
  type CommunityHubEntry,
} from "../src/lib/community-research-hub";

describe("COMMUNITY_RESEARCH_HUB_ENTRIES", () => {
  it("has a unique id and a leading-slash href for every entry", () => {
    const ids = COMMUNITY_RESEARCH_HUB_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of COMMUNITY_RESEARCH_HUB_ENTRIES) {
      expect(entry.href.startsWith("/")).toBe(true);
    }
  });
});

describe("buildCommunityResearchHubSections", () => {
  it("groups the default registry into every category, in label order, none empty", () => {
    const sections = buildCommunityResearchHubSections();
    expect(sections.map((section) => section.category)).toEqual([
      "evidence",
      "collaboration",
      "intelligence",
      "practice",
      "recognition",
    ]);
    for (const section of sections) {
      expect(section.entries.length).toBeGreaterThan(0);
      expect(section.entries.every((entry) => entry.category === section.category)).toBe(true);
    }
  });

  it("omits a category with no entries and preserves within-category order", () => {
    const entries: CommunityHubEntry[] = [
      { id: "b", title: "B", description: "second", href: "/b", category: "evidence" },
      { id: "a", title: "A", description: "first", href: "/a", category: "evidence" },
    ];
    const sections = buildCommunityResearchHubSections(entries);
    expect(sections).toHaveLength(1);
    expect(sections[0].entries.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("returns an empty array for an empty entry list", () => {
    expect(buildCommunityResearchHubSections([])).toEqual([]);
  });
});

describe("searchCommunityResearchHubEntries", () => {
  const entries: CommunityHubEntry[] = [
    {
      id: "shared-evidence-library",
      title: "Shared Evidence Library",
      description: "Search cut cards by keyword, citation, or argument",
      href: "/cards/library",
      category: "evidence",
    },
    {
      id: "judge-profiles",
      title: "Judge Profiles",
      description: "Side-vote bias and speaker-point tendencies for every saved judge",
      href: "/judges",
      category: "intelligence",
    },
  ];

  it("matches a query against the title, case-insensitively", () => {
    expect(searchCommunityResearchHubEntries(entries, "judge").map((entry) => entry.id)).toEqual([
      "judge-profiles",
    ]);
    expect(searchCommunityResearchHubEntries(entries, "JUDGE").map((entry) => entry.id)).toEqual([
      "judge-profiles",
    ]);
  });

  it("matches a query against the description", () => {
    expect(searchCommunityResearchHubEntries(entries, "citation").map((entry) => entry.id)).toEqual([
      "shared-evidence-library",
    ]);
  });

  it("returns every entry, unchanged, for an empty or whitespace-only query", () => {
    expect(searchCommunityResearchHubEntries(entries, "")).toEqual(entries);
    expect(searchCommunityResearchHubEntries(entries, "   ")).toEqual(entries);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchCommunityResearchHubEntries(entries, "typesense")).toEqual([]);
  });
});

describe("buildCommunityResearchHubSummaryText", () => {
  it("summarizes entry and category counts with a per-category breakdown", () => {
    const sections = buildCommunityResearchHubSections();
    const text = buildCommunityResearchHubSummaryText(sections);
    expect(text).toContain(`${COMMUNITY_RESEARCH_HUB_ENTRIES.length} spaces across 5 categories`);
    expect(text).toContain("Evidence & Cards (");
    expect(text).toContain("Recognition & Progress (");
  });

  it("uses singular wording for exactly one section with exactly one entry", () => {
    const sections = buildCommunityResearchHubSections([
      { id: "solo", title: "Solo", description: "only one", href: "/solo", category: "evidence" },
    ]);
    const text = buildCommunityResearchHubSummaryText(sections);
    expect(text.startsWith("1 space across 1 category:")).toBe(true);
  });

  it("returns a zeroed summary for no sections", () => {
    expect(buildCommunityResearchHubSummaryText([])).toBe("0 spaces across 0 categories: ");
  });
});
