/**
 * @fileoverview AI coach mode — UI over `flow/coach-mode.ts`, saving the
 * generated session per round and side through `state/coachingSessions.ts`.
 */

"use client";

import { useMemo, useState } from "react";
import { GraduationCap } from "lucide-react";

import {
  EmptyState,
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
import type { Flow } from "debate-core/src/types/flow";

import {
  buildCoachingSession,
  buildCoachingSummaryText,
  type CoachingPrompt,
  type CoachingPromptKind,
} from "../flow/coach-mode";
import { getFlowSideKeys } from "../flow/argument-tree";
import {
  deleteCoachingSession,
  getCoachingSession,
  saveCoachingSession,
  type CoachingSessionRecord,
} from "../state/coachingSessions";

const KIND_TONE: Record<CoachingPromptKind, PanelTone> = {
  extension: "positive",
  refutation: "critical",
  collapse: "warning",
  weighing: "info",
};

const KIND_LABEL: Record<CoachingPromptKind, string> = {
  extension: "Extend",
  refutation: "Refute",
  collapse: "Collapse",
  weighing: "Weigh",
};

/** Props for {@link CoachModePanel}. */
export interface CoachModePanelProps {
  /** The flow the coaching prompts are derived from. */
  flow: Pick<Flow, "children" | "columns">;
  /** Side being coached, e.g. "aff". Defaults to the flow's first side. */
  sideKey?: string;
  /** Round id the saved session is keyed by. */
  roundId?: string;
  /** How many collapse prompts to generate. */
  collapseLimit?: number;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Extension / refutation / collapse / weighing prompts for one side.
 *
 * @param props - See {@link CoachModePanelProps}.
 * @returns The coach mode panel.
 */
export function CoachModePanel({
  flow,
  sideKey,
  roundId,
  collapseLimit,
  className,
}: CoachModePanelProps) {
  const sideKeys = useMemo(() => getFlowSideKeys(flow), [flow]);
  const [activeSide, setActiveSide] = useState(sideKey ?? sideKeys[0] ?? "aff");
  const [kindFilter, setKindFilter] = useState<CoachingPromptKind | null>(null);

  const { data: saved, refresh } = useStoreSnapshot<CoachingSessionRecord | undefined>(
    () => (roundId ? getCoachingSession(roundId, activeSide) : undefined),
    undefined,
  );

  const prompts = useMemo(
    () =>
      buildCoachingSession(
        flow,
        activeSide,
        collapseLimit === undefined ? {} : { collapseLimit },
      ),
    [flow, activeSide, collapseLimit],
  );

  const visible = kindFilter ? prompts.filter((prompt) => prompt.kind === kindFilter) : prompts;

  const counts = useMemo(() => {
    const tally: Partial<Record<CoachingPromptKind, number>> = {};
    for (const prompt of prompts) tally[prompt.kind] = (tally[prompt.kind] ?? 0) + 1;
    return tally;
  }, [prompts]);

  return (
    <PanelShell
      title="Coach Mode"
      description="What to extend, answer, collapse to and weigh."
      icon={<GraduationCap className="h-4 w-4" />}
      className={className}
      data-testid="coach-mode-panel"
      actions={
        <>
          {sideKeys.map((key) => (
            <button key={key} type="button" onClick={() => setActiveSide(key)}>
              <Pill tone={activeSide === key ? "info" : "neutral"}>{key}</Pill>
            </button>
          ))}
          {roundId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                saveCoachingSession({ roundId, sideKey: activeSide, prompts });
                refresh();
              }}
            >
              {saved ? "Update saved" : "Save session"}
            </Button>
          ) : null}
        </>
      }
    >
      <StatGrid columns={4}>
        <StatTile label="Extend" value={counts.extension ?? 0} tone="positive" />
        <StatTile label="Refute" value={counts.refutation ?? 0} tone="critical" />
        <StatTile label="Collapse" value={counts.collapse ?? 0} tone="warning" />
        <StatTile label="Weigh" value={counts.weighing ?? 0} tone="info" />
      </StatGrid>

      <PanelSection
        title="Prompts"
        actions={
          <div className="flex flex-wrap gap-1">
            {(Object.keys(KIND_LABEL) as CoachingPromptKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setKindFilter(kindFilter === kind ? null : kind)}
              >
                <Pill tone={kindFilter === kind ? KIND_TONE[kind] : "neutral"}>
                  {KIND_LABEL[kind]}
                </Pill>
              </button>
            ))}
          </div>
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            title="No coaching prompts"
            message="Flow a few arguments for this side to generate prompts."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((prompt, index) => (
              <PromptRow key={`${prompt.kind}-${prompt.rowIndex}-${index}`} prompt={prompt} />
            ))}
          </div>
        )}
      </PanelSection>

      {prompts.length > 0 ? (
        <SummaryText label="Plain-text summary" text={buildCoachingSummaryText(prompts)} />
      ) : null}

      {roundId && saved ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteCoachingSession(roundId, activeSide);
              refresh();
            }}
          >
            Delete saved session
          </Button>
        </div>
      ) : null}
    </PanelShell>
  );
}

function PromptRow({ prompt }: { prompt: CoachingPrompt }) {
  return (
    <PanelRow
      leading={prompt.rowIndex === null ? "—" : `${prompt.rowIndex + 1}`}
      title={prompt.prompt}
      trailing={<Pill tone={KIND_TONE[prompt.kind]}>{KIND_LABEL[prompt.kind]}</Pill>}
    />
  );
}
