import { describe, expect, it } from "vitest";
import {
  buildChallengeCompletionAnnouncementText,
  buildGroupChallengeBoard,
  buildGroupChallengeSummaryText,
  computeChallengeCompletionTimestamp,
  computeGroupChallengeProgress,
  type ChallengeWinEvent,
  type GroupChallenge,
} from "../src/lib/group-challenges";
import type { QuestContribution } from "../src/lib/daily-quests";

const WEEK_START = Date.parse("2026-08-10T00:00:00.000Z");
const WEEK_END = Date.parse("2026-08-17T00:00:00.000Z");

function card(
  id: string,
  contributorId: string,
  submittedAt: number,
  overrides: Partial<QuestContribution> = {},
): QuestContribution {
  return {
    id,
    kind: "card",
    contributorId,
    argBlock: "Solvency",
    submittedAt,
    likes: 0,
    saves: 0,
    qualitySignals: [],
    reviewerEndorsements: [],
    ...overrides,
  };
}

const cardChallenge: GroupChallenge = {
  id: "find-solvency-cards",
  title: "Find 10 solvency cards",
  goal: { kind: "contribution_target", target: { kind: "card", argBlock: "Solvency" }, targetCount: 10 },
  memberIds: ["alex", "sam"],
  startsAt: WEEK_START,
  endsAt: WEEK_END,
};

const winChallenge: GroupChallenge = {
  id: "win-rebuttals",
  title: "Win 3 rebuttal exercises",
  goal: { kind: "win_target", targetCount: 3 },
  memberIds: ["alex", "sam"],
  startsAt: WEEK_START,
  endsAt: WEEK_END,
};

describe("computeGroupChallengeProgress — contribution_target", () => {
  it("counts only in-window, roster, matching contributions", () => {
    const contributions = [
      card("a", "alex", WEEK_START + 1000),
      card("b", "alex", WEEK_START - 1000), // before window
      card("c", "alex", WEEK_END), // window end is exclusive
      card("d", "jordan", WEEK_START + 1000), // not on roster
      card("e", "sam", WEEK_START + 1000, { argBlock: "Topicality" }), // wrong argBlock
    ];

    const progress = computeGroupChallengeProgress(cardChallenge, contributions, [], WEEK_START + 2000);
    expect(progress.completedCount).toBe(1);
    expect(progress.remainingCount).toBe(9);
    expect(progress.isComplete).toBe(false);
  });

  it("treats the challenge as complete once the target count is reached", () => {
    const contributions = Array.from({ length: 10 }, (_, index) => card(`c${index}`, "alex", WEEK_START + 1000));
    const progress = computeGroupChallengeProgress(cardChallenge, contributions, [], WEEK_START + 2000);
    expect(progress.completedCount).toBe(10);
    expect(progress.remainingCount).toBe(0);
    expect(progress.isComplete).toBe(true);
  });

  it("ranks member standings by helpfulness score rather than raw count", () => {
    const contributions = [
      // alex: 3 low-quality cards
      card("a1", "alex", WEEK_START + 1000, { likes: 1 }),
      card("a2", "alex", WEEK_START + 1000, { likes: 1 }),
      card("a3", "alex", WEEK_START + 1000, { likes: 1 }),
      // sam: 1 high-quality, heavily-endorsed card
      card("s1", "sam", WEEK_START + 1000, {
        likes: 50,
        saves: 50,
        qualitySignals: [1, 1, 1],
        reviewerEndorsements: [{ reviewerWeight: 1 }, { reviewerWeight: 1 }],
      }),
    ];

    const progress = computeGroupChallengeProgress(cardChallenge, contributions, [], WEEK_START + 2000);
    expect(progress.completedCount).toBe(4);
    expect(progress.memberStandings[0].contributorId).toBe("sam");
    expect(progress.memberStandings[0].matchingCount).toBe(1);
    expect(progress.memberStandings[1].contributorId).toBe("alex");
    expect(progress.memberStandings[1].matchingCount).toBe(3);
    expect(progress.mvpContributorId).toBe("sam");
    expect(progress.memberStandings.every((standing) => standing.helpfulnessScore !== undefined)).toBe(true);
  });
});

