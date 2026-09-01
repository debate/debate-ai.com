/**
 * @fileoverview Shared flow sync — UI over `flow/shared-flow-sync.ts`.
 *
 * Shows how concurrent edits from partners merge into the flow, which boxes
 * had near-simultaneous edits that need a human decision, and applies the
 * merge once the conflicts have been looked at.
 */

"use client";

import { useMemo, useState } from "react";
import { GitMerge } from "lucide-react";

import {
  EmptyState,
  LabeledField,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
} from "../ui/panels/panel-shell";
import { Button } from "../ui/primitives/button";
import { Input } from "../ui/primitives/input";
import type { Flow } from "../types/flow";

import {
  applyMergedEditsToFlow,
  buildSharedFlowSyncSummaryText,
  mergeFlowEdits,
  type FlowEdit,
} from "../flow/shared-flow-sync";
import { useFlowSyncPolling } from "../hooks/useFlowSyncPolling";

/** Props for {@link SharedFlowSyncPanel}. */
export interface SharedFlowSyncPanelProps {
  /** The local flow the merge would be applied to. */
  flow: Flow;
  /** Incoming edits from every collaborator, including this client's. */
  edits: FlowEdit[];
  /** Milliseconds within which two edits to one box count as conflicting. */
  conflictWindowMs?: number;
  /** Applies the merged flow. Without it the panel is read-only. */
  onApply?: (flow: Flow) => void;
  /**
   * Called after a live-sync poll pulls new edits from teammates for this
   * flow, so a composing screen's own snapshot of `state/flowEdits.ts`
   * (this panel's `edits` prop) can refresh in step — mirrors
   * `FlowEditLogPanel`'s `onChange` convention.
   */
  onSyncPulled?: () => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Concurrent-edit merge preview with conflict detection.
 *
 * @param props - See {@link SharedFlowSyncPanelProps}.
 * @returns The shared flow sync panel.
 */
export function SharedFlowSyncPanel({
  flow,
  edits,
  conflictWindowMs,
  onApply,
  onSyncPulled,
  className,
}: SharedFlowSyncPanelProps) {
  const [windowInput, setWindowInput] = useState(
    conflictWindowMs === undefined ? "" : String(conflictWindowMs),
  );
  const [syncEnabled, setSyncEnabled] = useState(false);

  const parsedWindow = Number.parseInt(windowInput, 10);
  const options = Number.isFinite(parsedWindow) ? { conflictWindowMs: parsedWindow } : {};

  const result = useMemo(() => mergeFlowEdits(edits, options), [edits, windowInput]);

  const authors = useMemo(
    () => Array.from(new Set(edits.map((edit) => edit.authorId))),
    [edits],
  );

  const { status: syncStatus, lastError: syncError } = useFlowSyncPolling(
    flow.id,
    onSyncPulled,
    { enabled: syncEnabled },
  );

  return (
    <PanelShell
      title="Shared Flow Sync"
      description="How partner edits merge into this flow."
      icon={<GitMerge className="h-4 w-4" />}
      className={className}
      data-testid="shared-flow-sync-panel"
      actions={
        onApply ? (
          <Button
            size="sm"
            disabled={result.merged.length === 0}
            onClick={() => onApply(applyMergedEditsToFlow(flow, result.merged))}
          >
            Apply {result.merged.length} edit{result.merged.length === 1 ? "" : "s"}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Button
          size="sm"
          variant={syncEnabled ? "default" : "outline"}
          className="h-6 px-2 text-xs"
          onClick={() => setSyncEnabled((prev) => !prev)}
        >
          {syncEnabled ? "Live sync on" : "Live sync off"}
        </Button>
        {syncEnabled ? (
          <Pill>{syncStatus === "error" ? (syncError ?? "Sync error") : syncStatus}</Pill>
        ) : (
          <span>Pulls teammates&apos; edits to Flow {flow.id} from the server while on.</span>
        )}
      </div>

      <StatGrid columns={4}>
        <StatTile label="Incoming edits" value={edits.length} />
        <StatTile label="Merged boxes" value={result.merged.length} tone="positive" />
        <StatTile
          label="Conflicts"
          value={result.conflicts.length}
          tone={result.conflicts.length > 0 ? "warning" : "positive"}
        />
        <StatTile label="Collaborators" value={authors.length} />
      </StatGrid>

      <PanelSection title="Conflict window">
        <div className="flex items-end gap-2">
          <LabeledField label="Milliseconds" className="w-40">
            <Input
              value={windowInput}
              inputMode="numeric"
              placeholder="default"
              onChange={(e) => setWindowInput(e.target.value)}
            />
          </LabeledField>
          <p className="text-muted-foreground text-xs">
            Two edits to the same box inside this window are flagged rather than
            silently overwritten.
          </p>
        </div>
      </PanelSection>

      <PanelSection title="Merged edits">
        {result.merged.length === 0 ? (
          <EmptyState title="Nothing to merge" message="No incoming edits from collaborators." />
        ) : (
          <div className="flex flex-col gap-2">
            {result.merged.map((edit) => (
              <PanelRow
                key={edit.boxPath.join(".")}
                leading={edit.boxPath.join(".")}
                title={edit.content || "(cleared)"}
                subtitle={edit.authorId}
                trailing={<Pill tone="positive">wins</Pill>}
              />
            ))}
          </div>
        )}
      </PanelSection>

      {result.conflicts.length > 0 ? (
        <PanelSection
          title="Conflicts"
          description="Same box, edits close together — check before applying."
        >
          <div className="flex flex-col gap-2">
            {result.conflicts.map((conflict) => (
              <PanelRow
                key={conflict.boxPath.join(".")}
                leading={conflict.boxPath.join(".")}
                title={`${conflict.edits.length} competing edits`}
                trailing={<Pill tone="warning">conflict</Pill>}
              >
                <ul className="flex flex-col gap-1">
                  {conflict.edits.map((edit) => (
                    <li key={edit.id} className="text-muted-foreground text-xs">
                      <span className="font-medium">{edit.authorId}</span>: {edit.content}
                    </li>
                  ))}
                </ul>
              </PanelRow>
            ))}
          </div>
        </PanelSection>
      ) : null}

      <SummaryText label="Plain-text summary" text={buildSharedFlowSyncSummaryText(result)} />
    </PanelShell>
  );
}
