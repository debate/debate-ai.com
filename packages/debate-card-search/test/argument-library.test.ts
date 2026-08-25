import { describe, expect, it } from "vitest";
import {
  applyTagSuggestion,
  buildArgumentLibrary,
  buildLibraryCardsFromContributions,
  buildLibrarySummaryText,
  buildTagCollections,
  buildTopicFolder,
  buildTopicFolders,
  contributionToLibraryCard,
  filterCardsByTags,
  groupCardsByCaseArea,
  groupCardsByTopic,
  parseTagsInput,
  renameTagAcrossCards,
  renameTagInList,
  suggestTags,
  type LibraryCard,
} from "../src/lib/argument-library";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";

const cards: LibraryCard[] = [
  {
    id: "warming-1",
    argBlock: "Warming DA",
    wordCount: 250,
    topic: "Energy",
    caseArea: "DA",
    tags: ["climate", "impact"],
  },
  {
    id: "warming-2",
    argBlock: "Warming DA",
    wordCount: 300,
    topic: "Energy",
    caseArea: "DA",
    tags: ["climate"],
  },
  {
    id: "states-1",
    argBlock: "States CP",
    wordCount: 100,
    topic: "Energy",
    caseArea: "CP",
    tags: ["federalism"],
  },
  {
    id: "case-1",
    argBlock: "Case NEG",
    wordCount: 400,
    topic: "Healthcare",
    caseArea: "Case",
    tags: ["climate", "solvency"],
  },
];

describe("groupCardsByTopic", () => {
  it("groups cards by topic, preserving order within a group", () => {
    const grouped = groupCardsByTopic(cards);
    expect(Array.from(grouped.keys())).toEqual(["Energy", "Healthcare"]);
    expect(grouped.get("Energy")?.map((c) => c.id)).toEqual(["warming-1", "warming-2", "states-1"]);
  });

  it("returns an empty map for an empty card list", () => {
    expect(groupCardsByTopic([]).size).toBe(0);
  });
});

describe("groupCardsByCaseArea", () => {
  it("groups cards by case area, preserving order within a group", () => {
    const grouped = groupCardsByCaseArea(cards);
    expect(grouped.get("DA")?.map((c) => c.id)).toEqual(["warming-1", "warming-2"]);
    expect(grouped.get("CP")?.map((c) => c.id)).toEqual(["states-1"]);
  });
});

describe("buildTopicFolder", () => {
  it("splits a topic's cards into case-area subgroups sorted by caseArea", () => {
    const energyCards = cards.filter((c) => c.topic === "Energy");
    const folder = buildTopicFolder("Energy", energyCards);
    expect(folder.topic).toBe("Energy");
    expect(folder.cardCount).toBe(3);
    expect(folder.caseAreas.map((g) => g.caseArea)).toEqual(["CP", "DA"]);
    expect(folder.caseAreas.find((g) => g.caseArea === "DA")?.cards.map((c) => c.id)).toEqual([
      "warming-1",
      "warming-2",
    ]);
  });

  it("returns a topic folder with zero case areas for an empty card list", () => {
    const folder = buildTopicFolder("Empty Topic", []);
    expect(folder.caseAreas).toEqual([]);
    expect(folder.cardCount).toBe(0);
  });
});

describe("buildTopicFolders", () => {
  it("builds a folder for every topic represented, sorted by topic", () => {
    const folders = buildTopicFolders(cards);
    expect(folders.map((f) => f.topic)).toEqual(["Energy", "Healthcare"]);
    expect(folders.find((f) => f.topic === "Healthcare")?.cardCount).toBe(1);
  });

  it("returns an empty list for an empty card list", () => {
    expect(buildTopicFolders([])).toEqual([]);
  });
});

describe("buildTagCollections", () => {
  it("groups cards under every tag they carry, sorted by tag", () => {
    const collections = buildTagCollections(cards);
    expect(collections.map((c) => c.tag)).toEqual(["climate", "federalism", "impact", "solvency"]);
    expect(collections.find((c) => c.tag === "climate")?.cards.map((c) => c.id)).toEqual([
      "warming-1",
      "warming-2",
      "case-1",
    ]);
  });

  it("lists a multi-tag card under each of its tags", () => {
    const collections = buildTagCollections(cards);
    const solvency = collections.find((c) => c.tag === "solvency");
    expect(solvency?.cards.map((c) => c.id)).toEqual(["case-1"]);
  });

  it("returns an empty list when no cards carry any tags", () => {
    const untagged: LibraryCard[] = [
      { id: "x", argBlock: "X", wordCount: 10, topic: "T", caseArea: "Case", tags: [] },
    ];
    expect(buildTagCollections(untagged)).toEqual([]);
  });
});