describe("computeGroupChallengeProgress — win_target", () => {
  it("counts only in-window, roster win events", () => {
    const winEvents: ChallengeWinEvent[] = [
      { contributorId: "alex", occurredAt: WEEK_START + 1000 },
      { contributorId: "alex", occurredAt: WEEK_START - 1000 }, // before window
      { contributorId: "jordan", occurredAt: WEEK_START + 1000 }, // not on roster
      { contributorId: "sam", occurredAt: WEEK_START + 2000 },
    ];

    const progress = computeGroupChallengeProgress(winChallenge, [], winEvents, WEEK_START + 3000);
    expect(progress.completedCount).toBe(2);
    expect(progress.remainingCount).toBe(1);
    expect(progress.isComplete).toBe(false);
  });

  it("ranks member standings by raw win count, tie-broken by contributorId", () => {
    const winEvents: ChallengeWinEvent[] = [
      { contributorId: "sam", occurredAt: WEEK_START + 1000 },
      { contributorId: "alex", occurredAt: WEEK_START + 1000 },
      { contributorId: "sam", occurredAt: WEEK_START + 2000 },
    ];

    const progress = computeGroupChallengeProgress(winChallenge, [], winEvents, WEEK_START + 3000);
    expect(progress.memberStandings).toEqual([
      { contributorId: "sam", matchingCount: 2 },
      { contributorId: "alex", matchingCount: 1 },
    ]);
    expect(progress.mvpContributorId).toBe("sam");
    expect(progress.memberStandings[0].helpfulnessScore).toBeUndefined();
  });

  it("leaves mvpContributorId undefined when nobody has any matching activity", () => {
    const progress = computeGroupChallengeProgress(winChallenge, [], [], WEEK_START + 1000);
    expect(progress.memberStandings).toEqual([]);
    expect(progress.mvpContributorId).toBeUndefined();
  });
});

describe("computeGroupChallengeProgress — window state", () => {
  it("reports hasEnded and zero daysRemaining once now reaches endsAt", () => {
    const progress = computeGroupChallengeProgress(cardChallenge, [], [], WEEK_END);
    expect(progress.hasEnded).toBe(true);
    expect(progress.daysRemaining).toBe(0);
  });

  it("computes whole days remaining until endsAt", () => {
    const twoDaysBeforeEnd = WEEK_END - 2 * 24 * 60 * 60 * 1000;
    const progress = computeGroupChallengeProgress(cardChallenge, [], [], twoDaysBeforeEnd);
    expect(progress.hasEnded).toBe(false);
    expect(progress.daysRemaining).toBe(2);
  });
});

describe("buildGroupChallengeBoard", () => {
  it("orders incomplete challenges before complete ones, tie-broken by id", () => {
    const doneChallenge: GroupChallenge = {
      ...cardChallenge,
      id: "done",
      goal: { ...cardChallenge.goal, targetCount: 1 } as GroupChallenge["goal"],
    };
    const pendingB: GroupChallenge = { ...cardChallenge, id: "pending-b" };
    const pendingA: GroupChallenge = { ...cardChallenge, id: "pending-a" };

    const contributions = [card("a", "alex", WEEK_START + 1000)];
    const board = buildGroupChallengeBoard([doneChallenge, pendingB, pendingA], contributions, [], WEEK_START + 2000);

    expect(board.map((progress) => progress.challengeId)).toEqual(["pending-a", "pending-b", "done"]);
    expect(board.find((progress) => progress.challengeId === "done")?.isComplete).toBe(true);
  });
});

