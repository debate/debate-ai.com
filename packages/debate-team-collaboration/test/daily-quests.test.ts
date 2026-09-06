import { describe, expect, it } from "vitest";
import {
  buildDailyQuestBoard,
  buildQuestBoardPointsSummary,
  buildQuestBoardPointsSummaryText,
  buildQuestBoardSummaryText,
  buildUnderCoveredArgumentQuests,
  computeQuestProgress,
  DEFAULT_QUEST_DIFFICULTY,
  filterQuestBoardByDifficulty,
  getQuestDifficulty,
  getQuestDifficultyPoints,
  isQuestTemplateExpired,
  QUEST_DIFFICULTY_POINTS,
  remainingCardsToQuestDifficulty,
  rolloverRecurringQuestTemplate,
  type QuestContribution,
  type QuestTemplate,
} from "../src/lib/daily-quests";
import { buildTopicCoverageReport, type CoverageCardSummary, type TrackedArgument } from "debate-research-evidence/src/lib/topic-coverage";

const DAY_ONE = Date.parse("2026-08-10T12:00:00.000Z");
const DAY_ONE_LATER = Date.parse("2026-08-10T23:00:00.000Z");
const DAY_TWO = Date.parse("2026-08-11T09:00:00.000Z");

function card(id: string, argBlock: string, submittedAt: number): QuestContribution {
  return {
    id,
    kind: "card",
    contributorId: "alex",
    argBlock,
    submittedAt,
    likes: 0,
    saves: 0,
    qualitySignals: [],
    reviewerEndorsements: [],
  };
}

const findSolvencyCards: QuestTemplate = {
  id: "find-solvency-cards",
  description: "Find 5 solvency cards",
  target: { kind: "card", argBlock: "Solvency" },
  targetCount: 5,
};

describe("computeQuestProgress", () => {
  it("counts only contributions matching the day and target", () => {
    const contributions = [
      card("a", "Solvency", DAY_ONE),
      card("b", "Solvency", DAY_ONE_LATER),
      card("c", "Topicality", DAY_ONE),
      card("d", "Solvency", DAY_TWO),
    ];

    const progress = computeQuestProgress(findSolvencyCards, contributions, "2026-08-10");
    expect(progress.completedCount).toBe(2);
    expect(progress.remainingCount).toBe(3);
    expect(progress.isComplete).toBe(false);
  });

  it("ignores a mismatched contribution kind", () => {
    const contributions: QuestContribution[] = [
      { ...card("a", "Solvency", DAY_ONE), kind: "summary" },
      card("b", "Solvency", DAY_ONE),
    ];
    const progress = computeQuestProgress(findSolvencyCards, contributions, "2026-08-10");
    expect(progress.completedCount).toBe(1);
  });

  it("treats a quest as complete once the target count is reached", () => {
    const contributions = Array.from({ length: 5 }, (_, index) => card(`c${index}`, "Solvency", DAY_ONE));
    const progress = computeQuestProgress(findSolvencyCards, contributions, "2026-08-10");
    expect(progress.completedCount).toBe(5);
    expect(progress.remainingCount).toBe(0);
    expect(progress.isComplete).toBe(true);
  });

  it("matches any kind or argBlock when the target omits that field", () => {
    const anyCardQuest: QuestTemplate = {
      id: "any-cards",
      description: "Add 3 cards",
      target: { kind: "card" },
      targetCount: 3,
    };
    const contributions = [card("a", "Solvency", DAY_ONE), card("b", "Topicality", DAY_ONE)];
    expect(computeQuestProgress(anyCardQuest, contributions, "2026-08-10").completedCount).toBe(2);
  });
});

describe("isQuestTemplateExpired", () => {
  it("is never expired when expiresOn is omitted", () => {
    expect(isQuestTemplateExpired(findSolvencyCards, "2099-01-01")).toBe(false);
  });

  it("is not expired on its expiresOn day itself", () => {
    const expiring: QuestTemplate = { ...findSolvencyCards, expiresOn: "2026-08-10" };
    expect(isQuestTemplateExpired(expiring, "2026-08-10")).toBe(false);
  });

  it("is not expired before its expiresOn day", () => {
    const expiring: QuestTemplate = { ...findSolvencyCards, expiresOn: "2026-08-10" };
    expect(isQuestTemplateExpired(expiring, "2026-08-09")).toBe(false);
  });

  it("is expired the day after its expiresOn day", () => {
    const expiring: QuestTemplate = { ...findSolvencyCards, expiresOn: "2026-08-10" };
    expect(isQuestTemplateExpired(expiring, "2026-08-11")).toBe(true);
  });
});

