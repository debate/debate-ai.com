import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPrepRoom,
  buildPrepRoomFromStore,
  buildPrepRoomSummaryText,
  searchPrepRoomEvidence,
} from "../src/lib/prep-room";
import type { EvidenceLibraryEntry } from "debate-research-evidence/src/lib/shared-evidence-library";
import { buildRoutingResult, type ContributorAvailability } from "debate-research-evidence/src/lib/research-task-routing";
import { buildTopicCoverageReport, type TrackedArgument } from "debate-research-evidence/src/lib/topic-coverage";
import { saveEvidenceLibraryEntry } from "debate-research-evidence/src/state/evidenceLibraryEntries";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const IMMIGRATION_CARD: EvidenceLibraryEntry = {
  id: "card-1",
  argBlock: "States CP",
  wordCount: 200,
  topic: "Immigration",
  caseArea: "Neg",
  tags: ["cp"],
  kind: "card",
  text: "The states can act as effective policy laboratories.",
  cite: "Smith 24",
};
const IMMIGRATION_BLOCK: EvidenceLibraryEntry = {
  id: "block-1",
  argBlock: "States CP",
  wordCount: 150,
  topic: "Immigration",
  caseArea: "Neg",
  tags: ["cp", "frontline"],
  kind: "block",
  text: "Frontline: perm do both solves the net benefit.",
  cite: "",
};
const TRADE_CARD: EvidenceLibraryEntry = {
  id: "card-2",
  argBlock: "Trade DA",
  wordCount: 300,
  topic: "Trade",
  caseArea: "Neg",
  tags: ["da"],
  kind: "card",
  text: "Tariffs collapse the trade agreement.",
  cite: "Jones 25",
};

const TRACKED_ARGUMENTS: TrackedArgument[] = [
  { argBlock: "States CP", category: "CP" },
  { argBlock: "Warming DA", category: "DA" },
];
const COVERAGE_REPORT = buildTopicCoverageReport(TRACKED_ARGUMENTS, [
  { id: "card-1", argBlock: "States CP", wordCount: 200 },
]);
const CONTRIBUTORS: ContributorAvailability[] = [
  { contributorId: "alice", skillLevel: "advanced", activeTaskCount: 0, maxConcurrentTasks: 3 },
];