describe("buildGroupChallengeSummaryText", () => {
  it("renders a completed challenge", () => {
    const progress = computeGroupChallengeProgress(
      { ...cardChallenge, goal: { ...cardChallenge.goal, targetCount: 1 } as GroupChallenge["goal"] },
      [card("a", "alex", WEEK_START + 1000)],
      [],
      WEEK_START + 2000,
    );
    expect(buildGroupChallengeSummaryText(progress)).toBe('"Find 10 solvency cards" complete! (1/1)');
  });

  it("renders an ended, incomplete challenge", () => {
    const progress = computeGroupChallengeProgress(cardChallenge, [], [], WEEK_END);
    expect(buildGroupChallengeSummaryText(progress)).toBe('"Find 10 solvency cards" ended at 0/10 — not completed');
  });

  it("renders an in-progress challenge with plural days remaining", () => {
    const progress = computeGroupChallengeProgress(cardChallenge, [], [], WEEK_START + 1000);
    expect(buildGroupChallengeSummaryText(progress)).toBe('"Find 10 solvency cards": 0/10 — 7 days left');
  });

  it("renders an in-progress challenge with singular day remaining", () => {
    const oneDayBeforeEnd = WEEK_END - 24 * 60 * 60 * 1000;
    const progress = computeGroupChallengeProgress(cardChallenge, [], [], oneDayBeforeEnd);
    expect(buildGroupChallengeSummaryText(progress)).toBe('"Find 10 solvency cards": 0/10 — 1 day left');
  });
});

describe("computeChallengeCompletionTimestamp — contribution_target", () => {
  const smallCardChallenge: GroupChallenge = { ...cardChallenge, goal: { ...cardChallenge.goal, targetCount: 2 } as GroupChallenge["goal"] };

  it("returns the timestamp of the targetCount-th matching contribution", () => {
    const contributions = [
      card("a", "alex", WEEK_START + 1000),
      card("b", "sam", WEEK_START + 3000),
      card("c", "alex", WEEK_START + 2000),
    ];
    expect(computeChallengeCompletionTimestamp(smallCardChallenge, contributions, [])).toBe(WEEK_START + 2000);
  });

  it("returns null when the goal hasn't been reached yet", () => {
    const contributions = [card("a", "alex", WEEK_START + 1000)];
    expect(computeChallengeCompletionTimestamp(smallCardChallenge, contributions, [])).toBeNull();
  });

  it("ignores out-of-roster or out-of-window contributions when finding the completion moment", () => {
    const contributions = [
      card("a", "alex", WEEK_START + 1000),
      card("b", "jordan", WEEK_START + 1500), // not on roster
      card("c", "sam", WEEK_START - 1000), // before window
      card("d", "sam", WEEK_START + 4000),
    ];
    expect(computeChallengeCompletionTimestamp(smallCardChallenge, contributions, [])).toBe(WEEK_START + 4000);
  });
});

describe("computeChallengeCompletionTimestamp — win_target", () => {
  it("returns the timestamp of the targetCount-th matching win event", () => {
    const winEvents: ChallengeWinEvent[] = [
      { contributorId: "alex", occurredAt: WEEK_START + 1000 },
      { contributorId: "sam", occurredAt: WEEK_START + 3000 },
      { contributorId: "alex", occurredAt: WEEK_START + 2000 },
    ];
    expect(computeChallengeCompletionTimestamp(winChallenge, [], winEvents)).toBe(WEEK_START + 3000);
  });

  it("returns null when fewer win events than the target have landed", () => {
    const winEvents: ChallengeWinEvent[] = [{ contributorId: "alex", occurredAt: WEEK_START + 1000 }];
    expect(computeChallengeCompletionTimestamp(winChallenge, [], winEvents)).toBeNull();
  });
});

describe("buildChallengeCompletionAnnouncementText", () => {
  it("includes the MVP contributor when one is set", () => {
    const progress = computeGroupChallengeProgress(
      { ...cardChallenge, goal: { ...cardChallenge.goal, targetCount: 1 } as GroupChallenge["goal"] },
      [card("a", "alex", WEEK_START + 1000)],
      [],
      WEEK_START + 2000,
    );
    expect(buildChallengeCompletionAnnouncementText(progress)).toBe(
      '"Find 10 solvency cards" complete! (1/1) — top contributor: alex',
    );
  });

  it("omits the MVP suffix when none is set", () => {
    expect(
      buildChallengeCompletionAnnouncementText({ title: "Solo goal", completedCount: 1, targetCount: 1 }),
    ).toBe('"Solo goal" complete! (1/1)');
  });
});
