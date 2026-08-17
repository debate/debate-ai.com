/**
 * @fileoverview Topic coverage dashboard — the UI over `lib/topic-coverage.ts`.
 *
 * Shows how much evidence exists per tracked argument, which arguments are
 * missing or thin, and which argument blocks cards were filed under that
 * nobody is tracking.
 */

"use client";

import { useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";

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
  type PanelTone,
} from "debate-ui/src/panels/panel-shell";
import { Button } from "debate-ui/src/primitives/button";

import {
  DEFAULT_COVERAGE_THRESHOLDS,
  buildTopicCoverageReport,
  buildTopicCoverageSummaryText,
  getUnderCoveredArguments,
  type ArgumentCoverage,
  type CoverageCardSummary,
  type CoverageLevel,
  type CoverageThresholds,
  type TrackedArgument,
} from "../lib/topic-coverage";

/** Tone used for each coverage level, shared by the pills and meters. */
const LEVEL_TONE: Record<CoverageLevel, PanelTone> = {
  missing: "critical",
  thin: "warning",
  covered: "positive",
};

const LEVEL_LABEL: Record<CoverageLevel, string> = {
  missing: "Missing",
  thin: "Thin",
  covered: "Covered",
};

/** Props for {@link TopicCoverageDashboard}. */
export interface TopicCoverageDashboardProps {
  /** Arguments the squad intends to have evidence for. */
  trackedArguments: TrackedArgument[];
  /** Cards submitted so far. */
  cards: CoverageCardSummary[];
  /** Card/word thresholds separating covered from thin. */
  thresholds?: CoverageThresholds;
  /** Invoked when a coverage row is clicked, e.g. to filter a card list. */
  onSelectArgument?: (argBlock: string) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Renders a {@link buildTopicCoverageReport} report as a dashboard.
 *
 * @param props - See {@link TopicCoverageDashboardProps}.
 * @returns The coverage dashboard panel.
 *
 * @example
 * ```tsx
 * <TopicCoverageDashboard trackedArguments={tracked} cards={cards} />
 * ```
 */
export function TopicCoverageDashboard({
  trackedArguments,
  cards,
  thresholds = DEFAULT_COVERAGE_THRESHOLDS,
  onSelectArgument,
  className,
}: TopicCoverageDashboardProps) {
  const [showGapsOnly, setShowGapsOnly] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const report = useMemo(
    () => buildTopicCoverageReport(trackedArguments, cards, thresholds),
    [trackedArguments, cards, thresholds],
  );
  const gaps = useMemo(() => getUnderCoveredArguments(report), [report]);
  const visible = showGapsOnly ? gaps : report.tracked;

  const counts = useMemo(() => {
    const tally: Record<CoverageLevel, number> = { missing: 0, thin: 0, covered: 0 };
    for (const argument of report.tracked) tally[argument.level] += 1;
    return tally;
  }, [report]);

  return (
    <PanelShell
      title="Topic Coverage"
      description="Evidence depth per tracked argument."
      icon={<LayoutGrid className="h-4 w-4" />}
      className={className}
      data-testid="topic-coverage-dashboard"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setShowGapsOnly((v) => !v)}>
            {showGapsOnly ? "Show all" : "Show gaps"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSummary((v) => !v)}>
            {showSummary ? "Hide summary" : "Summary"}
          </Button>
        </>
      }
    >
      <StatGrid columns={4}>
        <StatTile label="Tracked" value={report.tracked.length} />
        <StatTile label="Covered" value={counts.covered} tone="positive" />
        <StatTile label="Thin" value={counts.thin} tone="warning" />
        <StatTile label="Missing" value={counts.missing} tone="critical" />
      </StatGrid>

      <PanelSection
        title={showGapsOnly ? "Coverage gaps" : "Tracked arguments"}
        description={`Covered at ${thresholds.minCards}+ cards and ${thresholds.minTotalWords}+ words.`}
      >
        {visible.length === 0 ? (
          <EmptyState
            title={showGapsOnly ? "No coverage gaps" : "No tracked arguments"}
            message={
              showGapsOnly
                ? "Every tracked argument meets both thresholds."
                : "Add arguments to the tracked list to see coverage."
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((argument) => (
              <CoverageRow
                key={argument.argBlock}
                coverage={argument}
                thresholds={thresholds}
                onSelect={onSelectArgument}
              />
            ))}
          </div>
        )}
      </PanelSection>

      {report.untracked.length > 0 ? (
        <PanelSection
          title="Untracked blocks"
          description="Cards filed under an argument nobody is tracking."
        >
          <div className="flex flex-col gap-2">
            {report.untracked.map((argument) => (
              <CoverageRow
                key={argument.argBlock}
                coverage={argument}
                thresholds={thresholds}
                onSelect={onSelectArgument}
              />
            ))}
          </div>
        </PanelSection>
      ) : null}

      {showSummary ? (
        <SummaryText label="Plain-text summary" text={buildTopicCoverageSummaryText(report)} />
      ) : null}
    </PanelShell>
  );
}

function CoverageRow({
  coverage,
  thresholds,
  onSelect,
}: {
  coverage: ArgumentCoverage;
  thresholds: CoverageThresholds;
  onSelect?: (argBlock: string) => void;
}) {
  const tone = LEVEL_TONE[coverage.level];
  return (
    <PanelRow
      className={onSelect ? "hover:border-primary/50 cursor-pointer transition-colors" : undefined}
      title={
        onSelect ? (
          <button type="button" className="text-left" onClick={() => onSelect(coverage.argBlock)}>
            {coverage.argBlock}
          </button>
        ) : (
          coverage.argBlock
        )
      }
      subtitle={coverage.category}
      trailing={<Pill tone={tone}>{LEVEL_LABEL[coverage.level]}</Pill>}
    >
      <MeterBar
        value={coverage.cardCount}
        max={thresholds.minCards}
        tone={tone}
        label={`${coverage.cardCount} card${coverage.cardCount === 1 ? "" : "s"}`}
        caption={`${coverage.totalWordCount} / ${thresholds.minTotalWords} words`}
      />
    </PanelRow>
  );
}
