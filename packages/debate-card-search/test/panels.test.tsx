/**
 * Render tests for the research/crowdsourcing panels.
 *
 * The package's Vitest environment is `node` with no DOM, so these render the
 * panels through `react-dom/server` and assert on the markup. That covers what
 * matters here — that each panel wires its slice's output onto the screen and
 * renders without throwing — while leaving the store-backed panels in their
 * pre-hydration (empty) state, since effects do not run during a static render.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ArgumentLibraryPanel } from "../src/panels/ArgumentLibraryPanel";
import { BrainstormBoardPanel } from "../src/panels/BrainstormBoardPanel";
import { CardScoringPanel } from "../src/panels/CardScoringPanel";
import { CommunityRatingPanel } from "../src/panels/CommunityRatingPanel";
import { ContributionLeaderboardPanel } from "../src/panels/ContributionLeaderboardPanel";
import { DailyBestCardPanel } from "../src/panels/DailyBestCardPanel";
import { DailyQuestBoardPanel } from "../src/panels/DailyQuestBoardPanel";
import { EvidenceLibraryPanel } from "../src/panels/EvidenceLibraryPanel";
import { GroupChallengePanel } from "../src/panels/GroupChallengePanel";
import { PeerReviewPanel } from "../src/panels/PeerReviewPanel";
import { PrepRoomPanel } from "../src/panels/PrepRoomPanel";
import { ProgressUnlocksPanel } from "../src/panels/ProgressUnlocksPanel";
import { QuestStreakPanel } from "../src/panels/QuestStreakPanel";
import { ResearchProgressPanel } from "../src/panels/ResearchProgressPanel";
import { RevisionIncentivesPanel } from "../src/panels/RevisionIncentivesPanel";
import { TaskRoutingPanel } from "../src/panels/TaskRoutingPanel";
import { TopContributorAwardsPanel } from "../src/panels/TopContributorAwardsPanel";
import { TopicCoverageDashboard } from "../src/panels/TopicCoverageDashboard";
import { TopicSprintPanel } from "../src/panels/TopicSprintPanel";

import { buildTopicCoverageReport, type CoverageCardSummary, type TrackedArgument } from "../src/lib/topic-coverage";
import type { LibraryCard } from "../src/lib/argument-library";
import type { EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";
import type { QuestContribution, QuestTemplate } from "../src/lib/daily-quests";
import type { TimestampedCardContribution } from "../src/lib/daily-best-card";
import type { CardRevision } from "../src/lib/revision-incentives";
import type { ContributorAvailability } from "../src/lib/research-task-routing";
import type { TrackedTopicAssignment } from "../src/lib/research-progress";
import type { GroupChallenge } from "../src/lib/group-challenges";
import type { CardReview } from "../src/lib/peer-review";
import type { SprintNote } from "../src/lib/team-collaboration-mode";
import type { BrainstormIdea } from "../src/lib/team-brainstorm-assist";
import type { ScoredCard } from "../src/lib/llm-card-scoring";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const DAY_KEY = "2026-01-15";

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

const libraryCards: LibraryCard[] = [
  {
    id: "w1",
    argBlock: "Warming DA",
    wordCount: 300,
    topic: "Climate",
    caseArea: "DA",
    tags: ["impact", "2026"],
  },
  {
    id: "s1",
    argBlock: "States CP",
    wordCount: 90,
    topic: "Federalism",
    caseArea: "CP",
    tags: ["solvency"],
  },
];

const evidenceEntries: EvidenceLibraryEntry[] = [
  {
    ...libraryCards[0],
    kind: "card",
    text: "Warming causes extinction absent immediate reductions.",
    cite: "Smith 26",
  },
  {
    ...libraryCards[1],
    kind: "block",
    text: "States solve uniformly through compacts.",
    cite: "Jones 25",
  },
];

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

const questContributions: QuestContribution[] = contributions.map((contribution) => ({
  ...contribution,
  argBlock: "Warming DA",
  submittedAt: NOW,
}));

const quests: QuestTemplate[] = [
  { id: "q1", description: "Cut 2 warming cards", target: { kind: "card" }, targetCount: 2 },
];

const timestampedCards: TimestampedCardContribution[] = [
  {
    id: "card-of-day",
    kind: "card",
    likes: 20,
    saves: 6,
    qualitySignals: [0.95],
    reviewerEndorsements: [{ reviewerWeight: 1 }],
    submittedAt: NOW,
  },
];

const revisions: CardRevision[] = [
  {
    cardId: "w1",
    contributorId: "alice",
    before: { qualitySignals: [0.3], citationCompleteness: 0.4, evidenceYear: 2015, wordCount: 100 },
    after: { qualitySignals: [0.9], citationCompleteness: 1, evidenceYear: 2026, wordCount: 180 },
  },
];

const contributors: ContributorAvailability[] = [
  { contributorId: "alice", skillLevel: "advanced", activeTaskCount: 0, maxConcurrentTasks: 3 },
  { contributorId: "bob", skillLevel: "novice", activeTaskCount: 1, maxConcurrentTasks: 2 },
];

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

const challenges: GroupChallenge[] = [
  {
    id: "ch1",
    title: "Cards blitz",
    goal: { kind: "contribution_target", target: {}, targetCount: 4 },
    memberIds: ["alice", "bob"],
    startsAt: NOW - 86_400_000,
    endsAt: NOW + 86_400_000 * 3,
  },
];

const reviews: CardReview[] = [
  {
    cardId: "w1",
    status: "in_review",
    comments: [
      { id: "cm1", reviewerId: "bob", body: "Needs a newer cite", severity: "blocking", resolved: false },
    ],
  },
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

const brainstormIdeas: BrainstormIdea[] = [
  {
    id: "i1",
    argBlock: "Case NEG",
    category: "argument",
    contributorId: "alice",
    text: "Read the adaptation turn",
    upvotes: 3,
  },
];

const scoredCards: ScoredCard[] = [
  {
    id: "w1",
    text: "Warming causes extinction absent immediate reductions in emissions worldwide.",
    argBlockKeywords: ["warming", "extinction"],
    qualitySignals: [0.9],
  },
];

describe("TopicCoverageDashboard", () => {
  it("shows the tracked arguments with their coverage level", () => {
    const html = renderToStaticMarkup(
      <TopicCoverageDashboard trackedArguments={trackedArguments} cards={cards} />,
    );
    expect(html).toContain("Topic Coverage");
    expect(html).toContain("Warming DA");
    expect(html).toContain("Covered");
    expect(html).toContain("States CP");
    expect(html).toContain("Thin");
    expect(html).toContain("Case NEG");
    expect(html).toContain("Missing");
  });

  it("renders an empty state with no tracked arguments", () => {
    const html = renderToStaticMarkup(<TopicCoverageDashboard trackedArguments={[]} cards={[]} />);
    expect(html).toContain("No tracked arguments");
  });
});

describe("ArgumentLibraryPanel", () => {
  it("groups cards into topic folders and tag collections", () => {
    const html = renderToStaticMarkup(<ArgumentLibraryPanel cards={libraryCards} />);
    expect(html).toContain("Argument Library");
    expect(html).toContain("Climate");
    expect(html).toContain("Federalism");
    expect(html).toContain("impact");
  });
});

describe("EvidenceLibraryPanel", () => {
  it("lists the supplied entries as search results", () => {
    const html = renderToStaticMarkup(<EvidenceLibraryPanel entries={evidenceEntries} />);
    expect(html).toContain("Shared Evidence Library");
    expect(html).toContain("Warming DA");
    expect(html).toContain("Smith 26");
  });

  it("hides the add form when read-only", () => {
    const html = renderToStaticMarkup(
      <EvidenceLibraryPanel entries={evidenceEntries} readOnly />,
    );
    expect(html).not.toContain("Add to library");
  });
});

describe("ContributionLeaderboardPanel", () => {
  it("ranks contributors by helpfulness", () => {
    const html = renderToStaticMarkup(
      <ContributionLeaderboardPanel contributions={contributions} highlightContributorId="alice" />,
    );
    expect(html).toContain("Contribution Leaderboard");
    expect(html).toContain("alice");
    expect(html).toContain("bob");
  });
});

describe("TopContributorAwardsPanel", () => {
  it("names a winner per category", () => {
    const html = renderToStaticMarkup(
      <TopContributorAwardsPanel contributions={contributions} />,
    );
    expect(html).toContain("Top Contributor Awards");
    expect(html).toContain("Best Evidence Finder");
    expect(html).toContain("alice");
  });
});

describe("CommunityRatingPanel", () => {
  it("shows the helpfulness breakdown per contribution", () => {
    const html = renderToStaticMarkup(<CommunityRatingPanel contributions={contributions} />);
    expect(html).toContain("Community Ratings");
    expect(html).toContain("Popularity");
    expect(html).toContain("Quality");
    expect(html).toContain("Reviewer");
  });
});

describe("DailyQuestBoardPanel", () => {
  it("shows quest progress for the day", () => {
    const html = renderToStaticMarkup(
      <DailyQuestBoardPanel quests={quests} contributions={questContributions} now={NOW} />,
    );
    expect(html).toContain("Daily Quests");
    expect(html).toContain("Cut 2 warming cards");
  });
});

describe("QuestStreakPanel", () => {
  it("reports the current streak as of today", () => {
    const html = renderToStaticMarkup(
      <QuestStreakPanel
        contributorId="alice"
        missionResults={[
          { dayKey: "2026-01-14", isComplete: true },
          { dayKey: DAY_KEY, isComplete: true },
        ]}
        now={NOW}
      />,
    );
    expect(html).toContain("Quest Streak");
    expect(html).toContain(DAY_KEY);
    expect(html).toContain("Current streak");
  });
});

describe("ProgressUnlocksPanel", () => {
  it("shows the tier and unlocked skill level", () => {
    const html = renderToStaticMarkup(
      <ProgressUnlocksPanel
        contributorId="alice"
        stats={{
          contributorId: "alice",
          contributionCount: 6,
          totalHelpfulnessScore: 30,
          averageHelpfulnessScore: 5,
          bestContributionId: "c1",
          bestHelpfulnessScore: 6,
          popularityOnlyOutlierCount: 0,
        }}
      />,
    );
    expect(html).toContain("Progress Unlocks");
    expect(html).toContain("apprentice");
  });
});

describe("DailyBestCardPanel", () => {
  it("crowns today's winner", () => {
    const html = renderToStaticMarkup(
      <DailyBestCardPanel contributions={timestampedCards} now={NOW} />,
    );
    expect(html).toContain("Daily Best Card");
    expect(html).toContain("card-of-day");
    expect(html).toContain(DAY_KEY);
  });

  it("says so when nothing was submitted today", () => {
    const html = renderToStaticMarkup(<DailyBestCardPanel contributions={[]} now={NOW} />);
    expect(html).toContain("No cards submitted today");
  });
});

describe("GroupChallengePanel", () => {
  it("shows challenge progress and remaining days", () => {
    const html = renderToStaticMarkup(
      <GroupChallengePanel
        challenges={challenges}
        contributions={questContributions}
        now={NOW}
      />,
    );
    expect(html).toContain("Group Challenges");
    expect(html).toContain("Cards blitz");
  });
});

describe("PeerReviewPanel", () => {
  it("shows a review's status and blocking comment count", () => {
    const html = renderToStaticMarkup(<PeerReviewPanel reviews={reviews} />);
    expect(html).toContain("Peer Review");
    expect(html).toContain("w1");
    expect(html).toContain("in review");
    expect(html).toContain("1 blocking");
  });
});

describe("CardScoringPanel", () => {
  it("ranks cards with their component scores", () => {
    const html = renderToStaticMarkup(<CardScoringPanel cards={scoredCards} />);
    expect(html).toContain("Card Scoring");
    expect(html).toContain("Relevance");
    expect(html).toContain("Usability");
  });
});

describe("TaskRoutingPanel", () => {
  it("routes coverage gaps to contributors with capacity", () => {
    const html = renderToStaticMarkup(
      <TaskRoutingPanel coverageReport={coverageReport} contributors={contributors} />,
    );
    expect(html).toContain("Research Task Routing");
    expect(html).toContain("alice");
    expect(html).toContain("Case NEG");
  });

  it("lists tasks nobody can take", () => {
    const html = renderToStaticMarkup(
      <TaskRoutingPanel coverageReport={coverageReport} contributors={[]} />,
    );
    expect(html).toContain("Unassigned tasks");
  });
});

describe("ResearchProgressPanel", () => {
  it("shows completion per contributor", () => {
    const html = renderToStaticMarkup(
      <ResearchProgressPanel assignments={assignments} contributions={contributions} />,
    );
    expect(html).toContain("Research Progress");
    expect(html).toContain("alice");
    expect(html).toContain("50%");
  });
});

describe("PrepRoomPanel", () => {
  it("scopes evidence, draft blocks and routing to one topic", () => {
    const html = renderToStaticMarkup(
      <PrepRoomPanel
        topic="Federalism"
        entries={evidenceEntries}
        coverageReport={coverageReport}
        contributors={contributors}
      />,
    );
    expect(html).toContain("Prep Room — Federalism");
    expect(html).toContain("States CP");
  });
});

describe("RevisionIncentivesPanel", () => {
  it("ranks contributors by reward points", () => {
    const html = renderToStaticMarkup(<RevisionIncentivesPanel revisions={revisions} />);
    expect(html).toContain("Revision Incentives");
    expect(html).toContain("alice");
    expect(html).toContain("pts");
  });
});

describe("BrainstormBoardPanel", () => {
  it("builds a board per coverage gap with its ideas", () => {
    const html = renderToStaticMarkup(
      <BrainstormBoardPanel coverageReport={coverageReport} ideas={brainstormIdeas} />,
    );
    expect(html).toContain("Team Brainstorm");
    expect(html).toContain("Case NEG");
    expect(html).toContain("Read the adaptation turn");
  });
});

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
