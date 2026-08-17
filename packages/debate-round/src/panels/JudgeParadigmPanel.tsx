/**
 * @fileoverview AI judge decision modes — UI over `debate-speech-writer`'s
 * `judge-paradigms.ts`, persisting the round's selection through
 * `state/judgeParadigmSelections.ts`.
 *
 * Picks the paradigm the AI judge decides under, including a custom paradigm
 * built from free-text voting priorities.
 */

"use client";

import { useMemo, useState } from "react";
import { Scale } from "lucide-react";

import {
  LabeledField,
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
import { Textarea } from "debate-ui/src/primitives/textarea";
import {
  buildCustomJudgeParadigm,
  buildJudgeParadigmPrompt,
  listJudgeParadigms,
  type JudgeParadigm,
} from "debate-speech-writer/src/judge/judge-paradigms";
import {
  deleteJudgeParadigmSelection,
  getJudgeParadigmSelection,
  saveJudgeParadigmSelection,
  type JudgeParadigmSelection,
} from "debate-speech-writer/src/state/judgeParadigmSelections";

const TOLERANCE_TONE: Record<"low" | "medium" | "high", PanelTone> = {
  low: "critical",
  medium: "warning",
  high: "positive",
};

/** Props for {@link JudgeParadigmPanel}. */
export interface JudgeParadigmPanelProps {
  /** Round the selection is stored under. */
  roundId: string;
  /** Notified whenever the active paradigm changes. */
  onSelectParadigm?: (paradigm: JudgeParadigm) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Judge-paradigm picker with a custom-paradigm builder.
 *
 * @param props - See {@link JudgeParadigmPanelProps}.
 * @returns The judge paradigm panel.
 */
export function JudgeParadigmPanel({
  roundId,
  onSelectParadigm,
  className,
}: JudgeParadigmPanelProps) {
  const { data: selection, refresh } = useStoreSnapshot<JudgeParadigmSelection | undefined>(
    () => getJudgeParadigmSelection(roundId),
    undefined,
  );

  const paradigms = useMemo(() => listJudgeParadigms(), []);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  const active = selection?.paradigm ?? paradigms[0];

  const select = (paradigm: JudgeParadigm) => {
    saveJudgeParadigmSelection({ roundId, paradigm });
    onSelectParadigm?.(paradigm);
    refresh();
  };

  const saveCustom = () => {
    try {
      select(buildCustomJudgeParadigm({ name: customName, notes: customNotes }));
      setCustomError(null);
      setShowCustom(false);
    } catch (cause) {
      setCustomError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <PanelShell
      title="Judge Paradigm"
      description="How the AI judge decides this round."
      icon={<Scale className="h-4 w-4" />}
      className={className}
      data-testid="judge-paradigm-panel"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setShowCustom((v) => !v)}>
            {showCustom ? "Cancel custom" : "Custom paradigm"}
          </Button>
          {selection ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                deleteJudgeParadigmSelection(roundId);
                refresh();
              }}
            >
              Reset
            </Button>
          ) : null}
        </>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Selected" value={active?.name ?? "—"} tone="info" />
        <StatTile
          label="Speed tolerance"
          value={active?.speedTolerance ?? "—"}
          tone={active ? TOLERANCE_TONE[active.speedTolerance] : "neutral"}
        />
        <StatTile
          label="Jargon tolerance"
          value={active?.jargonTolerance ?? "—"}
          tone={active ? TOLERANCE_TONE[active.jargonTolerance] : "neutral"}
        />
      </StatGrid>

      <PanelSection title="Paradigms">
        <div className="flex flex-col gap-2">
          {paradigms.map((paradigm) => (
            <PanelRow
              key={paradigm.id}
              className={active?.id === paradigm.id ? "border-primary" : undefined}
              title={
                <button type="button" className="text-left" onClick={() => select(paradigm)}>
                  {paradigm.name}
                </button>
              }
              subtitle={paradigm.description}
              trailing={
                active?.id === paradigm.id ? <Pill tone="positive">selected</Pill> : null
              }
            >
              <ul className="text-muted-foreground list-disc pl-4 text-xs">
                {paradigm.votingPriorities.map((priority) => (
                  <li key={priority}>{priority}</li>
                ))}
              </ul>
            </PanelRow>
          ))}
        </div>
      </PanelSection>

      {showCustom ? (
        <PanelSection
          title="Custom paradigm"
          description="Built from a real judge's own paradigm card."
        >
          <LabeledField label="Judge name">
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} />
          </LabeledField>
          <LabeledField
            label="Paradigm notes"
            hint="Pasted verbatim into the AI judge prompt."
          >
            <Textarea rows={4} value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} />
          </LabeledField>
          {customError ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">{customError}</p>
          ) : null}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={saveCustom}
              disabled={!customName.trim() || !customNotes.trim()}
            >
              Use custom paradigm
            </Button>
          </div>
        </PanelSection>
      ) : null}

      {active ? (
        <SummaryText label="Judge prompt" text={buildJudgeParadigmPrompt(active)} />
      ) : null}
    </PanelShell>
  );
}