describe("buildPrepRoom", () => {
  it("scopes entries to the room's topic, dropping entries filed under other topics", () => {
    const room = buildPrepRoom({
      topic: "Immigration",
      entries: [IMMIGRATION_CARD, IMMIGRATION_BLOCK, TRADE_CARD],
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    expect(room.entries).toEqual([IMMIGRATION_CARD, IMMIGRATION_BLOCK]);
  });

  it("splits out kind: block entries as draft blocks", () => {
    const room = buildPrepRoom({
      topic: "Immigration",
      entries: [IMMIGRATION_CARD, IMMIGRATION_BLOCK, TRADE_CARD],
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    expect(room.draftBlocks).toEqual([IMMIGRATION_BLOCK]);
  });

  it("organizes the topic's entries via the existing evidence-library index", () => {
    const room = buildPrepRoom({
      topic: "Immigration",
      entries: [IMMIGRATION_CARD, IMMIGRATION_BLOCK, TRADE_CARD],
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    expect(room.evidenceIndex.topicFolders).toHaveLength(1);
    expect(room.evidenceIndex.topicFolders[0].topic).toBe("Immigration");
    expect(room.evidenceIndex.topicFolders[0].cardCount).toBe(2);
    expect(room.evidenceIndex.tagCollections.map((collection) => collection.tag)).toEqual(["cp", "frontline"]);
  });

  it("routes the coverage report's gaps exactly as buildRoutingResult would directly", () => {
    const room = buildPrepRoom({
      topic: "Immigration",
      entries: [IMMIGRATION_CARD, IMMIGRATION_BLOCK, TRADE_CARD],
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    expect(room.routing).toEqual(buildRoutingResult(COVERAGE_REPORT, CONTRIBUTORS));
    expect(room.routing.assignments.map((assignment) => assignment.task.argBlock).sort()).toEqual([
      "States CP",
      "Warming DA",
    ]);
  });

  it("returns an empty room when nothing is filed under the topic", () => {
    const room = buildPrepRoom({
      topic: "Trade",
      entries: [IMMIGRATION_CARD, IMMIGRATION_BLOCK],
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    expect(room.entries).toEqual([]);
    expect(room.draftBlocks).toEqual([]);
    expect(room.evidenceIndex.topicFolders).toEqual([]);
  });
});

describe("buildPrepRoomFromStore", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it("reads entries from the persisted evidence library store when none are supplied", () => {
    saveEvidenceLibraryEntry(IMMIGRATION_CARD);
    saveEvidenceLibraryEntry(IMMIGRATION_BLOCK);
    saveEvidenceLibraryEntry(TRADE_CARD);

    const room = buildPrepRoomFromStore({
      topic: "Immigration",
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    expect(room.entries).toEqual([IMMIGRATION_CARD, IMMIGRATION_BLOCK]);
    expect(room.draftBlocks).toEqual([IMMIGRATION_BLOCK]);
  });

  it("returns an empty room when the store has no entries for the topic", () => {
    saveEvidenceLibraryEntry(TRADE_CARD);

    const room = buildPrepRoomFromStore({
      topic: "Immigration",
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    expect(room.entries).toEqual([]);
  });

  it("prefers explicitly supplied entries over the persisted store", () => {
    saveEvidenceLibraryEntry(TRADE_CARD);

    const room = buildPrepRoomFromStore({
      topic: "Immigration",
      entries: [IMMIGRATION_CARD],
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    expect(room.entries).toEqual([IMMIGRATION_CARD]);
  });

  it("behaves like buildPrepRoom when entries are explicitly supplied", () => {
    const input = {
      topic: "Immigration",
      entries: [IMMIGRATION_CARD, IMMIGRATION_BLOCK, TRADE_CARD],
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    };
    expect(buildPrepRoomFromStore(input)).toEqual(buildPrepRoom(input));
  });
});

describe("searchPrepRoomEvidence", () => {
  const room = buildPrepRoom({
    topic: "Immigration",
    entries: [IMMIGRATION_CARD, IMMIGRATION_BLOCK, TRADE_CARD],
    coverageReport: COVERAGE_REPORT,
    contributors: CONTRIBUTORS,
  });

  it("matches by keyword against the room's own entries only", () => {
    const results = searchPrepRoomEvidence(room, { text: "perm" });
    expect(results.map((result) => result.entry.id)).toEqual(["block-1"]);
  });

  it("never surfaces an entry from outside the room's topic", () => {
    const results = searchPrepRoomEvidence(room, { text: "tariffs" });
    expect(results).toEqual([]);
  });

  it("filters by kind within the room", () => {
    const results = searchPrepRoomEvidence(room, { kind: "block" });
    expect(results.map((result) => result.entry.id)).toEqual(["block-1"]);
  });

  it("returns every room entry, scored 0, when no text query is given", () => {
    const results = searchPrepRoomEvidence(room);
    expect(results).toEqual([
      { entry: IMMIGRATION_BLOCK, relevanceScore: 0 },
      { entry: IMMIGRATION_CARD, relevanceScore: 0 },
    ]);
  });
});

describe("buildPrepRoomSummaryText", () => {
  it("renders topic, evidence, draft-block count, and routing lines", () => {
    const room = buildPrepRoom({
      topic: "Immigration",
      entries: [IMMIGRATION_CARD, IMMIGRATION_BLOCK, TRADE_CARD],
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    const text = buildPrepRoomSummaryText(room);
    expect(text).toContain("Immigration prep room");
    expect(text).toContain("1 draft block");
    expect(text).toContain("alice: Warming DA");
  });

  it("uses plural draft blocks when the room has none", () => {
    const room = buildPrepRoom({
      topic: "Trade",
      entries: [TRADE_CARD],
      coverageReport: COVERAGE_REPORT,
      contributors: CONTRIBUTORS,
    });

    expect(buildPrepRoomSummaryText(room)).toContain("0 draft blocks");
  });
});
