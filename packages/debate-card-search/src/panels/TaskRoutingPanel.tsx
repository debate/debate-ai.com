/**
 * @fileoverview Research task routing — UI over `lib/research-task-routing.ts`
 * and the `lib/tiered-task-routing.ts` composition slice, backed by the
 * persisted availability profiles in `state/contributorAvailability.ts`.
 *
 * Turns the coverage report's gaps into a task queue, routes each task to a
 * contributor with the right skill level and spare capacity, and shows what
 * could not be assigned. When contributor stats and task loads are supplied
 * the panel routes from earned tiers instead of hand-set skill levels.
 */

"use client";

import { useMemo, useState } from "react";
import { Route, Trash2 } from "lucide-react";

import {
  EmptyState,
  LabeledField,
  MeterBar,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
  type PanelTone,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import { Input } from "debate-ui/src/primitives/input";

import {
  buildRoutingResult,
  buildRoutingSummaryText,
  type ContributorAvailability,
  type ResearchTask,
  type SkillLevel,
} from "../lib/research-task-routing";
import {
  buildRoutingResultFromContributorStats,
  deriveContributorAvailabilityList,
  type ContributorTaskLoad,
} from "../lib/tiered-task-routing";
import type { ContributorStats } from "../lib/contribution-leaderboard";
import type { CoverageLevel, TopicCoverageReport } from "../lib/topic-coverage";
import {
  deleteContributorAvailability,
  listContributorAvailability,
  saveContributorAvailability,
} from "../state/contributorAvailability";

const SKILL_LEVELS: SkillLevel[] = ["novice", "intermediate", "advanced"];

const LEVEL_TONE: Record<CoverageLevel, PanelTone> = {
  missing: "critical",
  thin: "warning",
  covered: "positive",
};

/** Props for {@link TaskRoutingPanel}. */
export interface TaskRoutingPanelProps {
  /** Coverage report the task queue is derived from. */
  coverageReport: TopicCoverageReport;
  /** Availability profiles. Defaults to the persisted profiles. */
  contributors?: ContributorAvailability[];
  /**
   * Contributor stats for tier-derived routing. When supplied together with
   * `taskLoads`, skill levels come from earned tiers rather than the stored
   * `skillLevel` field.
   */
  contributorStats?: ContributorStats[];
  /** Current task loads, required for tier-derived routing. */
  taskLoads?: ContributorTaskLoad[];
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Routes coverage gaps to contributors.
 *
 * @param props - See {@link TaskRoutingPanelProps}.
 * @returns The task routing panel.
 */
export function TaskRoutingPanel({
  coverageReport,
  contributors,
  contributorStats,
  taskLoads,
  className,
}: TaskRoutingPanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<ContributorAvailability[]>(
    listContributorAvailability,
    [],
  );
  const editable = contributors === undefined;
  const canDeriveFromTiers = Boolean(contributorStats && taskLoads);
  const [useTiers, setUseTiers] = useState(false);

  const manualContributors = contributors ?? persisted;

  const derivedContributors = useMemo(
    () =>
      contributorStats && taskLoads
        ? deriveContributorAvailabilityList(contributorStats, taskLoads)
        : [],
    [contributorStats, taskLoads],
  );

  const tierRouting = useTiers && canDeriveFromTiers;
  const activeContributors = tierRouting ? derivedContributors : manualContributors;

  const result = useMemo(
    () =>
      tierRouting && contributorStats && taskLoads
        ? buildRoutingResultFromContributorStats(coverageReport, contributorStats, taskLoads)
        : buildRoutingResult(coverageReport, manualContributors),
    [tierRouting, coverageReport, contributorStats, taskLoads, manualContributors],
  );

  const [newId, setNewId] = useState("");
  const [newSkill, setNewSkill] = useState<SkillLevel>("intermediate");
  const [newMax, setNewMax] = useState("3");

  const addContributor = () => {
    const parsedMax = Number.parseInt(newMax, 10);
    if (!newId.trim()) return;
    saveContributorAvailability({
      contributorId: newId.trim(),
      skillLevel: newSkill,
      activeTaskCount: 0,
      maxConcurrentTasks: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 1,
    });
    setNewId("");
    refresh();
  };

  const assignmentsByContributor = useMemo(() => {
    const grouped = new Map<string, ResearchTask[]>();
    for (const assignment of result.assignments) {
      const list = grouped.get(assignment.contributorId) ?? [];
      list.push(assignment.task);
      grouped.set(assignment.contributorId, list);
    }
    return grouped;
  }, [result]);

  return (
    <PanelShell
      title="Research Task Routing"
      description="Coverage gaps routed to contributors by skill and capacity."
      icon={<Route className="h-4 w-4" />}
      className={className}
      data-testid="task-routing-panel"
      actions={
        canDeriveFromTiers ? (
          <Button variant="outline" size="sm" onClick={() => setUseTiers((v) => !v)}>
            {tierRouting ? "Use stored skills" : "Use earned tiers"}
          </Button>
        ) : null
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Assigned" value={result.assignments.length} tone="positive" />
        <StatTile
          label="Unassigned"
          value={result.unassignedTasks.length}
          tone={result.unassignedTasks.length > 0 ? "warning" : "neutral"}
        />
        <StatTile label="Contributors" value={activeContributors.length} />
      </StatGrid>

      <PanelSection title="Assignments">
        {result.assignments.length === 0 ? (
          <EmptyState
            title="Nothing routed"
            message="Add contributors with spare capacity to route the open tasks."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {activeContributors.map((contributor) => {
              const tasks = assignmentsByContributor.get(contributor.contributorId) ?? [];
              if (tasks.length === 0) return null;
              return (
                <PanelRow
                  key={contributor.contributorId}
                  title={contributor.contributorId}
                  subtitle={`${contributor.skillLevel} · ${contributor.activeTaskCount + tasks.length}/${contributor.maxConcurrentTasks} tasks`}
                  trailing={<Pill tone="info">{tasks.length} new</Pill>}
                >
                  <MeterBar
                    value={contributor.activeTaskCount + tasks.length}
                    max={contributor.maxConcurrentTasks}
                    tone={
                      contributor.activeTaskCount + tasks.length >= contributor.maxConcurrentTasks
                        ? "warning"
                        : "info"
                    }
                  />
                  <ul className="flex flex-col gap-1">
                    {tasks.map((task) => (
                      <li
                        key={`${contributor.contributorId}-${task.argBlock}`}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate">{task.argBlock}</span>
                        <span className="flex items-center gap-1">
                          <Pill tone={LEVEL_TONE[task.level]}>{task.level}</Pill>
                          <Pill>{task.requiredSkill}</Pill>
                        </span>
                      </li>
                    ))}
                  </ul>
                </PanelRow>
              );
            })}
          </div>
        )}
      </PanelSection>

      {result.unassignedTasks.length > 0 ? (
        <PanelSection
          title="Unassigned tasks"
          description="No contributor has both the required skill and spare capacity."
        >
          <div className="flex flex-col gap-1">
            {result.unassignedTasks.map((task) => (
              <div
                key={task.argBlock}
                className="border-border flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs"
              >
                <span className="truncate">{task.argBlock}</span>
                <span className="flex items-center gap-1">
                  <Pill tone={LEVEL_TONE[task.level]}>{task.level}</Pill>
                  <Pill>needs {task.requiredSkill}</Pill>
                </span>
              </div>
            ))}
          </div>
        </PanelSection>
      ) : null}

      <PanelSection
        title="Contributors"
        description={
          tierRouting
            ? "Skill levels derived from earned unlock tiers."
            : "Stored availability profiles."
        }
      >
        <div className="flex flex-col gap-1">
          {activeContributors.length === 0 ? (
            <EmptyState title="No contributors" message="Add one below to start routing." />
          ) : (
            activeContributors.map((contributor) => (
              <div
                key={contributor.contributorId}
                className="border-border flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs"
              >
                <span>{contributor.contributorId}</span>
                <span className="flex items-center gap-1">
                  <Pill tone="info">{contributor.skillLevel}</Pill>
                  <span className="text-muted-foreground tabular-nums">
                    {contributor.activeTaskCount}/{contributor.maxConcurrentTasks}
                  </span>
                  {editable && !tierRouting ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${contributor.contributorId}`}
                      onClick={() => {
                        deleteContributorAvailability(contributor.contributorId);
                        refresh();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>

        {editable && !tierRouting ? (
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-4">
            <LabeledField label="Contributor id">
              <Input value={newId} onChange={(e) => setNewId(e.target.value)} />
            </LabeledField>
            <LabeledField label="Skill level">
              <div className="flex flex-wrap gap-1">
                {SKILL_LEVELS.map((level) => (
                  <button key={level} type="button" onClick={() => setNewSkill(level)}>
                    <Pill tone={newSkill === level ? "info" : "neutral"}>{level}</Pill>
                  </button>
                ))}
              </div>
            </LabeledField>
            <LabeledField label="Max concurrent">
              <Input value={newMax} inputMode="numeric" onChange={(e) => setNewMax(e.target.value)} />
            </LabeledField>
            <Button size="sm" onClick={addContributor} disabled={!newId.trim()}>
              Save profile
            </Button>
          </div>
        ) : null}
      </PanelSection>

      <SummaryText label="Plain-text summary" text={buildRoutingSummaryText(result)} />
    </PanelShell>
  );
}
