/**
 * @fileoverview Research progress board — UI over `lib/research-progress.ts`.
 *
 * Per-contributor topic/task completion with the contribution stats the
 * progress slice folds in.
 */

"use client";

import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";

import {
  EmptyState,
  MeterBar,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";

import {
  buildProgressSummaryText,
  buildResearchProgressBoard,
  type ContributorProgress,
  type TrackedTopicAssignment,
} from "../lib/research-progress";
import type { AttributedContribution } from "../lib/contribution-leaderboard";
import { listContributions } from "../state/contributions";

/** Props for {@link ResearchProgressPanel}. */
export interface ResearchProgressPanelProps {
  /** Assignments tracked per contributor. */
  assignments: TrackedTopicAssignment[];
  /** Contributions to fold in. Defaults to the persisted contribution store. */
  contributions?: AttributedContribution[];
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Shows how far each contributor has got through their assigned research.
 *
 * @param props - See {@link ResearchProgressPanelProps}.
 * @returns The research progress panel.
 */
export function ResearchProgressPanel({
  assignments,
  contributions,
  className,
}: ResearchProgressPanelProps) {
  const { data: persisted } = useStoreSnapshot<AttributedContribution[]>(listContributions, []);
  const source = contributions ?? persisted;
  const [openContributorId, setOpenContributorId] = useState<string | null>(null);

  const board = useMemo(
    () => buildResearchProgressBoard(source, assignments),
    [source, assignments],
  );

  const totals = useMemo(
    () =>
      board.reduce(
        (accumulator, progress) => ({
          assigned: accumulator.assigned + progress.totalAssignedTasks,
          completed: accumulator.completed + progress.totalCompletedTasks,
        }),
        { assigned: 0, completed: 0 },
      ),
    [board],
  );

  return (
    <PanelShell
      title="Research Progress"
      description="Assigned versus completed research per contributor."
      icon={<ListChecks className="h-4 w-4" />}
      className={className}
      data-testid="research-progress-panel"
    >
      <StatGrid columns={3}>
        <StatTile label="Contributors" value={board.length} />
        <StatTile label="Tasks assigned" value={totals.assigned} />
        <StatTile
          label="Tasks completed"
          value={totals.completed}
          tone={totals.completed === totals.assigned && totals.assigned > 0 ? "positive" : "info"}
        />
      </StatGrid>

      <PanelSection title="By contributor">
        {board.length === 0 ? (
          <EmptyState
            title="No assignments tracked"
            message="Route tasks to contributors to start tracking progress."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {board.map((progress) => (
              <ProgressRow
                key={progress.contributorId}
                progress={progress}
                open={openContributorId === progress.contributorId}
                onToggle={() =>
                  setOpenContributorId((current) =>
                    current === progress.contributorId ? null : progress.contributorId,
                  )
                }
              />
            ))}
          </div>
        )}
      </PanelSection>
    </PanelShell>
  );
}

function ProgressRow({
  progress,
  open,
  onToggle,
}: {
  progress: ContributorProgress;
  open: boolean;
  onToggle: () => void;
}) {
  const percent = Math.round(progress.overallCompletionRate * 100);
  return (
    <PanelRow
      title={
        <button type="button" className="text-left" aria-expanded={open} onClick={onToggle}>
          {open ? "▾" : "▸"} {progress.contributorId}
        </button>
      }
      subtitle={
        progress.contributionStats
          ? `${progress.contributionStats.contributionCount} contributions · ${progress.contributionStats.totalHelpfulnessScore.toFixed(2)} helpfulness`
          : "No contributions recorded"
      }
      trailing={
        <Pill tone={percent === 100 ? "positive" : percent > 0 ? "info" : "warning"}>
          {percent}%
        </Pill>
      }
    >
      <MeterBar
        value={progress.totalCompletedTasks}
        max={progress.totalAssignedTasks}
        tone={percent === 100 ? "positive" : "info"}
        caption={`${progress.totalCompletedTasks} / ${progress.totalAssignedTasks} tasks`}
      />
      {open ? (
        <>
          <ul className="flex flex-col gap-1">
            {progress.topics.map((topic) => (
              <li key={topic.topic} className="flex flex-col gap-1">
                <MeterBar
                  value={topic.completedTaskCount}
                  max={topic.assignedTaskCount}
                  tone={topic.completionRate === 1 ? "positive" : "info"}
                  label={topic.topic}
                  caption={`${topic.completedTaskCount} / ${topic.assignedTaskCount}`}
                />
              </li>
            ))}
          </ul>
          <SummaryText text={buildProgressSummaryText(progress)} />
        </>
      ) : null}
    </PanelRow>
  );
}
