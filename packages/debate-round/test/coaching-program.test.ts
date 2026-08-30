import { describe, expect, it } from "vitest";
import type { Box } from "../src/types/flow";
import type { QuestContribution, QuestTemplate } from "debate-card-search/src/lib/daily-quests";
import type { ContributorAvailability } from "debate-card-search/src/lib/research-task-routing";
import type { TrackedTopicAssignment } from "debate-card-search/src/lib/research-progress";
import {
  buildTopicCoverageReport,
  type CoverageCardSummary,
  type TrackedArgument,
} from "debate-card-search/src/lib/topic-coverage";
import type { ChallengeWinEvent, GroupChallenge } from "debate-card-search/src/lib/group-challenges";
import {
  buildCoachingProgramBoard,
  buildCoachingProgramSummaryText,
  buildMemberDrillSummaryText,
  buildMemberPracticeRoundSummaryText,
  type CoachingProgramConfig,
  type CoachingProgramMemberFlow,
  type CoachingProgramMemberPracticeRound,
} from "../src/round/coaching-program";
import { buildPracticeRoundSetup } from "../src/round/practice-round-simulator";

const NOW = Date.parse("2026-08-10T00:00:00Z");
const WEEK_END = Date.parse("2026-08-17T00:00:00Z");

const COLUMNS = ["1AC", "1NC", "2AC", "2NC"];

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    const current: Box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
    box = current;
  }
  return { ...(box as Box), ...overrides };
}

const ALEX_FLOW = {
  columns: COLUMNS,
  children: [rowFromContents(["Case advantage", "Turn", "", ""])],
};

const program: CoachingProgramConfig = {
  id: "varsity-squad",
  name: "Varsity Squad",
  memberIds: ["alex", "sam"],
};

const trackedArguments: TrackedArgument[] = [{ argBlock: "Warming DA", category: "DA" }];
const warmingCards: CoverageCardSummary[] = [
  { id: "warming-1", argBlock: "Warming DA", wordCount: 250 },
];
const coverageReport = buildTopicCoverageReport(trackedArguments, warmingCards);

const quests: QuestTemplate[] = [
  { id: "find-cards", description: "Find 1 solvency card", target: { kind: "card" }, targetCount: 1 },
];

const contributions: QuestContribution[] = [
  {
    id: "c1",
    contributorId: "alex",
    kind: "card",
    argBlock: "Solvency",
    likes: 1,
    saves: 0,
    qualitySignals: [0.8],
    reviewerEndorsements: [],
    submittedAt: NOW,
  },
];

const contributors: ContributorAvailability[] = [
  { contributorId: "alex", skillLevel: "advanced", activeTaskCount: 0, maxConcurrentTasks: 5 },
];

const assignments: TrackedTopicAssignment[] = [];

const challenges: GroupChallenge[] = [
  {
    id: "find-solvency-cards",
    title: "Find 5 solvency cards",
    goal: { kind: "contribution_target", target: { kind: "card", argBlock: "Solvency" }, targetCount: 5 },
    memberIds: ["alex", "sam"],
    startsAt: NOW,
    endsAt: WEEK_END,
  },
];

const winEvents: ChallengeWinEvent[] = [];

const memberFlows: CoachingProgramMemberFlow[] = [
  { contributorId: "alex", flow: ALEX_FLOW, sideKey: "1AC" },
  { contributorId: "jordan", flow: ALEX_FLOW, sideKey: "1AC" }, // not on the roster
];

const PRACTICE_ROUND_SETUP = buildPracticeRoundSetup({ styleKey: "lincolnDouglas", judgeParadigm: "lay" });

const memberPracticeRounds: CoachingProgramMemberPracticeRound[] = [
  { contributorId: "alex", setup: PRACTICE_ROUND_SETUP },
  { contributorId: "jordan", setup: PRACTICE_ROUND_SETUP }, // not on the roster
];