describe("filterCardsByTags", () => {
  it("keeps cards matching any requested tag by default", () => {
    const filtered = filterCardsByTags(cards, ["federalism", "solvency"]);
    expect(filtered.map((c) => c.id)).toEqual(["states-1", "case-1"]);
  });

  it("requires every requested tag when mode is 'all'", () => {
    const filtered = filterCardsByTags(cards, ["climate", "solvency"], "all");
    expect(filtered.map((c) => c.id)).toEqual(["case-1"]);
  });

  it("returns an empty list when no tags are requested", () => {
    expect(filterCardsByTags(cards, [])).toEqual([]);
  });

  it("returns an empty list when no card matches", () => {
    expect(filterCardsByTags(cards, ["nonexistent"])).toEqual([]);
  });
});

describe("buildArgumentLibrary", () => {
  it("combines topic folders and tag collections", () => {
    const library = buildArgumentLibrary(cards);
    expect(library.topicFolders.map((f) => f.topic)).toEqual(["Energy", "Healthcare"]);
    expect(library.tagCollections.map((c) => c.tag)).toEqual(["climate", "federalism", "impact", "solvency"]);
  });

  it("builds an empty library for an empty card list", () => {
    const library = buildArgumentLibrary([]);
    expect(library.topicFolders).toEqual([]);
    expect(library.tagCollections).toEqual([]);
  });
});

describe("buildLibrarySummaryText", () => {
  it("summarizes card, topic, case-area, and tag counts", () => {
    const library = buildArgumentLibrary(cards);
    expect(buildLibrarySummaryText(library)).toBe("4 cards across 2 topics, 3 case areas, 4 tags");
  });

  it("uses singular nouns for a single card/topic/case-area/tag", () => {
    const single: LibraryCard[] = [
      { id: "a", argBlock: "A", wordCount: 10, topic: "T", caseArea: "Case", tags: ["only"] },
    ];
    const library = buildArgumentLibrary(single);
    expect(buildLibrarySummaryText(library)).toBe("1 card across 1 topic, 1 case area, 1 tag");
  });

  it("returns an all-zero summary for an empty library", () => {
    const library = buildArgumentLibrary([]);
    expect(buildLibrarySummaryText(library)).toBe("0 cards across 0 topics, 0 case areas, 0 tags");
  });
});

describe("parseTagsInput", () => {
  it("splits completed tags from the in-progress fragment after the last comma", () => {
    expect(parseTagsInput("climate, imp")).toEqual({ completedTags: ["climate"], draftTag: " imp" });
  });

  it("treats a single, comma-less value entirely as the draft fragment", () => {
    expect(parseTagsInput("clim")).toEqual({ completedTags: [], draftTag: "clim" });
  });

  it("drops blank segments from completed tags", () => {
    expect(parseTagsInput("climate, , impact, sol")).toEqual({
      completedTags: ["climate", "impact"],
      draftTag: " sol",
    });
  });

  it("returns an empty draft fragment for an empty input", () => {
    expect(parseTagsInput("")).toEqual({ completedTags: [], draftTag: "" });
  });

  it("returns an empty draft fragment when the input ends in a trailing comma", () => {
    expect(parseTagsInput("climate,")).toEqual({ completedTags: ["climate"], draftTag: "" });
  });
});

describe("applyTagSuggestion", () => {
  it("replaces the in-progress fragment with the chosen suggestion, leaving a trailing separator", () => {
    expect(applyTagSuggestion("climate, imp", "impact")).toBe("climate, impact, ");
  });

  it("appends the first tag with no leading separator", () => {
    expect(applyTagSuggestion("clim", "climate")).toBe("climate, ");
  });

  it("appends after a trailing comma with no dangling comma before it", () => {
    expect(applyTagSuggestion("climate,", "impact")).toBe("climate, impact, ");
  });
});

