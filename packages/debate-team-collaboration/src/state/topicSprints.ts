/**
 * @fileoverview Composes a topic's full `TopicSprint` (quest board, task
 * routing, progress board, and notes) entirely from real, persisted state —
 * closing follow-up (b), "persisting a topic sprint's other inputs (so the
 * full `buildTopicSprint` composition can be rendered, not just the note
 * thread)," named under the "🤝 Team Collaboration Mode" bullet in TODO.md.
 *
 * `lib/team-collaboration-mode.ts`'s `buildTopicSprint` already composes
 * `daily-quests.ts`/`research-task-routing.ts`/`research-progress.ts`
 * against a caller-supplied `quests`/`contributions`/`coverageReport`/
 * `contributors`/`assignments`/`notes` — each of those now has its own
 * persisted store (`state/dailyQuests.ts`, `state/contributions.ts`,
 * `state/trackedArguments.ts`, `state/contributorAvailability.ts`,
 * `state/researchProgress.ts`/`state/routedTaskQueues.ts`,
 * `state/sprintNotes.ts`), so this module reads all six directly rather
 * than requiring `panels/TopicSprintPanel.tsx`'s caller to assemble them,
 * mirroring `state/prepRooms.ts`'s `buildPersistedPrepRoom` "compose every
 * input from its own store" convention.
 *
 * @module state/topicSprints
 */

import {
  buildTopicSprint,
  type BuildTopicSprintInput,
  type TopicSprint,
} from "../lib/team-collaboration-mode";
import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";
import type { QuestContribution } from "../lib/daily-quests";
import type { CoverageThresholds } from "debate-research-evidence/src/lib/topic-coverage";
import { listQuestTemplates } from "./dailyQuests";
import { listContributions } from "debate-research-evidence/src/state/contributions";
import { buildPersistedTopicCoverageReport } from "debate-research-evidence/src/state/trackedArguments";
import { listContributorAvailability } from "./contributorAvailability";
import { listTrackedAssignmentsForTopic } from "./researchProgress";
import { listSprintNotes } from "./sprintNotes";

/** Every raw input `buildTopicSprint` needs for one topic, read from its own persisted store. */
export type PersistedTopicSprintInputs = Omit<BuildTopicSprintInput, "topic" | "now">;

/** Whether a persisted contribution carries the `submittedAt` timestamp `daily-quests.ts` needs to match it to a calendar day — mirrors `state/dailyQuests.ts`'s identical guard. */
function hasSubmittedAt(
  contribution: AttributedContribution,
): contribution is AttributedContribution & { submittedAt: number } {
  return typeof (contribution as { submittedAt?: unknown }).submittedAt === "number";
}

/**
 * Reads every input a topic sprint needs from its own persisted store:
 * every quest template, every contribution that carries a `submittedAt`
 * timestamp, the topic's live coverage report, every contributor's
 * availability, this topic's tracked assignments (completed and still
 * active), and every persisted sprint note (`buildTopicSprint` itself
 * narrows these down to `topic`). An empty set of stores returns empty
 * lists/an empty coverage report rather than throwing.
 */
export function readPersistedTopicSprintInputs(
  topic: string,
  thresholds?: CoverageThresholds,
): PersistedTopicSprintInputs {
  return {
    quests: listQuestTemplates(),
    contributions: listContributions().filter(hasSubmittedAt) as QuestContribution[],
    coverageReport: buildPersistedTopicCoverageReport(topic, thresholds),
    contributors: listContributorAvailability(),
    assignments: listTrackedAssignmentsForTopic(topic),
    notes: listSprintNotes(),
  };
}

/**
 * Builds one topic's full shared collaboration session entirely from
 * persisted state — a topic id and a "now" timestamp in, a panel-ready
 * `TopicSprint` out, composing `readPersistedTopicSprintInputs` directly
 * with `buildTopicSprint` rather than requiring the caller to read every
 * store themselves.
 */
export function buildPersistedTopicSprint(
  topic: string,
  now: number,
  thresholds?: CoverageThresholds,
): TopicSprint {
  return buildTopicSprint({ topic, now, ...readPersistedTopicSprintInputs(topic, thresholds) });
}