describe("buildCoachingProgramBoard", () => {
  it("composes the topic sprint, group-challenge board, and roster member drill sets", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests,
        contributions,
        now: NOW,
        coverageReport,
        contributors,
        assignments,
        notes: [],
      },
      challenges,
      contributions,
      winEvents,
      memberFlows,
    });

    expect(board.program).toBe(program);
    expect(board.topicSprint.topic).toBe("Immigration");
    expect(board.topicSprint.questBoard[0].completedCount).toBe(1);
    expect(board.challengeBoard).toHaveLength(1);
    expect(board.challengeBoard[0].challengeId).toBe("find-solvency-cards");
    expect(Object.keys(board.memberDrills)).toEqual(["alex"]);
    expect(board.memberDrills.alex.length).toBeGreaterThan(0);
  });

  it("composes member practice rounds, scoped to the program roster", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
      memberPracticeRounds,
    });

    expect(Object.keys(board.memberPracticeRounds)).toEqual(["alex"]);
    expect(board.memberPracticeRounds.alex).toEqual({ contributorId: "alex", setup: PRACTICE_ROUND_SETUP });
  });

  it("defaults memberPracticeRounds to an empty map when none are supplied", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
    });

    expect(board.memberPracticeRounds).toEqual({});
  });

  it("ignores a member flow for a contributor outside the program roster", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [{ contributorId: "jordan", flow: ALEX_FLOW, sideKey: "1AC" }],
    });

    expect(board.memberDrills).toEqual({});
  });

  it("produces an empty memberDrills map when no member has a flowed round", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
    });

    expect(board.memberDrills).toEqual({});
  });

  it("passes drillOptions through to buildDrillSet", () => {
    const wideFlow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Case advantage", "Turn", "", ""]),
        rowFromContents(["", "Disad link A", "", ""]),
        rowFromContents(["", "Disad link B", "", ""]),
        rowFromContents(["", "Disad link C", "", ""]),
      ],
    };

    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [{ contributorId: "alex", flow: wideFlow, sideKey: "1AC" }],
      drillOptions: { collapseLimit: 1 },
    });

    const collapseDrills = board.memberDrills.alex.filter((drill) => drill.kind === "collapse");
    expect(collapseDrills).toHaveLength(1);
  });
});

describe("buildCoachingProgramSummaryText", () => {
  it("renders program, topic-sprint, challenge, and drill-count lines", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests,
        contributions,
        now: NOW,
        coverageReport,
        contributors,
        assignments,
        notes: [],
      },
      challenges,
      contributions,
      winEvents,
      memberFlows,
    });

    const text = buildCoachingProgramSummaryText(board);
    const lines = text.split("\n");
    expect(lines[0]).toBe("Varsity Squad coaching space (2 members)");
    expect(lines).toContain("Immigration sprint");
    expect(text).toContain('"Find 5 solvency cards"');
    expect(lines).toContain("1 member drill set generated");
    expect(lines).toContain("No member practice rounds recorded yet");
  });

  it("pluralizes the practice-round count when more than one member has a session", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
      memberPracticeRounds: [
        { contributorId: "alex", setup: PRACTICE_ROUND_SETUP },
        { contributorId: "sam", setup: PRACTICE_ROUND_SETUP },
      ],
    });

    expect(buildCoachingProgramSummaryText(board)).toContain("2 member practice rounds recorded");
  });

  it("pluralizes the drill-set count when more than one member has a flow", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [
        { contributorId: "alex", flow: ALEX_FLOW, sideKey: "1AC" },
        { contributorId: "sam", flow: ALEX_FLOW, sideKey: "1AC" },
      ],
    });

    expect(buildCoachingProgramSummaryText(board)).toContain("2 member drill sets generated");
  });

  it("renders a no-drills line when nobody has a flow yet", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
    });

    expect(buildCoachingProgramSummaryText(board)).toContain("No member drill sets yet");
  });

  it("pluralizes a single-member program correctly", () => {
    const soloProgram: CoachingProgramConfig = { id: "jv", name: "JV Squad", memberIds: ["alex"] };
    const board = buildCoachingProgramBoard({
      program: soloProgram,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
    });

    expect(buildCoachingProgramSummaryText(board)).toContain("JV Squad coaching space (1 member)");
  });
});

describe("buildMemberDrillSummaryText", () => {
  it("renders a member's drill set", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows,
    });

    expect(buildMemberDrillSummaryText(board, "alex")).toContain("[Overview]");
  });

  it("renders a placeholder for a member with no flowed round", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
    });

    expect(buildMemberDrillSummaryText(board, "sam")).toBe(
      "No practice round flowed yet — no drills available.",
    );
  });
});

describe("buildMemberPracticeRoundSummaryText", () => {
  it("renders a member's practice-round setup", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
      memberPracticeRounds,
    });

    const text = buildMemberPracticeRoundSummaryText(board, "alex");
    expect(text).toContain("### Speech order");
    expect(text).toContain("### Judge paradigm");
  });

  it("includes feedback sections once feedback has been generated", () => {
    const feedback = { judgeParadigm: PRACTICE_ROUND_SETUP.judgeParadigm, coachingPrompts: [], sections: [{ title: "Overall feedback", body: "Great extensions." }] };
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
      memberPracticeRounds: [{ contributorId: "alex", setup: PRACTICE_ROUND_SETUP, feedback }],
    });

    expect(buildMemberPracticeRoundSummaryText(board, "alex")).toContain("Great extensions.");
  });

  it("renders a placeholder for a member with no recorded practice round", () => {
    const board = buildCoachingProgramBoard({
      program,
      topicSprint: {
        topic: "Immigration",
        quests: [],
        contributions: [],
        now: NOW,
        coverageReport,
        contributors: [],
        assignments: [],
        notes: [],
      },
      challenges: [],
      contributions: [],
      winEvents: [],
      memberFlows: [],
    });

    expect(buildMemberPracticeRoundSummaryText(board, "sam")).toBe("No practice round session recorded yet.");
  });
});
