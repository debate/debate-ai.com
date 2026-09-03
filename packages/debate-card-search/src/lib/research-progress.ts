/**
 * @fileoverview Pure per-contributor progress aggregation for the "Research
 * Progress Tracking" idea under Research Crowdsourcing Organizer Features in
 * TODO.md ("Show each debater's progress across topics, task completion, and
 * contribution history"). Builds directly on the existing "Contribution
 * Leaderboard" slice in `contribution-leaderboard.ts` for contribution
 * history and the existing "Research Task Routing" slice in
 * `research-task-routing.ts` for task assignments — reuses `ContributorStats`
 * and `RoutedAssignment` directly rather than introducing a separate
 * scoring or assignment path, and adds per-topic completion tracking on top.
 * This is the first slice only — it works entirely off a caller-supplied
 * contribution list and a caller-supplied, topic-tagged assignment list with
 * a caller-supplied completion timestamp; it doesn't persist a contributor's
 * progress, track task completion itself (no task system exists in this
 * repo today), or render a progress-tracking UI. See the follow-ups noted in
 * TODO.md.
 *
 * @module lib/research-progress
 */

import {
  DEFAULT_HELPFULNESS_WEIGHTS,
  type HelpfulnessWeights,
} from "./community-rating";
import {
  buildContributorStats,
  groupContributionsByContributor,
  type AttributedContribution,
  type ContributorStats,
} from "./contribution-leaderboard";
import type { RoutedAssignment } from "./research-task-routing";

/**
 * A research task assignment tagged with the topic it belongs to and,
 * once done, when the contributor completed it. `completedAt` is left
 * `undefined` for a task still in progress.
 */
export interface TrackedTopicAssignment {
  topic: string;
  assignment: RoutedAssignment;
  completedAt?: string;
}

/** One contributor's progress within a single topic. */
export interface TopicProgress {
  topic: string;
  assignedTaskCount: number;
  completedTaskCount: number;
  /** `completedTaskCount / assignedTaskCount`, rounded to 2 decimals; 0 when nothing is assigned. */
  completionRate: number;
}