describe("suggestTags", () => {
  const known = ["climate", "climate-change", "federalism", "impact", "solvency"];

  it("returns no suggestions for an empty (nothing typed yet) query", () => {
    expect(suggestTags(known, "")).toEqual([]);
    expect(suggestTags(known, "   ")).toEqual([]);
  });

  it("ranks prefix matches ahead of substring matches", () => {
    expect(suggestTags(["deep-impact", "impact", "climate"], "imp")).toEqual(["impact", "deep-impact"]);
  });

  it("sorts each match group alphabetically", () => {
    expect(suggestTags(known, "clim")).toEqual(["climate", "climate-change"]);
  });

  it("matches case-insensitively", () => {
    expect(suggestTags(known, "CLIM")).toEqual(["climate", "climate-change"]);
  });

  it("excludes tags already added to the field", () => {
    expect(suggestTags(known, "clim", ["climate"])).toEqual(["climate-change"]);
  });

  it("excludes a tag that exactly matches the query already typed in full", () => {
    expect(suggestTags(known, "climate")).toEqual(["climate-change"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(suggestTags(known, "xyz")).toEqual([]);
  });

  it("caps results at the given limit", () => {
    const many = ["aa", "ab", "ac", "ad", "ae"];
    expect(suggestTags(many, "a", [], 3)).toEqual(["aa", "ab", "ac"]);
  });

  it("caps results at a default limit of 8", () => {
    const many = Array.from({ length: 12 }, (_, i) => `tag${String(i).padStart(2, "0")}`);
    expect(suggestTags(many, "tag")).toHaveLength(8);
  });

  it("de-duplicates known tags case-insensitively", () => {
    expect(suggestTags(["Climate", "climate", "CLIMATE"], "cli")).toEqual(["Climate"]);
  });
});

function makeContribution(overrides: Partial<AttributedContribution> = {}): AttributedContribution {
  return {
    id: "contrib-1",
    contributorId: "alice",
    kind: "card",
    likes: 0,
    saves: 0,
    qualitySignals: [0.5],
    reviewerEndorsements: [],
    ...overrides,
  };
}

describe("contributionToLibraryCard", () => {
  it("converts a contribution tagged with topic and caseArea into a LibraryCard", () => {
    expect(
      contributionToLibraryCard(
        makeContribution({ topic: "Energy", caseArea: "DA", tags: ["climate"], argBlock: "Warming DA" }),
      ),
    ).toEqual({
      id: "contrib-1",
      argBlock: "Warming DA",
      wordCount: 0,
      topic: "Energy",
      caseArea: "DA",
      tags: ["climate"],
    });
  });

  it("defaults tags to an empty array and argBlock to 'Untagged' when omitted", () => {
    expect(contributionToLibraryCard(makeContribution({ topic: "Energy", caseArea: "DA" }))).toEqual({
      id: "contrib-1",
      argBlock: "Untagged",
      wordCount: 0,
      topic: "Energy",
      caseArea: "DA",
      tags: [],
    });
  });

  it("returns null when topic is missing", () => {
    expect(contributionToLibraryCard(makeContribution({ caseArea: "DA" }))).toBeNull();
  });

  it("returns null when caseArea is missing", () => {
    expect(contributionToLibraryCard(makeContribution({ topic: "Energy" }))).toBeNull();
  });

  it("returns null when both topic and caseArea are missing", () => {
    expect(contributionToLibraryCard(makeContribution())).toBeNull();
  });
});

describe("buildLibraryCardsFromContributions", () => {
  it("converts only the contributions carrying both topic and caseArea", () => {
    const contributions = [
      makeContribution({ id: "c1", topic: "Energy", caseArea: "DA" }),
      makeContribution({ id: "c2" }),
      makeContribution({ id: "c3", topic: "Energy" }),
      makeContribution({ id: "c4", topic: "Water", caseArea: "CP", tags: ["federalism"] }),
    ];

    const cards = buildLibraryCardsFromContributions(contributions);
    expect(cards.map((card) => card.id)).toEqual(["c1", "c4"]);
  });

  it("returns an empty array when no contribution is tagged for the library", () => {
    expect(buildLibraryCardsFromContributions([makeContribution()])).toEqual([]);
  });
});

describe("renameTagInList", () => {
  it("replaces the tag when present", () => {
    expect(renameTagInList(["climate", "impact"], "climate", "warming")).toEqual(["impact", "warming"]);
  });

  it("returns the exact same array reference when the tag isn't present", () => {
    const tags = ["impact"];
    expect(renameTagInList(tags, "climate", "warming")).toBe(tags);
  });

  it("dedupes when the target tag is already present", () => {
    expect(renameTagInList(["climate", "warming"], "climate", "warming")).toEqual(["warming"]);
  });
});

describe("renameTagAcrossCards", () => {
  it("renames the tag on every card that carries it, leaving others untouched", () => {
    const { cards: updated, changedCount } = renameTagAcrossCards(cards, "climate", "warming");

    expect(changedCount).toBe(3);
    expect(updated.find((card) => card.id === "warming-1")!.tags).toEqual(["impact", "warming"]);
    expect(updated.find((card) => card.id === "warming-2")!.tags).toEqual(["warming"]);
    expect(updated.find((card) => card.id === "case-1")!.tags).toEqual(["solvency", "warming"]);
    // A card never carrying the old tag is returned as the exact same reference.
    const untouched = updated.find((card) => card.id === "states-1")!;
    expect(untouched).toBe(cards.find((card) => card.id === "states-1"));
  });

  it("merges into an existing tag name instead of duplicating it", () => {
    const { cards: updated, changedCount } = renameTagAcrossCards(cards, "impact", "climate");

    expect(changedCount).toBe(1);
    expect(updated.find((card) => card.id === "warming-1")!.tags).toEqual(["climate"]);
  });

  it("is a safe no-op when the tag isn't used anywhere", () => {
    const { cards: updated, changedCount } = renameTagAcrossCards(cards, "nonexistent", "whatever");

    expect(changedCount).toBe(0);
    expect(updated).toEqual(cards);
  });

  it("throws when oldTag is blank", () => {
    expect(() => renameTagAcrossCards(cards, "  ", "warming")).toThrow();
  });

  it("throws when newTag is blank", () => {
    expect(() => renameTagAcrossCards(cards, "climate", "  ")).toThrow();
  });

  it("throws when oldTag and newTag are the same", () => {
    expect(() => renameTagAcrossCards(cards, "climate", "climate")).toThrow();
  });
});
