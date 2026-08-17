/**
 * @fileoverview AI response-outcome charts — UI over `flow/response-outcome.ts`.
 *
 * Plots per-argument vulnerability as a bar chart and summarises each side's
 * exposure. The chart is inline SVG rather than a charting library so the
 * panel renders identically on the server and in tests.
 */

"use client";

import { useMemo, useState } from "react";
import { ChartColumnIncreasing } from "lucide-react";

import {
  EmptyState,
  MeterBar,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  type PanelTone,
} from "debate-ui/src/panels/panel-shell";
import { Button } from "debate-ui/src/primitives/button";
import type { Flow } from "debate-core/src/types/flow";

import {
  buildVulnerabilityChartData,
  getArgumentVulnerabilityReport,
  summarizeOutcomeBySide,
  type ArgumentVulnerability,
  type VulnerabilityChartPoint,
} from "../flow/response-outcome";

/** Vulnerability at or above this score reads as "at risk". */
const AT_RISK_THRESHOLD = 0.5;

function toneForScore(score: number): PanelTone {
  if (score >= 0.75) return "critical";
  if (score >= AT_RISK_THRESHOLD) return "warning";
  return "positive";
}

/** Props for {@link ResponseOutcomePanel}. */
export interface ResponseOutcomePanelProps {
  /** The flow to score. */
  flow: Pick<Flow, "children" | "columns">;
  /** How many bars the chart shows. */
  chartLimit?: number;
  /** Invoked when an argument row is clicked. */
  onSelectArgument?: (argument: ArgumentVulnerability) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Vulnerability chart and per-side outcome summary for a flow.
 *
 * @param props - See {@link ResponseOutcomePanelProps}.
 * @returns The response outcome panel.
 */
export function ResponseOutcomePanel({
  flow,
  chartLimit = 10,
  onSelectArgument,
  className,
}: ResponseOutcomePanelProps) {
  const [atRiskOnly, setAtRiskOnly] = useState(false);

  const report = useMemo(() => getArgumentVulnerabilityReport(flow), [flow]);
  const sides = useMemo(() => summarizeOutcomeBySide(flow), [flow]);
  const chartData = useMemo(
    () => buildVulnerabilityChartData(flow, { limit: chartLimit }),
    [flow, chartLimit],
  );

  const visible = atRiskOnly
    ? report.filter((argument) => argument.vulnerabilityScore >= AT_RISK_THRESHOLD)
    : report;
  const atRisk = report.filter(
    (argument) => argument.vulnerabilityScore >= AT_RISK_THRESHOLD,
  ).length;
  const unanswered = report.filter((argument) => argument.isUnanswered).length;

  return (
    <PanelShell
      title="Response Outcomes"
      description="Which arguments are most exposed going into the next speech."
      icon={<ChartColumnIncreasing className="h-4 w-4" />}
      className={className}
      data-testid="response-outcome-panel"
      actions={
        <Button variant="outline" size="sm" onClick={() => setAtRiskOnly((v) => !v)}>
          {atRiskOnly ? "Show all" : "At risk only"}
        </Button>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Arguments" value={report.length} />
        <StatTile label="At risk" value={atRisk} tone={atRisk > 0 ? "warning" : "positive"} />
        <StatTile
          label="Unanswered"
          value={unanswered}
          tone={unanswered > 0 ? "critical" : "positive"}
        />
      </StatGrid>

      <PanelSection title="Vulnerability chart" description={`Top ${chartLimit} by score.`}>
        {chartData.length === 0 ? (
          <EmptyState title="Nothing to chart" message="Flow an argument to score it." />
        ) : (
          <VulnerabilityChart points={chartData} />
        )}
      </PanelSection>

      <PanelSection title="By side">
        {sides.length === 0 ? (
          <EmptyState title="No sides detected" />
        ) : (
          <div className="flex flex-col gap-2">
            {sides.map((side) => (
              <PanelRow
                key={side.sideKey}
                title={side.sideKey}
                subtitle={`${side.argumentCount} argument${side.argumentCount === 1 ? "" : "s"} · ${side.unansweredCount} unanswered`}
                trailing={
                  <Pill tone={toneForScore(side.averageVulnerability)}>
                    {side.averageVulnerability.toFixed(2)}
                  </Pill>
                }
              >
                <MeterBar
                  value={side.averageVulnerability}
                  max={1}
                  tone={toneForScore(side.averageVulnerability)}
                />
              </PanelRow>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Arguments">
        {visible.length === 0 ? (
          <EmptyState
            title={atRiskOnly ? "Nothing at risk" : "No arguments scored"}
            message={atRiskOnly ? "Every argument scored below the at-risk threshold." : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((argument) => (
              <PanelRow
                key={argument.rowIndex}
                title={
                  onSelectArgument ? (
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => onSelectArgument(argument)}
                    >
                      {argument.argument || "(empty)"}
                    </button>
                  ) : (
                    argument.argument || "(empty)"
                  )
                }
                subtitle={`${argument.originSpeech} → ${argument.lastSpeech} · ${argument.opposingResponses} response${argument.opposingResponses === 1 ? "" : "s"} · ${argument.sameSideExtensions} extension${argument.sameSideExtensions === 1 ? "" : "s"}`}
                trailing={
                  <>
                    {argument.sideKey ? <Pill>{argument.sideKey}</Pill> : null}
                    {argument.isUnanswered ? <Pill tone="warning">unanswered</Pill> : null}
                    <span className="font-semibold">
                      {argument.vulnerabilityScore.toFixed(2)}
                    </span>
                  </>
                }
              >
                <MeterBar
                  value={argument.vulnerabilityScore}
                  max={1}
                  tone={toneForScore(argument.vulnerabilityScore)}
                />
              </PanelRow>
            ))}
          </div>
        )}
      </PanelSection>
    </PanelShell>
  );
}

/**
 * Inline SVG column chart of vulnerability scores.
 *
 * @param props.points - Chart points from `buildVulnerabilityChartData`.
 * @returns The chart element.
 */
function VulnerabilityChart({ points }: { points: VulnerabilityChartPoint[] }) {
  const height = 120;
  const barGap = 6;
  const barWidth = 28;
  const width = points.length * (barWidth + barGap) + barGap;
  const maxValue = Math.max(1, ...points.map((point) => point.value));

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="Argument vulnerability chart"
        width={width}
        height={height + 28}
        viewBox={`0 0 ${width} ${height + 28}`}
        className="text-muted-foreground"
      >
        <line
          x1={0}
          y1={height}
          x2={width}
          y2={height}
          stroke="currentColor"
          strokeOpacity={0.3}
        />
        {points.map((point, index) => {
          const barHeight = Math.max(2, (point.value / maxValue) * (height - 8));
          const x = barGap + index * (barWidth + barGap);
          const tone = toneForScore(point.value);
          const fill =
            tone === "critical"
              ? "rgb(244 63 94)"
              : tone === "warning"
                ? "rgb(245 158 11)"
                : "rgb(16 185 129)";
          return (
            <g key={point.rowIndex}>
              <title>{`${point.label}: ${point.value.toFixed(2)}`}</title>
              <rect
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill={fill}
              />
              <text
                x={x + barWidth / 2}
                y={height + 12}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
              >
                {point.rowIndex + 1}
              </text>
              <text
                x={x + barWidth / 2}
                y={height + 24}
                textAnchor="middle"
                fontSize={8}
                fill="currentColor"
              >
                {point.sideKey ?? "—"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
