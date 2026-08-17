/**
 * @fileoverview AI drill generator — UI over `flow/drill-generator.ts`, saving
 * the generated set per round through `state/drillSets.ts`.
 */

"use client";

import { useMemo, useState } from "react";
import { Dumbbell } from "lucide-react";

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
  buildDrillSet,
  buildDrillSummaryText,
  type Drill,
  type DrillKind,
} from "../flow/drill-generator";
import { getFlowSideKeys } from "../flow/argument-tree";
import { deleteDrillSet, getDrillSet, saveDrillSet, type DrillSetRecord } from "../state/drillSets";

const KIND_TONE: Record<DrillKind, PanelTone> = {
  overview: "info",
  frontline: "critical",
  cross_ex: "warning",
  collapse: "positive",
};

const KIND_LABEL: Record<DrillKind, string> = {
  overview: "Overview",
  frontline: "Frontline",
  cross_ex: "Cross-ex",
  collapse: "Collapse",
};

/** Props for {@link DrillGeneratorPanel}. */
export interface DrillGeneratorPanelProps {
  /** The flow drills are generated from. */
  flow: Pick<Flow, "children" | "columns">;
  /** Side drilling, e.g. "neg". Defaults to the flow's first side. */
  sideKey?: string;
  /** Round id the saved drill set is keyed by. */
  roundId?: string;
  /** How many collapse drills to generate. */
  collapseLimit?: number;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Practice drills generated from a finished flow.
 *
 * @param props - See {@link DrillGeneratorPanelProps}.
 * @returns The drill generator panel.
 */
export function DrillGeneratorPanel({
  flow,
  sideKey,
  roundId,
  collapseLimit,
  className,
}: DrillGeneratorPanelProps) {
  const sideKeys = useMemo(() => getFlowSideKeys(flow), [flow]);
  const [activeSide, setActiveSide] = useState(sideKey ?? sideKeys[0] ?? "aff");
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const { data: saved, refresh } = useStoreSnapshot<DrillSetRecord | undefined>(
    () => (roundId ? getDrillSet(roundId) : undefined),
    undefined,
  );

  const drills = useMemo(
    () => buildDrillSet(flow, activeSide, collapseLimit === undefined ? {} : { collapseLimit }),
    [flow, activeSide, collapseLimit],
  );

  const drillKey = (drill: Drill, index: number) => `${drill.kind}-${drill.rowIndex}-${index}`;
  const doneCount = drills.filter((drill, index) => completed.has(drillKey(drill, index))).length;

  const toggleDone = (key: string) =>
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <PanelShell
      title="Drill Generator"
      description="Practice drills built from what actually happened on the flow."
      icon={<Dumbbell className="h-4 w-4" />}
      className={className}
      data-testid="drill-generator-panel"
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
                saveDrillSet({ roundId, sideKey: activeSide, drills });
                refresh();
              }}
            >
              {saved ? "Update saved" : "Save set"}
            </Button>
          ) : null}
        </>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Drills" value={drills.length} />
        <StatTile
          label="Completed"
          value={`${doneCount}/${drills.length}`}
          tone={drills.length > 0 && doneCount === drills.length ? "positive" : "info"}
        />
        <StatTile label="Saved set" value={saved ? `${saved.drills.length} (${saved.sideKey})` : "—"} />
      </StatGrid>

      <PanelSection title="Drills">
        {drills.length === 0 ? (
          <EmptyState
            title="No drills yet"
            message="Flow a round for this side and drills will be generated from it."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {drills.map((drill, index) => {
              const key = drillKey(drill, index);
              const done = completed.has(key);
              return (
                <PanelRow
                  key={key}
                  leading={drill.rowIndex === null ? "—" : `${drill.rowIndex + 1}`}
                  title={
                    <span className={done ? "line-through opacity-60" : undefined}>
                      {drill.prompt}
                    </span>
                  }
                  trailing={
                    <>
                      <Pill tone={KIND_TONE[drill.kind]}>{KIND_LABEL[drill.kind]}</Pill>
                      <Button variant="ghost" size="sm" onClick={() => toggleDone(key)}>
                        {done ? "Undo" : "Done"}
                      </Button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </PanelSection>

      {drills.length > 0 ? (
        <SummaryText label="Plain-text summary" text={buildDrillSummaryText(drills)} />
      ) : null}

      {roundId && saved ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteDrillSet(roundId);
              refresh();
            }}
          >
            Delete saved set
          </Button>
        </div>
      ) : null}
    </PanelShell>
  );
}