/** One contributor's full progress: contribution history plus per-topic task completion. */
export interface ContributorProgress {
  contributorId: string;
  /** Contribution-leaderboard stats, or `null` if this contributor has no scored contributions. */
  contributionStats: ContributorStats | null;
  /** Per-topic progress, sorted by topic name. */
  topics: TopicProgress[];
  totalAssignedTasks: number;
  totalCompletedTasks: number;
  /** `totalCompletedTasks / totalAssignedTasks`, rounded to 2 decimals; 0 when nothing is assigned. */
  overallCompletionRate: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function completionRate(completed: number, assigned: number): number {
  return assigned === 0 ? 0 : round2(completed / assigned);
}

/** Groups topic-tagged assignments by the contributor they were routed to, preserving relative order. */
export function groupAssignmentsByContributor(
  assignments: TrackedTopicAssignment[],
): Map<string, TrackedTopicAssignment[]> {
  const byContributor = new Map<string, TrackedTopicAssignment[]>();
  for (const tracked of assignments) {
    const contributorId = tracked.assignment.contributorId;
    const group = byContributor.get(contributorId);
    if (group) {
      group.push(tracked);
    } else {
      byContributor.set(contributorId, [tracked]);
    }
  }
  return byContributor;
}

/**
 * Builds one topic's progress from a contributor's assignments already
 * filtered to that topic: how many tasks were assigned there and how many
 * carry a `completedAt`.
 */
export function buildTopicProgress(topic: string, assignments: TrackedTopicAssignment[]): TopicProgress {
  const completedTaskCount = assignments.filter((tracked) => tracked.completedAt !== undefined).length;
  return {
    topic,
    assignedTaskCount: assignments.length,
    completedTaskCount,
    completionRate: completionRate(completedTaskCount, assignments.length),
  };
}

/**
 * Builds one contributor's full progress from their own contributions and
 * their own topic-tagged assignments (both already filtered to that
 * contributor). A contributor with no scored contributions gets a `null`
 * `contributionStats` rather than a thrown error, since task-only progress
 * is still meaningful to show.
 */
export function buildContributorProgress(
  contributorId: string,
  contributions: AttributedContribution[],
  assignments: TrackedTopicAssignment[],
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): ContributorProgress {
  const contributionStats = contributions.length > 0 ? buildContributorStats(contributorId, contributions, weights) : null;

  const byTopic = new Map<string, TrackedTopicAssignment[]>();
  for (const tracked of assignments) {
    const group = byTopic.get(tracked.topic);
    if (group) {
      group.push(tracked);
    } else {
      byTopic.set(tracked.topic, [tracked]);
    }
  }
  const topics = Array.from(byTopic.entries())
    .map(([topic, group]) => buildTopicProgress(topic, group))
    .sort((a, b) => a.topic.localeCompare(b.topic));

  const totalAssignedTasks = assignments.length;
  const totalCompletedTasks = assignments.filter((tracked) => tracked.completedAt !== undefined).length;

  return {
    contributorId,
    contributionStats,
    topics,
    totalAssignedTasks,
    totalCompletedTasks,
    overallCompletionRate: completionRate(totalCompletedTasks, totalAssignedTasks),
  };
}

/**
 * Builds the full progress board: every contributor who has either a scored
 * contribution or a routed assignment gets a `ContributorProgress` entry,
 * sorted by `contributorId` for a stable, roster-like order (this is a
 * per-debater status view, not a competitive ranking like
 * `buildLeaderboard`).
 */
export function buildResearchProgressBoard(
  contributions: AttributedContribution[],
  assignments: TrackedTopicAssignment[],
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): ContributorProgress[] {
  const contributionsByContributor = groupContributionsByContributor(contributions);
  const assignmentsByContributor = groupAssignmentsByContributor(assignments);

  const contributorIds = new Set<string>([
    ...contributionsByContributor.keys(),
    ...assignmentsByContributor.keys(),
  ]);

  return Array.from(contributorIds)
    .sort((a, b) => a.localeCompare(b))
    .map((contributorId) =>
      buildContributorProgress(
        contributorId,
        contributionsByContributor.get(contributorId) ?? [],
        assignmentsByContributor.get(contributorId) ?? [],
        weights,
      ),
    );
}

/** Renders a short human-readable progress summary line for a debater's profile or roster view. */
export function buildProgressSummaryText(progress: ContributorProgress): string {
  const contributionPart =
    progress.contributionStats === null
      ? "no scored contributions"
      : `${progress.contributionStats.contributionCount} contribution${progress.contributionStats.contributionCount === 1 ? "" : "s"} (${progress.contributionStats.totalHelpfulnessScore} total helpfulness)`;

  const taskPart =
    progress.totalAssignedTasks === 0
      ? "no assigned tasks"
      : `${progress.totalCompletedTasks}/${progress.totalAssignedTasks} tasks complete (${Math.round(progress.overallCompletionRate * 100)}%)`;

  return `${progress.contributorId}: ${contributionPart}; ${taskPart}`;
}

/**
 * Renders the full progress board as a single plain-text report, one section
 * per contributor: `buildProgressSummaryText`'s summary line followed by an
 * indented per-topic completion breakdown — the "printable/exportable
 * progress report" follow-up named under the "📈 Research Progress Tracking"
 * bullet in TODO.md. Mirrors every other completed report/export follow-up
 * in this repo (e.g. `pre-round-briefing.ts#buildPreRoundBriefingText`): a
 * pure function handed the already-built board, with no I/O of its own.
 */
export function buildResearchProgressReportText(roster: ContributorProgress[]): string {
  if (roster.length === 0) {
    return "Research Progress Report\n\nNo contributors have any recorded progress yet.";
  }

  const body = roster
    .map((progress) => {
      const topicLines =
        progress.topics.length > 0
          ? progress.topics
              .map(
                (topic) =>
                  `  - ${topic.topic}: ${topic.completedTaskCount}/${topic.assignedTaskCount} (${Math.round(topic.completionRate * 100)}%)`,
              )
              .join("\n")
          : "  - No topic assignments";
      return `${buildProgressSummaryText(progress)}\n${topicLines}`;
    })
    .join("\n\n");

  return `Research Progress Report\n\n${body}`;
}

/** A fixed filename for a research-progress report download — the report covers the whole roster, not a single round or topic, so there's no id to key it on. */
export function researchProgressReportFilename(): string {
  return "research-progress-report.txt";
}

/** One topic's task-completion progress aggregated across every contributor who has a tracked assignment in it. */
export interface TeamTopicComparison {
  topic: string;
  /** How many distinct contributors have at least one assignment in this topic. */
  contributorCount: number;
  assignedTaskCount: number;
  completedTaskCount: number;
  /** `completedTaskCount / assignedTaskCount`, rounded to 2 decimals; 0 when nothing is assigned. */
  completionRate: number;
}

/**
 * Builds the "topic comparison across the whole team" follow-up named under
 * the "📈 Research Progress Tracking" bullet in TODO.md: rolls each
 * contributor's own per-topic `TopicProgress` (already on `ContributorProgress.topics`)
 * up into one row per topic across the entire roster, so a coach or team lead
 * can see which topics the team as a whole is behind on rather than reading
 * one contributor's row at a time. Sorted by completion rate ascending (the
 * least-covered topic first), tie-broken alphabetically — the same
 * least-covered/most-urgent-first convention `buildStaleEvidenceDigest` uses.
 */
export function buildTeamTopicComparison(roster: ContributorProgress[]): TeamTopicComparison[] {
  const byTopic = new Map<string, { contributorIds: Set<string>; assignedTaskCount: number; completedTaskCount: number }>();

  for (const progress of roster) {
    for (const topic of progress.topics) {
      const entry = byTopic.get(topic.topic) ?? {
        contributorIds: new Set<string>(),
        assignedTaskCount: 0,
        completedTaskCount: 0,
      };
      entry.contributorIds.add(progress.contributorId);
      entry.assignedTaskCount += topic.assignedTaskCount;
      entry.completedTaskCount += topic.completedTaskCount;
      byTopic.set(topic.topic, entry);
    }
  }

  return Array.from(byTopic.entries())
    .map(([topic, entry]) => ({
      topic,
      contributorCount: entry.contributorIds.size,
      assignedTaskCount: entry.assignedTaskCount,
      completedTaskCount: entry.completedTaskCount,
      completionRate: completionRate(entry.completedTaskCount, entry.assignedTaskCount),
    }))
    .sort((a, b) => a.completionRate - b.completionRate || a.topic.localeCompare(b.topic));
}
