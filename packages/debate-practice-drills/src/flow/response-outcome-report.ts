/**
 * @fileoverview Builds a plain-text export of a round's AI Response-Outcome
 * Chart — the "chart export/share (image or link) action" follow-up named
 * under idea #4 ("AI Response-Outcome Charts") in TODO.md. Pure
 * string-building only, so it's directly Vitest-testable;
 * `VulnerabilityChartsPanel.tsx` wraps the result in a `Blob` and triggers
 * the actual browser download, mirroring `round/ai-versus-transcript.ts`'s
 * exact pure-builder/thin-caller split and its anchor+Blob download
 * pattern (itself mirroring `dialogs/FileExportDialog.tsx`'s).
 *
 * A share-image export isn't attempted here — nothing in this repo renders
 * a chart to a bitmap today, and pulling in a canvas-rendering dependency
 * for one panel isn't warranted — so this closes the follow-up's
 * plain-text/"link"-shaped half: a downloadable snapshot of exactly what
 * the panel is currently showing for a round (its side summary, most
 * exposed arguments, and latest AI counsel-panel assessment if one has
 * been requested), suitable for pasting into a Speech Document or sharing
 * outside the app.
 *
 * @module flow/response-outcome-report
 */

import type { CounselPanelAssessmentRecord } from "../state/counselPanelAssessments";
import type { SideOutcomeSummary, VulnerabilityChartPoint } from "debate-round/src/flow/response-outcome";

export type ResponseOutcomeReportInput = {
  roundId: string;
  sideSummaries: SideOutcomeSummary[];
  chartPoints: VulnerabilityChartPoint[];
  /** The round's newest AI counsel-panel assessment, if one has been requested. Older history is not included. */
  latestAssessment?: CounselPanelAssessmentRecord | null;
};

/**
 * Renders a round's response-outcome chart as plain text: a header, the
 * per-side exposure summary, the "most exposed arguments" list (in the
 * same vulnerability-score-descending order the chart renders), and —
 * when one exists — the latest AI counsel-panel assessment's overall
 * clash summary plus each assessed argument's counsel role, likely
 * response path, and clash estimate.
 *
 * Reflects whatever `sideSummaries`/`chartPoints` the caller passes in, so
 * a report exported while a "what if" hypothetical is active captures that
 * hypothetical's numbers, not the round's persisted report.
 */
export function buildResponseOutcomeReportText(input: ResponseOutcomeReportInput): string {
  const { roundId, sideSummaries, chartPoints, latestAssessment } = input;

  const header = `AI Response-Outcome Chart — Round ${roundId}`;

  const sideSection =
    sideSummaries.length === 0
      ? "No flowed arguments to summarize yet."
      : sideSummaries
          .map(
            (side) =>
              `${side.sideKey}: ${side.averageVulnerability} avg vulnerability, ` +
              `${side.argumentCount} argument${side.argumentCount === 1 ? "" : "s"}, ` +
              `${side.unansweredCount} unanswered`,
          )
          .join("\n");

  const chartSection =
    chartPoints.length === 0
      ? "No flowed arguments to chart yet."
      : chartPoints.map((point) => `${point.value} — ${point.label}`).join("\n");

  const sections = [
    header,
    "",
    "Per-side exposure:",
    sideSection,
    "",
    "Most exposed arguments:",
    chartSection,
  ];

  if (latestAssessment) {
    sections.push("", "AI counsel panel:", latestAssessment.result.overallClashSummary, "");
    sections.push(
      ...latestAssessment.result.argumentAssessments.map((assessment) => {
        const point = chartPoints.find((p) => p.rowIndex === assessment.rowIndex);
        const label = point?.label ?? `Row ${assessment.rowIndex}`;
        return (
          `- ${label} (${assessment.counselRole})\n` +
          `  Likely response: ${assessment.likelyResponsePath}\n` +
          `  Clash estimate: ${assessment.clashEstimate}`
        );
      }),
    );
  }

  return `${sections.join("\n")}\n`;
}

/**
 * A filesystem-safe filename for a round's response-outcome report
 * download, e.g. `response-outcome-round-1-report.txt`. Non-alphanumeric
 * characters in the round id collapse to single hyphens, mirroring
 * `ai-versus-transcript.ts#aiVersusTranscriptFilename`'s exact rule.
 */
export function responseOutcomeReportFilename(roundId: string): string {
  const safeId = roundId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `response-outcome-${safeId || "round"}-report.txt`;
}
