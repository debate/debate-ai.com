import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPersistedDailyQuestBoard,
  buildPersistedTeamQuestCompetition,
  deleteQuestTeam,
  deleteQuestTemplate,
  listQuestTeams,
  listQuestTemplates,
  previewQuestTemplatesFromTopicCoverage,
  pruneExpiredQuestTemplates,
  replaceQuestTeams,
  rolloverExpiredRecurringQuestTemplates,
  saveQuestTeam,
  saveQuestTemplate,
  seedQuestTemplatesFromTopicCoverage,
} from "../src/state/dailyQuests";
import { saveContribution } from "debate-research-evidence/src/state/contributions";
import { saveTrackedArgument } from "debate-research-evidence/src/state/trackedArguments";
import { saveEvidenceLibraryEntry } from "debate-research-evidence/src/state/evidenceLibraryEntries";
import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";
import type { QuestTeam, QuestTemplate } from "../src/lib/daily-quests";
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

describe("pruneExpiredQuestTemplates", () => {
  const NOW = Date.UTC(2026, 7, 16, 12, 0, 0); // 2026-08-16

  it("returns 0 and leaves storage untouched when nothing is stored", () => {
    expect(pruneExpiredQuestTemplates(NOW)).toBe(0);
    expect(listQuestTemplates()).toEqual([]);
  });

  it("removes a template whose expiresOn has passed and returns the removed count", () => {
    const expired: QuestTemplate = { ...FIND_CARDS, expiresOn: "2026-08-15" };
    saveQuestTemplate(expired);

    expect(pruneExpiredQuestTemplates(NOW)).toBe(1);
    expect(listQuestTemplates()).toEqual([]);
  });

  it("leaves a template with no expiresOn untouched", () => {
    saveQuestTemplate(FIND_CARDS);

    expect(pruneExpiredQuestTemplates(NOW)).toBe(0);
    expect(listQuestTemplates()).toEqual([FIND_CARDS]);
  });

  it("leaves a template whose expiresOn hasn't passed yet (including today) untouched", () => {
    const stillActive: QuestTemplate = { ...FIND_CARDS, expiresOn: "2026-08-16" };
    saveQuestTemplate(stillActive);

    expect(pruneExpiredQuestTemplates(NOW)).toBe(0);
    expect(listQuestTemplates()).toEqual([stillActive]);
  });

  it("removes only the expired templates, leaving others in place", () => {
    const expired: QuestTemplate = { ...FIND_CARDS, expiresOn: "2026-08-15" };
    saveQuestTemplate(expired);
    saveQuestTemplate(ADD_ANNOTATIONS);

    expect(pruneExpiredQuestTemplates(NOW)).toBe(1);
    expect(listQuestTemplates()).toEqual([ADD_ANNOTATIONS]);
  });

  it("never removes an expired recurring template — it rolls it over instead", () => {
    const recurring: QuestTemplate = { ...FIND_CARDS, expiresOn: "2026-08-15", recurrence: "daily" };
    saveQuestTemplate(recurring);

    expect(pruneExpiredQuestTemplates(NOW)).toBe(0);
    expect(listQuestTemplates()).toEqual([{ ...recurring, expiresOn: "2026-08-16" }]);
  });
});

