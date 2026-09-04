import { beforeEach, describe, expect, it } from "vitest";
import { buildPersistedPrepRoom, listPrepRoomTopics } from "../src/state/prepRooms";
import { saveEvidenceLibraryEntry } from "debate-research-evidence/src/state/evidenceLibraryEntries";
import { saveTrackedArgument } from "debate-research-evidence/src/state/trackedArguments";
import { saveContributorAvailability } from "../src/state/contributorAvailability";
import type { EvidenceLibraryEntry } from "debate-research-evidence/src/lib/shared-evidence-library";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildPersistedPrepRoom", () => {
  it("composes a topic's room entirely from the persisted evidence, checklist, and contributor stores", () => {
    saveEvidenceLibraryEntry(IMMIGRATION_CARD);
    saveEvidenceLibraryEntry(IMMIGRATION_BLOCK);
    saveEvidenceLibraryEntry(TRADE_CARD);
    saveTrackedArgument({ id: "t-1", topic: "Immigration", argBlock: "States CP", category: "CP" });
    saveTrackedArgument({ id: "t-2", topic: "Immigration", argBlock: "Warming DA", category: "DA" });
    saveContributorAvailability({
      contributorId: "alice",
      skillLevel: "advanced",
      activeTaskCount: 0,
      maxConcurrentTasks: 3,
    });

    const room = buildPersistedPrepRoom("Immigration");

    expect(room.entries).toEqual([IMMIGRATION_CARD, IMMIGRATION_BLOCK]);
    expect(room.draftBlocks).toEqual([IMMIGRATION_BLOCK]);
    expect(room.routing.assignments.map((assignment) => assignment.task.argBlock).sort()).toEqual([
      "States CP",
      "Warming DA",
    ]);
  });

  it("returns an empty room for a topic with no persisted state at all", () => {
    const room = buildPersistedPrepRoom("Untouched Topic");

    expect(room.entries).toEqual([]);
    expect(room.draftBlocks).toEqual([]);
    expect(room.routing.assignments).toEqual([]);
  });

  it("routes gaps to nobody when no contributor is persisted", () => {
    saveTrackedArgument({ id: "t-1", topic: "Immigration", argBlock: "States CP", category: "CP" });

    const room = buildPersistedPrepRoom("Immigration");

    expect(room.routing.unassignedTasks.map((task) => task.argBlock)).toEqual(["States CP"]);
  });
});

describe("listPrepRoomTopics", () => {
  it("returns an empty list when nothing is persisted", () => {
    expect(listPrepRoomTopics()).toEqual([]);
  });

  it("unions topics from the checklist and evidence-library stores, deduplicated and sorted", () => {
    saveEvidenceLibraryEntry(IMMIGRATION_CARD);
    saveEvidenceLibraryEntry(TRADE_CARD);
    saveTrackedArgument({ id: "t-1", topic: "Immigration", argBlock: "States CP", category: "CP" });
    saveTrackedArgument({ id: "t-2", topic: "Space Policy", argBlock: "Militarization DA" });

    expect(listPrepRoomTopics()).toEqual(["Immigration", "Space Policy", "Trade"]);
  });
});
