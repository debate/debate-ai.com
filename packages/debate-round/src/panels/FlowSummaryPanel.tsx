/**
 * @fileoverview Speech transcript summaries and answers — UI over
 * `flow/flow-transcript-summary.ts`, saving the derived summaries per round
 * through `state/flowSummaries.ts`.
 */

"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";

import {
  EmptyState,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import type { Flow } from "debate-core/src/types/flow";

import {
  buildFlowSummaryText,
  getFlowRowSummaries,
  getUnansweredFlowRows,
  suggestCrossExamQuestions,
  suggestExtensionIdeas,
  type FlowRowSummary,
} from "../flow/flow-transcript-summary";
import {
  deleteFlowSummary,
  getFlowSummary,
  saveFlowSummary,
  type FlowSummaryRecord,
} from "../state/flowSummaries";

/** Props for {@link FlowSummaryPanel}. */
export interface FlowSummaryPanelProps {
  /** The flow to summarise. */
  flow: Pick<Flow, "children" | "columns">;
  /** Round id the saved summary is keyed by. */
  roundId?: string;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Row-by-row flow summary with unanswered arguments, cross-ex questions and
 * extension ideas.
 *
 * @param props - See {@link FlowSummaryPanelProps}.
 * @returns The flow summary panel.
 */
export function FlowSummaryPanel({ flow, roundId, className }: FlowSummaryPanelProps) {
  const [showUnansweredOnly, setShowUnansweredOnly] = useState(false);
  const { data: saved, refresh } = useStoreSnapshot<FlowSummaryRecord | undefined>(
    () => (roundId ? getFlowSummary(roundId) : undefined),
    undefined,
  );

  const rows = useMemo(() => getFlowRowSummaries(flow), [flow]);
  const unanswered = useMemo(() => getUnansweredFlowRows(flow), [flow]);
  const visible = showUnansweredOnly ? unanswered : rows;
  const crossExQuestions = useMemo(() => suggestCrossExamQuestions(rows), [rows]);
  const extensionIdeas = useMemo(() => suggestExtensionIdeas(rows), [rows]);

  const savedIsStale =
    saved !== undefined && JSON.stringify(saved.summaries) !== JSON.stringify(rows);

  return (
    <PanelShell
      title="Flow Summary"
      description="What each row of the flow says, and what nobody answered."
      icon={<FileText className="h-4 w-4" />}
      className={className}
      data-testid="flow-summary-panel"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setShowUnansweredOnly((v) => !v)}>
            {showUnansweredOnly ? "Show all rows" : "Unanswered only"}
          </Button>
          {roundId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                saveFlowSummary({ roundId, summaries: rows });
                refresh();
              }}
            >
              {saved ? "Update saved" : "Save summary"}
            </Button>
          ) : null}
        </>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Rows" value={rows.length} />
        <StatTile
          label="Unanswered"
          value={unanswered.length}
          tone={unanswered.length > 0 ? "warning" : "positive"}
        />
        <StatTile
          label="Saved"
          value={saved ? saved.summaries.length : "—"}
          tone={savedIsStale ? "warning" : "neutral"}
          hint={savedIsStale ? "Out of date" : undefined}
        />
      </StatGrid>

      <PanelSection title={showUnansweredOnly ? "Unanswered arguments" : "Rows"}>
        {visible.length === 0 ? (
          <EmptyState
            title={showUnansweredOnly ? "Everything was answered" : "Nothing on the flow yet"}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((row) => (
              <SummaryRow key={row.rowIndex} row={row} />
            ))}
          </div>
        )}
      </PanelSection>

      {crossExQuestions.length > 0 ? (
        <PanelSection title="Cross-ex questions">
          <ul className="list-disc pl-4 text-xs">
            {crossExQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </PanelSection>
      ) : null}

      {extensionIdeas.length > 0 ? (
        <PanelSection title="Extension ideas">
          <ul className="list-disc pl-4 text-xs">
            {extensionIdeas.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
        </PanelSection>
      ) : null}

      <SummaryText label="Plain-text summary" text={buildFlowSummaryText(flow)} />

      {roundId && saved ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteFlowSummary(roundId);
              refresh();
            }}
          >
            Delete saved summary
          </Button>
        </div>
      ) : null}
    </PanelShell>
  );
}

function SummaryRow({ row }: { row: FlowRowSummary }) {
  return (
    <PanelRow
      leading={`${row.rowIndex + 1}`}
      title={row.argument || "(empty)"}
      subtitle={`${row.originSpeech} → ${row.lastSpeech}`}
      trailing={
        row.isHeading ? (
          <Pill>heading</Pill>
        ) : row.isUnanswered ? (
          <Pill tone="warning">unanswered</Pill>
        ) : (
          <Pill tone="positive">answered</Pill>
        )
      }
    >
      {row.entries.length > 1 ? (
        <ul className="flex flex-col gap-0.5">
          {row.entries.slice(1).map((entry) => (
            <li key={`${row.rowIndex}-${entry.speech}`} className="text-muted-foreground text-xs">
              <span className="font-medium">{entry.speech}:</span> {entry.content}
            </li>
          ))}
        </ul>
      ) : null}
    </PanelRow>
  );
}