describe("rolloverExpiredRecurringQuestTemplates", () => {
  const NOW = Date.UTC(2026, 7, 16, 12, 0, 0); // 2026-08-16

  it("returns 0 and leaves storage untouched when nothing is stored", () => {
    expect(rolloverExpiredRecurringQuestTemplates(NOW)).toBe(0);
    expect(listQuestTemplates()).toEqual([]);
  });

  it("leaves a non-recurring expired template untouched", () => {
    const expired: QuestTemplate = { ...FIND_CARDS, expiresOn: "2026-08-15" };
    saveQuestTemplate(expired);

    expect(rolloverExpiredRecurringQuestTemplates(NOW)).toBe(0);
    expect(listQuestTemplates()).toEqual([expired]);
  });

  it("rolls an expired daily recurring template's expiresOn forward and returns the rolled-over count", () => {
    const recurring: QuestTemplate = { ...FIND_CARDS, expiresOn: "2026-08-14", recurrence: "daily" };
    saveQuestTemplate(recurring);

    expect(rolloverExpiredRecurringQuestTemplates(NOW)).toBe(1);
    expect(listQuestTemplates()).toEqual([{ ...recurring, expiresOn: "2026-08-16" }]);
  });

  it("leaves a recurring template that hasn't expired yet untouched", () => {
    const stillActive: QuestTemplate = { ...FIND_CARDS, expiresOn: "2026-08-16", recurrence: "weekly" };
    saveQuestTemplate(stillActive);

    expect(rolloverExpiredRecurringQuestTemplates(NOW)).toBe(0);
    expect(listQuestTemplates()).toEqual([stillActive]);
  });

  it("rolls over only the expired recurring templates among several", () => {
    const recurring: QuestTemplate = { ...FIND_CARDS, expiresOn: "2026-08-15", recurrence: "daily" };
    const nonRecurringExpired: QuestTemplate = { ...ADD_ANNOTATIONS, expiresOn: "2026-08-15" };
    saveQuestTemplate(recurring);
    saveQuestTemplate(nonRecurringExpired);

    expect(rolloverExpiredRecurringQuestTemplates(NOW)).toBe(1);
    expect(listQuestTemplates()).toEqual([{ ...recurring, expiresOn: "2026-08-16" }, nonRecurringExpired]);
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
        difficulty: "hard",
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

describe("previewQuestTemplatesFromTopicCoverage", () => {
  it("derives the same templates seeding would save, without writing anything", () => {
    saveTrackedArgument({ id: "tracked-1", topic: "Energy Policy", argBlock: "Solvency" });

    const preview = previewQuestTemplatesFromTopicCoverage("Energy Policy");

    expect(preview).toEqual([
      {
        template: {
          id: "argblock:Solvency",
          description: 'Find 3 more cards for "Solvency"',
          target: { kind: "card", argBlock: "Solvency" },
          targetCount: 3,
          difficulty: "hard",
        },
        alreadySeeded: false,
      },
    ]);
    expect(listQuestTemplates()).toEqual([]);
  });

  it("flags a previewed template as already seeded when it's already on the stored roster", () => {
    saveTrackedArgument({ id: "tracked-1", topic: "Energy Policy", argBlock: "Solvency" });
    seedQuestTemplatesFromTopicCoverage("Energy Policy");

    const preview = previewQuestTemplatesFromTopicCoverage("Energy Policy");

    expect(preview).toHaveLength(1);
    expect(preview[0].alreadySeeded).toBe(true);
    expect(preview[0].template.id).toBe("argblock:Solvency");
  });

  it("returns an empty list for a topic with no under-covered arguments", () => {
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

    expect(previewQuestTemplatesFromTopicCoverage("Energy Policy")).toEqual([]);
  });

  it("does not consider an unrelated stored template as already seeded", () => {
    saveQuestTemplate(ADD_ANNOTATIONS);
    saveTrackedArgument({ id: "tracked-1", topic: "Energy Policy", argBlock: "Solvency" });

    const preview = previewQuestTemplatesFromTopicCoverage("Energy Policy");

    expect(preview).toHaveLength(1);
    expect(preview[0].alreadySeeded).toBe(false);
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
        difficulty: "medium",
        points: 10,
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

  it("rolls an expired recurring template's next cycle back onto the board, freshly at 0 progress", () => {
    const recurring: QuestTemplate = { ...FIND_CARDS, expiresOn: "2026-08-15", recurrence: "daily" };
    saveQuestTemplate(recurring);
    saveContribution(cardContribution({ id: "contrib-1", submittedAt: Date.UTC(2026, 7, 15, 12, 0, 0) }));

    const board = buildPersistedDailyQuestBoard(NOW);

    expect(board).toEqual([
      {
        questId: recurring.id,
        description: recurring.description,
        targetCount: 2,
        completedCount: 0,
        remainingCount: 2,
        isComplete: false,
        difficulty: "medium",
        points: 10,
      },
    ]);
    expect(listQuestTemplates()).toEqual([{ ...recurring, expiresOn: "2026-08-16" }]);
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

describe("listQuestTeams / saveQuestTeam / deleteQuestTeam", () => {
  const ALPHA: QuestTeam = { id: "alpha", name: "Team Alpha", contributorIds: ["alex", "jordan"] };
  const BETA: QuestTeam = { id: "beta", name: "Team Beta", contributorIds: ["sam"] };

  it("returns an empty list when nothing is stored", () => {
    expect(listQuestTeams()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("questTeams", "{not json");
    expect(listQuestTeams()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("questTeams", JSON.stringify({ not: "an array" }));
    expect(listQuestTeams()).toEqual([]);
  });

  it("lists every saved team", () => {
    saveQuestTeam(ALPHA);
    saveQuestTeam(BETA);
    expect(listQuestTeams()).toEqual([ALPHA, BETA]);
  });

  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveQuestTeam(ALPHA);
    const updated: QuestTeam = { ...ALPHA, contributorIds: ["alex", "jordan", "sam"] };
    saveQuestTeam(updated);
    expect(listQuestTeams()).toEqual([updated]);
  });

  it("deletes a team by id", () => {
    saveQuestTeam(ALPHA);
    saveQuestTeam(BETA);
    deleteQuestTeam(ALPHA.id);
    expect(listQuestTeams()).toEqual([BETA]);
  });

  it("is a no-op deleting a team that isn't stored", () => {
    saveQuestTeam(ALPHA);
    deleteQuestTeam("not-stored");
    expect(listQuestTeams()).toEqual([ALPHA]);
  });
});

describe("replaceQuestTeams", () => {
  const ALPHA: QuestTeam = { id: "alpha", name: "Team Alpha", contributorIds: ["alex", "jordan"] };
  const BETA: QuestTeam = { id: "beta", name: "Team Beta", contributorIds: ["sam"] };

  it("overwrites the entire stored roster", () => {
    saveQuestTeam(ALPHA);
    replaceQuestTeams([BETA]);
    expect(listQuestTeams()).toEqual([BETA]);
  });

  it("clears the roster when given an empty list", () => {
    saveQuestTeam(ALPHA);
    saveQuestTeam(BETA);
    replaceQuestTeams([]);
    expect(listQuestTeams()).toEqual([]);
  });
});

describe("buildPersistedTeamQuestCompetition", () => {
  const NOW = Date.UTC(2026, 7, 16, 12, 0, 0);

  function cardContribution(overrides: Partial<AttributedContribution>): AttributedContribution {
    return {
      id: "contrib-1",
      contributorId: "alex",
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

  it("returns an empty list when no teams are stored", () => {
    expect(buildPersistedTeamQuestCompetition(NOW)).toEqual([]);
  });

  it("ranks stored teams by their members' real, persisted contributions against the stored quest roster", () => {
    saveQuestTemplate(FIND_CARDS); // targetCount 2
    saveQuestTeam({ id: "alpha", name: "Team Alpha", contributorIds: ["alex", "jordan"] });
    saveQuestTeam({ id: "beta", name: "Team Beta", contributorIds: ["sam"] });

    // alex completes the quest alone; sam contributes nothing.
    saveContribution(cardContribution({ id: "c1", contributorId: "alex" }));
    saveContribution(cardContribution({ id: "c2", contributorId: "alex" }));

    const standings = buildPersistedTeamQuestCompetition(NOW);

    expect(standings.map((s) => ({ teamId: s.teamId, earnedPoints: s.earnedPoints }))).toEqual([
      { teamId: "alpha", earnedPoints: 10 },
      { teamId: "beta", earnedPoints: 0 },
    ]);
  });
});