describe("rolloverRecurringQuestTemplate", () => {
  it("leaves a template with no recurrence unchanged", () => {
    const expired: QuestTemplate = { ...findSolvencyCards, expiresOn: "2026-08-10" };
    expect(rolloverRecurringQuestTemplate(expired, "2026-08-13")).toBe(expired);
  });

  it("leaves a recurring template with no expiresOn unchanged", () => {
    const noAnchor: QuestTemplate = { ...findSolvencyCards, recurrence: "daily" };
    expect(rolloverRecurringQuestTemplate(noAnchor, "2026-08-13")).toBe(noAnchor);
  });

  it("leaves a recurring template that hasn't expired yet unchanged", () => {
    const stillActive: QuestTemplate = { ...findSolvencyCards, expiresOn: "2026-08-13", recurrence: "daily" };
    expect(rolloverRecurringQuestTemplate(stillActive, "2026-08-13")).toBe(stillActive);
  });

  it("advances a daily recurring template's expiresOn to today", () => {
    const expired: QuestTemplate = { ...findSolvencyCards, expiresOn: "2026-08-10", recurrence: "daily" };
    const rolled = rolloverRecurringQuestTemplate(expired, "2026-08-13");
    expect(rolled.expiresOn).toBe("2026-08-13");
    expect(rolled).not.toBe(expired);
    expect(rolled).toEqual({ ...expired, expiresOn: "2026-08-13" });
  });

  it("advances a weekly recurring template's expiresOn to the next 7-day boundary on or after today", () => {
    const expired: QuestTemplate = { ...findSolvencyCards, expiresOn: "2026-08-10", recurrence: "weekly" };
    const rolled = rolloverRecurringQuestTemplate(expired, "2026-08-11");
    expect(rolled.expiresOn).toBe("2026-08-17");
  });

  it("advances a weekly recurring template through several missed cycles at once", () => {
    const expired: QuestTemplate = { ...findSolvencyCards, expiresOn: "2026-08-10", recurrence: "weekly" };
    const rolled = rolloverRecurringQuestTemplate(expired, "2026-09-01");
    expect(rolled.expiresOn).toBe("2026-09-07");
  });
});

describe("buildDailyQuestBoard", () => {
  it("excludes an expired quest template from the board entirely", () => {
    const expired: QuestTemplate = { ...findSolvencyCards, id: "expired", expiresOn: "2026-08-09" };
    const active: QuestTemplate = { ...findSolvencyCards, id: "active" };

    const board = buildDailyQuestBoard([expired, active], [], DAY_ONE);

    expect(board.map((q) => q.questId)).toEqual(["active"]);
  });

  it("still includes a quest template on its own expiresOn day", () => {
    const stillActive: QuestTemplate = { ...findSolvencyCards, id: "still-active", expiresOn: "2026-08-10" };

    const board = buildDailyQuestBoard([stillActive], [], DAY_ONE);

    expect(board.map((q) => q.questId)).toEqual(["still-active"]);
  });

  it("orders incomplete quests before complete ones, tie-broken by id", () => {
    const doneQuest: QuestTemplate = { ...findSolvencyCards, id: "done", targetCount: 1 };
    const pendingQuestB: QuestTemplate = { ...findSolvencyCards, id: "pending-b", targetCount: 5 };
    const pendingQuestA: QuestTemplate = { ...findSolvencyCards, id: "pending-a", targetCount: 5 };

    const contributions = [card("a", "Solvency", DAY_ONE)];
    const board = buildDailyQuestBoard([doneQuest, pendingQuestB, pendingQuestA], contributions, DAY_ONE);

    expect(board.map((q) => q.questId)).toEqual(["pending-a", "pending-b", "done"]);
    expect(board.find((q) => q.questId === "done")?.isComplete).toBe(true);
  });

  it("scopes progress to the UTC day of `now`", () => {
    const contributions = [card("a", "Solvency", DAY_TWO)];
    const board = buildDailyQuestBoard([findSolvencyCards], contributions, DAY_ONE);
    expect(board[0].completedCount).toBe(0);
  });
});

