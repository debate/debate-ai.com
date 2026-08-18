import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPersistedDailyQuestBoard,
  deleteQuestTemplate,
  listQuestTemplates,
  saveQuestTemplate,
  seedQuestTemplatesFromTopicCoverage,
} from "../src/state/dailyQuests";
import { saveContribution } from "../src/state/contributions";
import { saveTrackedArgument } from "../src/state/trackedArguments";
import { saveEvidenceLibraryEntry } from "../src/state/evidenceLibraryEntries";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";
import type { QuestTemplate } from "../src/lib/daily-quests";
import type { EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";

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

const FIND_CARDS: QuestTemplate = {
  id: "custom-1",
  description: "Find 2 solvency cards",
  target: { kind: "card", argBlock: "Solvency" },
  targetCount: 2,
};
const ADD_ANNOTATIONS: QuestTemplate = {
  id: "custom-2",
  description: "Add 3 annotations",
  target: { kind: "annotation" },
  targetCount: 3,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listQuestTemplates", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listQuestTemplates()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("dailyQuestTemplates", "{not json");
    expect(listQuestTemplates()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("dailyQuestTemplates", JSON.stringify({ not: "an array" }));
    expect(listQuestTemplates()).toEqual([]);
  });

  it("lists every saved template", () => {
    saveQuestTemplate(FIND_CARDS);
    saveQuestTemplate(ADD_ANNOTATIONS);
    expect(listQuestTemplates()).toEqual([FIND_CARDS, ADD_ANNOTATIONS]);
  });
});

describe("saveQuestTemplate", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveQuestTemplate(FIND_CARDS);
    const updated: QuestTemplate = { ...FIND_CARDS, targetCount: 5 };
    saveQuestTemplate(updated);

    expect(listQuestTemplates()).toEqual([updated]);
  });
});

describe("deleteQuestTemplate", () => {
  it("removes a stored template by id", () => {
    saveQuestTemplate(FIND_CARDS);
    saveQuestTemplate(ADD_ANNOTATIONS);
    deleteQuestTemplate(FIND_CARDS.id);

    expect(listQuestTemplates()).toEqual([ADD_ANNOTATIONS]);
  });

  it("is a no-op when the id isn't stored", () => {
    saveQuestTemplate(ADD_ANNOTATIONS);
    deleteQuestTemplate("missing");
    expect(listQuestTemplates()).toEqual([ADD_ANNOTATIONS]);
  });
});

describe("seedQuestTemplatesFromTopicCoverage", () => {
  it("saves an under-covered argument's quest and returns it", () => {
    saveTrackedArgument({ id: "tracked-1", topic: "Energy Policy", argBlock: "Solvency" });

    const seeded = seedQuestTemplatesFromTopicCoverage("Energy Policy");

    expect(seeded).toEqual([
      {
        id: "argblock:Solvency",
        description: 'Find 3 more cards for "Solvency"',
        target: { kind: "card", argBlock: "Solvency" },
        targetCount: 3,
      },
    ]);
    expect(listQuestTemplates()).toEqual(seeded);
  });

  it("upserts on repeated seeding rather than duplicating the template", () => {
    saveTrackedArgument({ id: "tracked-1", topic: "Energy Policy", argBlock: "Solvency" });

    seedQuestTemplatesFromTopicCoverage("Energy Policy");
    seedQuestTemplatesFromTopicCoverage("Energy Policy");

    expect(listQuestTemplates()).toHaveLength(1);
  });

  it("seeds nothing for a topic with no under-covered arguments", () => {
    const card: EvidenceLibraryEntry = {
      id: "entry-1",
      argBlock: "Warming DA",
      wordCount: 700,
      topic: "Energy Policy",
      caseArea: "DA",
      tags: [],
      kind: "card",
      text: "Enough cards to be fully covered.",
      cite: "Smith 24",
    };
    saveTrackedArgument({ id: "tracked-1", topic: "Energy Policy", argBlock: "Warming DA" });
    saveEvidenceLibraryEntry(card);
    saveEvidenceLibraryEntry({ ...card, id: "entry-2", cite: "Lee 25" });
    saveEvidenceLibraryEntry({ ...card, id: "entry-3", cite: "Chen 25" });

    const seeded = seedQuestTemplatesFromTopicCoverage("Energy Policy");

    expect(seeded).toEqual([]);
    expect(listQuestTemplates()).toEqual([]);
  });

  it("does not clobber a preexisting custom quest with a different id", () => {
    saveQuestTemplate(ADD_ANNOTATIONS);
    saveTrackedArgument({ id: "tracked-1", topic: "Energy Policy", argBlock: "Solvency" });

    seedQuestTemplatesFromTopicCoverage("Energy Policy");

    expect(listQuestTemplates().map((template) => template.id).sort()).toEqual(["argblock:Solvency", "custom-2"]);
  });
});

describe("buildPersistedDailyQuestBoard", () => {
  const NOW = Date.UTC(2026, 7, 16, 12, 0, 0);

  function cardContribution(overrides: Partial<AttributedContribution>): AttributedContribution {
    return {
      id: "contrib-1",
      contributorId: "alice",
      kind: "card",
      likes: 0,
      saves: 0,
      qualitySignals: [],
      reviewerEndorsements: [],
      submittedAt: NOW,
      argBlock: "Solvency",
      ...overrides,
    };
  }

  it("returns an empty board when nothing is stored", () => {
    expect(buildPersistedDailyQuestBoard(NOW)).toEqual([]);
  });

  it("scores a saved quest against matching, same-day, submittedAt-carrying contributions", () => {
    saveQuestTemplate(FIND_CARDS);
    saveContribution(cardContribution({ id: "contrib-1" }));
    saveContribution(cardContribution({ id: "contrib-2" }));

    const board = buildPersistedDailyQuestBoard(NOW);

    expect(board).toEqual([
      {
        questId: FIND_CARDS.id,
        description: FIND_CARDS.description,
        targetCount: 2,
        completedCount: 2,
        remainingCount: 0,
        isComplete: true,
      },
    ]);
  });

  it("excludes a contribution that doesn't match the quest's target", () => {
    saveQuestTemplate(FIND_CARDS);
    saveContribution(cardContribution({ id: "contrib-1", argBlock: "Politics DA" }));

    const board = buildPersistedDailyQuestBoard(NOW);
    expect(board[0].completedCount).toBe(0);
  });

  it("excludes a contribution submitted on a different UTC day", () => {
    saveQuestTemplate(FIND_CARDS);
    saveContribution(cardContribution({ id: "contrib-1" }));
    saveContribution(cardContribution({ id: "contrib-2", submittedAt: Date.UTC(2026, 7, 15, 12, 0, 0) }));

    const board = buildPersistedDailyQuestBoard(NOW);
    expect(board[0].completedCount).toBe(1);
  });

  it("excludes a contribution without a submittedAt timestamp rather than throwing", () => {
    saveQuestTemplate(FIND_CARDS);
    saveContribution(cardContribution({ id: "contrib-1" }));
    const untimestamped: AttributedContribution = {
      id: "contrib-2",
      contributorId: "bob",
      kind: "card",
      likes: 0,
      saves: 0,
      qualitySignals: [],
      reviewerEndorsements: [],
      argBlock: "Solvency",
    };
    saveContribution(untimestamped);

    const board = buildPersistedDailyQuestBoard(NOW);
    expect(board[0].completedCount).toBe(1);
  });
});
