/**
 * @fileoverview Pure task-routing logic for the "Research Task Routing" idea
 * under Research Crowdsourcing Organizer Features in TODO.md ("Assign
 * specific research jobs to debaters based on topic gaps, skill level, and
 * current needs"). Builds directly on the existing "Topic Coverage
 * Dashboard" slice in `topic-coverage.ts` — turns its under-covered
 * arguments into a queue of research tasks, gates each task by a required
 * skill level, and routes the queue to caller-supplied contributors,
 * spreading load across whoever has the fewest active tasks rather than
 * piling everything onto one person. This is the first slice only — it
 * works entirely off a caller-supplied `TopicCoverageReport` and a
 * caller-supplied contributor-availability list; it doesn't track
 * contributors' active task counts or skill levels itself (neither exists
 * in this repo today), and it isn't wired into any task-assignment UI yet.
 *
 * @module lib/research-task-routing
 */

import { getUnderCoveredArguments, type CoverageLevel, type TopicCoverageReport } from "./topic-coverage";

/** Skill levels a contributor can be tagged with, ordered from least to most experienced. */
export type SkillLevel = "novice" | "intermediate" | "advanced";

const SKILL_RANK: Record<SkillLevel, number> = { novice: 0, intermediate: 1, advanced: 2 };

/** A contributor available to take on a routed research task. */
export interface ContributorAvailability {
  contributorId: string;
  skillLevel: SkillLevel;
  /** Number of research tasks this contributor currently has assigned. */
  activeTaskCount: number;
  /** Max tasks this contributor can hold concurrently before they stop receiving new ones. */
  maxConcurrentTasks: number;
}

/** One routable research task derived from a topic-coverage gap. */
export interface ResearchTask {
  argBlock: string;
  category?: string;
  /** How urgent the gap is: `missing` before `thin`, per `getUnderCoveredArguments`. */
  level: CoverageLevel;
  /** Minimum skill level a contributor needs to take this task. */
  requiredSkill: SkillLevel;
}

/**
 * A `missing` argument needs a contributor to build coverage from scratch,
 * so it requires at least `intermediate` skill; topping off a `thin`
 * argument with more depth is the more approachable job, open to anyone.
 */
function requiredSkillFor(level: CoverageLevel): SkillLevel {
  return level === "missing" ? "intermediate" : "novice";
}

/**
 * Builds the routable task queue from a topic-coverage report: every
 * under-covered tracked argument, most urgent first (via
 * `getUnderCoveredArguments`), tagged with the skill level it requires.
 */
export function buildTaskQueue(report: TopicCoverageReport): ResearchTask[] {
  return getUnderCoveredArguments(report).map((coverage) => ({
    argBlock: coverage.argBlock,
    category: coverage.category,
    level: coverage.level,
    requiredSkill: requiredSkillFor(coverage.level),
  }));
}

/** Priority levels a coach can flag an already-routed assignment with, independent of its task's `level`. */
export type TaskPriority = "normal" | "high";

/** One task assigned to a contributor. */
export interface RoutedAssignment {
  task: ResearchTask;
  contributorId: string;
  /** Coach-set urgency flag; omitted entirely when `"normal"`, mirroring `PrepNote`'s `priority` convention. */
  priority?: TaskPriority;
}

/**
 * Returns a copy of `assignment` with its priority changed. Setting
 * `"normal"` omits the `priority` key entirely rather than storing it
 * explicitly, so a never-flagged assignment and an unflagged one serialize
 * identically.
 */
export function setAssignmentPriority(assignment: RoutedAssignment, priority: TaskPriority): RoutedAssignment {
  if (priority === "normal") {
    const { priority: _omit, ...rest } = assignment;
    return rest;
  }
  return { ...assignment, priority };
}

/**
 * Stable-sorts assignments so high-priority ones come first, preserving
 * relative order within each priority tier (in particular, the most-urgent
 * `routeTasks` ordering survives among assignments that share a priority).
 */
export function sortAssignmentsByPriority(assignments: RoutedAssignment[]): RoutedAssignment[] {
  return assignments
    .map((assignment, index) => ({ assignment, index }))
    .sort((a, b) => {
      const aRank = a.assignment.priority === "high" ? 0 : 1;
      const bRank = b.assignment.priority === "high" ? 0 : 1;
      return aRank !== bRank ? aRank - bRank : a.index - b.index;
    })
    .map(({ assignment }) => assignment);
}

/** Full routing result: assignments made, and any tasks nobody was eligible/available for. */
export interface RoutingResult {
  assignments: RoutedAssignment[];
  /** Tasks left unassigned because no contributor met the required skill level or had spare capacity. */
  unassignedTasks: ResearchTask[];
}

/**
 * Routes tasks to contributors, most urgent task first, to whichever
 * eligible contributor currently has the fewest active tasks (spreading
 * load across the team rather than piling onto one person), tie-broken by
 * `contributorId` for a stable, deterministic result. A contributor is
 * eligible for a task when their `skillLevel` meets the task's
 * `requiredSkill` and they have spare capacity under `maxConcurrentTasks`;
 * a contributor's load updates as tasks are assigned within this same
 * call, so later tasks in the queue see earlier assignments. A task with
 * no eligible contributor is reported in `unassignedTasks` rather than
 * dropped.
 */
export function routeTasks(tasks: ResearchTask[], contributors: ContributorAvailability[]): RoutingResult {
  const load = new Map(contributors.map((contributor) => [contributor.contributorId, contributor.activeTaskCount]));
  const assignments: RoutedAssignment[] = [];
  const unassignedTasks: ResearchTask[] = [];

  for (const task of tasks) {
    const eligible = contributors.filter(
      (contributor) =>
        SKILL_RANK[contributor.skillLevel] >= SKILL_RANK[task.requiredSkill] &&
        (load.get(contributor.contributorId) ?? 0) < contributor.maxConcurrentTasks,
    );

    if (eligible.length === 0) {
      unassignedTasks.push(task);
      continue;
    }

    const chosen = eligible.reduce((leastLoaded, contributor) => {
      const contributorLoad = load.get(contributor.contributorId) ?? 0;
      const leastLoadedLoad = load.get(leastLoaded.contributorId) ?? 0;
      return contributorLoad < leastLoadedLoad ||
        (contributorLoad === leastLoadedLoad && contributor.contributorId.localeCompare(leastLoaded.contributorId) < 0)
        ? contributor
        : leastLoaded;
    });

    assignments.push({ task, contributorId: chosen.contributorId });
    load.set(chosen.contributorId, (load.get(chosen.contributorId) ?? 0) + 1);
  }

  return { assignments, unassignedTasks };
}

/** Convenience wrapper: builds the task queue from a coverage report, then routes it. */
export function buildRoutingResult(report: TopicCoverageReport, contributors: ContributorAvailability[]): RoutingResult {
  return routeTasks(buildTaskQueue(report), contributors);
}

/** Renders a routing result as short human-readable lines for a task-assignment view. */
export function buildRoutingSummaryText(result: RoutingResult): string {
  const lines = result.assignments.map(
    (assignment) => `${assignment.contributorId}: ${assignment.task.argBlock} (${assignment.task.level})`,
  );

  if (result.unassignedTasks.length > 0) {
    const count = result.unassignedTasks.length;
    lines.push(`${count} task${count === 1 ? "" : "s"} unassigned — no eligible contributor available`);
  }

  return lines.join("\n");
}