describe("buildQuestBoardSummaryText", () => {
  it("renders the completed-vs-total quest count", () => {
    const board = buildDailyQuestBoard(
      [
        { ...findSolvencyCards, id: "a", targetCount: 1 },
        { ...findSolvencyCards, id: "b", targetCount: 5 },
      ],
      [card("x", "Solvency", DAY_ONE)],
      DAY_ONE,
    );
    expect(buildQuestBoardSummaryText(board)).toBe("1/2 quests complete today");
  });
});

describe("buildUnderCoveredArgumentQuests", () => {
  const tracked: TrackedArgument[] = [
    { argBlock: "Solvency" },
    { argBlock: "Topicality" },
    { argBlock: "Warming DA" },
  ];

  const cards: CoverageCardSummary[] = [
    { id: "1", argBlock: "Solvency", wordCount: 200 },
    { id: "2", argBlock: "Topicality", wordCount: 300 },
    { id: "3", argBlock: "Topicality", wordCount: 300 },
    { id: "4", argBlock: "Topicality", wordCount: 300 },
  ];

  it("generates one quest per under-covered tracked argument, worst-covered first", () => {
    const report = buildTopicCoverageReport(tracked, cards);
    const quests = buildUnderCoveredArgumentQuests(report);

    expect(quests.map((q) => q.id)).toEqual(["argblock:Warming DA", "argblock:Solvency"]);
    expect(quests[0].targetCount).toBe(3);
    expect(quests[0].description).toBe('Find 3 more cards for "Warming DA"');
    expect(quests[0].difficulty).toBe("hard");
    expect(quests[1].targetCount).toBe(2);
    expect(quests[1].description).toBe('Find 2 more cards for "Solvency"');
    expect(quests[1].difficulty).toBe("medium");
  });

  it("uses singular phrasing when only one more card is needed", () => {
    const almostCoveredTracked: TrackedArgument[] = [{ argBlock: "Solvency" }];
    const almostCoveredCards: CoverageCardSummary[] = [
      { id: "1", argBlock: "Solvency", wordCount: 300 },
      { id: "2", argBlock: "Solvency", wordCount: 300 },
    ];
    const report = buildTopicCoverageReport(almostCoveredTracked, almostCoveredCards);
    const quests = buildUnderCoveredArgumentQuests(report);
    expect(quests[0].targetCount).toBe(1);
    expect(quests[0].description).toBe('Find 1 more card for "Solvency"');
  });

  it("excludes arguments already covered", () => {
    const report = buildTopicCoverageReport(tracked, cards);
    const quests = buildUnderCoveredArgumentQuests(report);
    expect(quests.find((q) => q.id === "argblock:Topicality")).toBeUndefined();
  });

  it("asks for enough cards to clear the minimum count even when word count is already high", () => {
    const wordHeavyTracked: TrackedArgument[] = [{ argBlock: "Solvency" }];
    const wordHeavyCards: CoverageCardSummary[] = [{ id: "1", argBlock: "Solvency", wordCount: 5000 }];
    const report = buildTopicCoverageReport(wordHeavyTracked, wordHeavyCards);
    const quests = buildUnderCoveredArgumentQuests(report);
    expect(quests[0].targetCount).toBe(2);
  });

  it("returns no quests when every tracked argument is covered", () => {
    const fullCards: CoverageCardSummary[] = [
      { id: "1", argBlock: "Solvency", wordCount: 700 },
      { id: "2", argBlock: "Solvency", wordCount: 700 },
      { id: "3", argBlock: "Solvency", wordCount: 700 },
    ];
    const report = buildTopicCoverageReport([{ argBlock: "Solvency" }], fullCards);
    expect(buildUnderCoveredArgumentQuests(report)).toEqual([]);
  });
});

describe("remainingCardsToQuestDifficulty", () => {
  it("rates 1 remaining card as easy", () => {
    expect(remainingCardsToQuestDifficulty(1)).toBe("easy");
  });

  it("rates 2 remaining cards as medium", () => {
    expect(remainingCardsToQuestDifficulty(2)).toBe("medium");
  });

  it("rates 3 or more remaining cards as hard", () => {
    expect(remainingCardsToQuestDifficulty(3)).toBe("hard");
    expect(remainingCardsToQuestDifficulty(10)).toBe("hard");
  });
});

