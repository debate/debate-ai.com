import { describe, expect, it } from "vitest";
import {
  buildArgumentLibrary,
  buildLibrarySummaryText,
  buildTagCollections,
  buildTopicFolder,
  buildTopicFolders,
  filterCardsByTags,
  groupCardsByCaseArea,
  groupCardsByTopic,
  type LibraryCard,
} from "../src/lib/argument-library";

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
