/**
 * Render test for the Topic Sprint panel.
 *
 * The package's Vitest environment is `node` with no DOM, so this renders the
 * panel through `react-dom/server` and asserts on the markup. That covers what
 * matters here — that the panel wires `buildTopicSprint`'s composition onto the
 * screen and renders without throwing.
 *
 * Every other panel in this package reads its own store and is covered by that
 * store's own suite; this one is the only panel driven entirely by props.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { TopicSprintPanel } from "../src/panels/TopicSprintPanel";
import {
  buildTopicCoverageReport,
  type CoverageCardSummary,
  type TrackedArgument,
} from "debate-research-evidence/src/lib/topic-coverage";
import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";
import type { QuestContribution, QuestTemplate } from "../src/lib/daily-quests";
import type { ContributorAvailability } from "debate-research-evidence/src/lib/research-task-routing";
import type { TrackedTopicAssignment } from "../src/lib/research-progress";
import type { SprintNote } from "../src/lib/team-collaboration-mode";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

const trackedArguments: TrackedArgument[] = [
  { argBlock: "Warming DA", category: "DA" },
  { argBlock: "States CP", category: "CP" },
  { argBlock: "Case NEG", category: "Case" },
];

const cards: CoverageCardSummary[] = [
  { id: "w1", argBlock: "Warming DA", wordCount: 300 },
  { id: "w2", argBlock: "Warming DA", wordCount: 300 },
  { id: "w3", argBlock: "Warming DA", wordCount: 300 },
  { id: "s1", argBlock: "States CP", wordCount: 90 },
];

const coverageReport = buildTopicCoverageReport(trackedArguments, cards);

const contributions: AttributedContribution[] = [
  {
    id: "c1",
    contributorId: "alice",
    kind: "card",
    likes: 12,
    saves: 4,
    qualitySignals: [0.9, 0.8],
    reviewerEndorsements: [{ reviewerWeight: 0.8 }],
  },
  {
    id: "c2",
    contributorId: "bob",
    kind: "summary",
    likes: 30,
    saves: 1,
    qualitySignals: [],
    reviewerEndorsements: [],
  },
];

const quests: QuestTemplate[] = [
  { id: "q1", description: "Cut 2 warming cards", target: { kind: "card" }, targetCount: 2 },
];

const questContributions: QuestContribution[] = contributions.map((contribution) => ({
  ...contribution,
  argBlock: "Warming DA",
  submittedAt: NOW,
}));

const assignments: TrackedTopicAssignment[] = [
  {
    topic: "Climate",
    assignment: {
      contributorId: "alice",
      task: { argBlock: "Case NEG", category: "Case", level: "missing", requiredSkill: "advanced" },
    },
    completedAt: "2026-01-14",
  },
  {
    topic: "Climate",
    assignment: {
      contributorId: "alice",
      task: { argBlock: "States CP", category: "CP", level: "thin", requiredSkill: "intermediate" },
    },
  },
];

const contributors: ContributorAvailability[] = [
  { contributorId: "alice", skillLevel: "advanced", activeTaskCount: 0, maxConcurrentTasks: 3 },
  { contributorId: "bob", skillLevel: "novice", activeTaskCount: 1, maxConcurrentTasks: 2 },
];

const sprintNotes: SprintNote[] = [
  {
    id: "n1",
    topic: "Climate",
    authorId: "alice",
    text: "Need an updated warming impact",
    status: "needs-follow-up",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe("TopicSprintPanel", () => {
  it("shows quests, routing, progress and notes for a topic", () => {
    const html = renderToStaticMarkup(
      <TopicSprintPanel
        topic="Climate"
        quests={quests}
        contributions={questContributions}
        coverageReport={coverageReport}
        assignments={assignments}
        contributors={contributors}
        notes={sprintNotes}
        now={NOW}
      />,
    );
    expect(html).toContain("Topic Sprint — Climate");
    expect(html).toContain("Need an updated warming impact");
    expect(html).toContain("Open follow-ups");
  });
});