describe("getQuestDifficulty / getQuestDifficultyPoints", () => {
  it("defaults an undifficultied template to the default difficulty", () => {
    expect(getQuestDifficulty(findSolvencyCards)).toBe(DEFAULT_QUEST_DIFFICULTY);
    expect(getQuestDifficulty(findSolvencyCards)).toBe("medium");
  });

  it("returns an explicit difficulty as-is", () => {
    const easy: QuestTemplate = { ...findSolvencyCards, difficulty: "easy" };
    const hard: QuestTemplate = { ...findSolvencyCards, difficulty: "hard" };
    expect(getQuestDifficulty(easy)).toBe("easy");
    expect(getQuestDifficulty(hard)).toBe("hard");
  });

  it("maps each difficulty to its point value from QUEST_DIFFICULTY_POINTS", () => {
    expect(getQuestDifficultyPoints({ ...findSolvencyCards, difficulty: "easy" })).toBe(
      QUEST_DIFFICULTY_POINTS.easy,
    );
    expect(getQuestDifficultyPoints({ ...findSolvencyCards, difficulty: "medium" })).toBe(
      QUEST_DIFFICULTY_POINTS.medium,
    );
    expect(getQuestDifficultyPoints({ ...findSolvencyCards, difficulty: "hard" })).toBe(
      QUEST_DIFFICULTY_POINTS.hard,
    );
    expect(getQuestDifficultyPoints(findSolvencyCards)).toBe(QUEST_DIFFICULTY_POINTS.medium);
  });
});

describe("computeQuestProgress difficulty/points", () => {
  it("carries the quest's difficulty and point value through to its progress", () => {
    const hardQuest: QuestTemplate = { ...findSolvencyCards, difficulty: "hard" };
    const progress = computeQuestProgress(hardQuest, [], "2026-08-10");
    expect(progress.difficulty).toBe("hard");
    expect(progress.points).toBe(QUEST_DIFFICULTY_POINTS.hard);
  });

  it("defaults to medium when the template carries no difficulty", () => {
    const progress = computeQuestProgress(findSolvencyCards, [], "2026-08-10");
    expect(progress.difficulty).toBe("medium");
    expect(progress.points).toBe(QUEST_DIFFICULTY_POINTS.medium);
  });
});

describe("filterQuestBoardByDifficulty", () => {
  const board = buildDailyQuestBoard(
    [
      { ...findSolvencyCards, id: "e", difficulty: "easy" },
      { ...findSolvencyCards, id: "m", difficulty: "medium" },
      { ...findSolvencyCards, id: "h", difficulty: "hard" },
    ],
    [],
    DAY_ONE,
  );

  it("returns the board unchanged for 'all'", () => {
    expect(filterQuestBoardByDifficulty(board, "all")).toHaveLength(3);
  });

  it("narrows the board to one difficulty tier", () => {
    expect(filterQuestBoardByDifficulty(board, "hard").map((q) => q.questId)).toEqual(["h"]);
    expect(filterQuestBoardByDifficulty(board, "easy").map((q) => q.questId)).toEqual(["e"]);
  });
});

describe("buildQuestBoardPointsSummary / buildQuestBoardPointsSummaryText", () => {
  it("tallies earned points from complete quests only, against the board's full point value", () => {
    const easyDone: QuestTemplate = { ...findSolvencyCards, id: "easy-done", targetCount: 1, difficulty: "easy" };
    const hardPending: QuestTemplate = { ...findSolvencyCards, id: "hard-pending", difficulty: "hard" };
    const board = buildDailyQuestBoard([easyDone, hardPending], [card("a", "Solvency", DAY_ONE)], DAY_ONE);

    expect(buildQuestBoardPointsSummary(board)).toEqual({
      earnedPoints: QUEST_DIFFICULTY_POINTS.easy,
      totalPoints: QUEST_DIFFICULTY_POINTS.easy + QUEST_DIFFICULTY_POINTS.hard,
    });
    expect(buildQuestBoardPointsSummaryText(board)).toBe(
      `${QUEST_DIFFICULTY_POINTS.easy}/${QUEST_DIFFICULTY_POINTS.easy + QUEST_DIFFICULTY_POINTS.hard} points earned today`,
    );
  });

  it("returns zero over zero for an empty board", () => {
    expect(buildQuestBoardPointsSummary([])).toEqual({ earnedPoints: 0, totalPoints: 0 });
  });
});
