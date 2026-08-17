/**
 * @fileoverview Daily quest board — UI over `lib/daily-quests.ts`.
 *
 * Renders today's quests with per-quest progress, and can seed the board from
 * the coverage report's under-covered arguments so the day's targets follow
 * the squad's actual research gaps.
 */

"use client";

import { useMemo, useState } from "react";
import { Target } from "lucide-react";

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
import { Button } from "debate-ui/src/primitives/button";

import {
  buildDailyQuestBoard,
  buildQuestBoardSummaryText,
  buildUnderCoveredArgumentQuests,
  type QuestContribution,
  type QuestProgress,
  type QuestTemplate,
} from "../lib/daily-quests";
import {
  DEFAULT_COVERAGE_THRESHOLDS,
  type CoverageThresholds,
  type TopicCoverageReport,
} from "../lib/topic-coverage";

/** Props for {@link DailyQuestBoardPanel}. */
export interface DailyQuestBoardPanelProps {
  /** Quests offered today. */
  quests: QuestTemplate[];
  /** Contributions counted against the quests. */
  contributions: QuestContribution[];
  /** "Now" in epoch ms; the board only counts the UTC day this falls in. */
  now?: number;
  /**
   * When provided, the panel offers a toggle that swaps in quests generated
   * from the report's under-covered arguments.
   */
  coverageReport?: TopicCoverageReport;
  /** Thresholds used when generating coverage quests. */
  coverageThresholds?: CoverageThresholds;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Shows today's quest progress.
 *
 * @param props - See {@link DailyQuestBoardPanelProps}.
 * @returns The quest board panel.
 */
export function DailyQuestBoardPanel({
  quests,
  contributions,
  now = Date.now(),
  coverageReport,
  coverageThresholds = DEFAULT_COVERAGE_THRESHOLDS,
  className,
}: DailyQuestBoardPanelProps) {
  const [useCoverageQuests, setUseCoverageQuests] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const coverageQuests = useMemo(
    () =>
      coverageReport
        ? buildUnderCoveredArgumentQuests(coverageReport, coverageThresholds)
        : [],
    [coverageReport, coverageThresholds],
  );
  const activeQuests = useCoverageQuests ? coverageQuests : quests;
  const board = useMemo(
    () => buildDailyQuestBoard(activeQuests, contributions, now),
    [activeQuests, contributions, now],
  );

  const completed = board.filter((quest) => quest.isComplete).length;
  const remaining = board.reduce((sum, quest) => sum + quest.remainingCount, 0);

  return (
    <PanelShell
      title="Daily Quests"
      description="Today's research targets and how far along they are."
      icon={<Target className="h-4 w-4" />}
      className={className}
      data-testid="daily-quest-board-panel"
      actions={
        <>
          {coverageReport ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUseCoverageQuests((v) => !v)}
              disabled={coverageQuests.length === 0}
            >
              {useCoverageQuests ? "Standard quests" : "Coverage quests"}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setShowSummary((v) => !v)}>
            {showSummary ? "Hide summary" : "Summary"}
          </Button>
        </>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Quests" value={board.length} />
        <StatTile
          label="Complete"
          value={completed}
          tone={board.length > 0 && completed === board.length ? "positive" : "neutral"}
        />
        <StatTile label="Remaining steps" value={remaining} tone={remaining > 0 ? "warning" : "positive"} />
      </StatGrid>

      <PanelSection title={useCoverageQuests ? "Coverage-gap quests" : "Today's quests"}>
        {board.length === 0 ? (
          <EmptyState
            title="No quests today"
            message={
              coverageReport && !useCoverageQuests
                ? "Switch to coverage quests to generate targets from the coverage report."
                : "Add quest templates to give the squad daily targets."
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {board.map((quest) => (
              <QuestRow key={quest.questId} quest={quest} />
            ))}
          </div>
        )}
      </PanelSection>

      {showSummary && board.length > 0 ? (
        <SummaryText label="Plain-text summary" text={buildQuestBoardSummaryText(board)} />
      ) : null}
    </PanelShell>
  );
}

function QuestRow({ quest }: { quest: QuestProgress }) {
  return (
    <PanelRow
      title={quest.description}
      subtitle={quest.questId}
      trailing={
        quest.isComplete ? (
          <Pill tone="positive">Complete</Pill>
        ) : (
          <Pill tone="warning">{quest.remainingCount} to go</Pill>
        )
      }
    >
      <MeterBar
        value={quest.completedCount}
        max={quest.targetCount}
        tone={quest.isComplete ? "positive" : "info"}
        caption={`${quest.completedCount} / ${quest.targetCount}`}
      />
    </PanelRow>
  );
}
