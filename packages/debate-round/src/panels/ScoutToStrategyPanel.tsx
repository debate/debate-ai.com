/**
 * @fileoverview Scout-to-strategy workflow — UI over `round/scout-to-strategy.ts`.
 *
 * Ranks the case options by how little they overlap with what the opponent
 * answers well, lists the judge adaptations, and shows the matchup risk.
 */

"use client";

import { useMemo, useState } from "react";
import { Compass } from "lucide-react";

import {
  EmptyState,
  LabeledField,
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
import { Input } from "debate-ui/src/primitives/input";
import type { JudgeProfile } from "debate-speech-writer/src/judge/judge-profile";
import type { OpponentTeamProfile } from "debate-data-sync/src/rankings/opponent-team-profile";

import {
  buildStrategyRecommendation,
  buildStrategyRecommendationText,
  type CaseOption,
  type RiskLevel,
} from "../round/scout-to-strategy";

const RISK_TONE: Record<RiskLevel, PanelTone> = {
  low: "positive",
  medium: "warning",
  high: "critical",
};

/** Props for {@link ScoutToStrategyPanel}. */
export interface ScoutToStrategyPanelProps {
  /** Cases the team could read. */
  caseOptions: CaseOption[];
  /** Scouting profile for the opponent. */
  opponentProfile?: OpponentTeamProfile;
  /** Tendency profile for the judge. */
  judgeProfile?: JudgeProfile;
  /** Allows adding a case option inline. */
  onAddCaseOption?: (option: CaseOption) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Case recommendation, judge adaptations and matchup risk.
 *
 * @param props - See {@link ScoutToStrategyPanelProps}.
 * @returns The scout-to-strategy panel.
 */
export function ScoutToStrategyPanel({
  caseOptions,
  opponentProfile,
  judgeProfile,
  onAddCaseOption,
  className,
}: ScoutToStrategyPanelProps) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  const recommendation = useMemo(
    () =>
      buildStrategyRecommendation({
        caseOptions,
        ...(opponentProfile ? { opponentProfile } : {}),
        ...(judgeProfile ? { judgeProfile } : {}),
      }),
    [caseOptions, opponentProfile, judgeProfile],
  );

  const worstOverlap = Math.max(
    1,
    ...recommendation.caseRankings.map((option) => option.overlapScore),
  );

  const addOption = () => {
    if (!onAddCaseOption || !name.trim()) return;
    onAddCaseOption({
      name: name.trim(),
      argumentTags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setName("");
    setTags("");
  };

  return (
    <PanelShell
      title="Scout to Strategy"
      description="Which case to read against this opponent, in front of this judge."
      icon={<Compass className="h-4 w-4" />}
      className={className}
      data-testid="scout-to-strategy-panel"
      actions={<Pill tone={RISK_TONE[recommendation.riskLevel]}>{recommendation.riskLevel} risk</Pill>}
    >
      <StatGrid columns={3}>
        <StatTile
          label="Recommended"
          value={recommendation.recommendedCase?.name ?? "—"}
          tone="positive"
        />
        <StatTile label="Options" value={recommendation.caseRankings.length} />
        <StatTile
          label="Risk factors"
          value={recommendation.riskFactors.length}
          tone={recommendation.riskFactors.length > 0 ? "warning" : "positive"}
        />
      </StatGrid>

      <PanelSection title="Case rankings" description="Lower overlap with the opponent is better.">
        {recommendation.caseRankings.length === 0 ? (
          <EmptyState title="No case options" message="Add the cases the team could read." />
        ) : (
          <div className="flex flex-col gap-2">
            {recommendation.caseRankings.map((option, index) => (
              <PanelRow
                key={option.name}
                leading={`#${index + 1}`}
                title={option.name}
                subtitle={option.argumentTags.join(", ") || "no tags"}
                trailing={
                  <>
                    {index === 0 ? <Pill tone="positive">pick</Pill> : null}
                    <span className="font-semibold">{option.overlapScore.toFixed(2)}</span>
                  </>
                }
              >
                <MeterBar
                  value={option.overlapScore}
                  max={worstOverlap}
                  tone={index === 0 ? "positive" : "warning"}
                  caption="overlap with opponent strengths"
                />
              </PanelRow>
            ))}
          </div>
        )}
      </PanelSection>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <PanelSection title="Judge adaptations">
          {recommendation.judgeAdaptationNotes.length === 0 ? (
            <EmptyState title="No judge notes" message="Add a judge profile for adaptations." />
          ) : (
            <ul className="list-disc pl-4 text-xs">
              {recommendation.judgeAdaptationNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </PanelSection>

        <PanelSection title="Risk factors">
          {recommendation.riskFactors.length === 0 ? (
            <EmptyState title="No flagged risks" />
          ) : (
            <ul className="list-disc pl-4 text-xs">
              {recommendation.riskFactors.map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
            </ul>
          )}
        </PanelSection>
      </div>

      {onAddCaseOption ? (
        <PanelSection title="Add case option">
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <LabeledField label="Case name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </LabeledField>
            <LabeledField label="Argument tags (comma separated)">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </LabeledField>
            <Button size="sm" onClick={addOption} disabled={!name.trim()}>
              Add
            </Button>
          </div>
        </PanelSection>
      ) : null}

      <SummaryText
        label="Plain-text recommendation"
        text={buildStrategyRecommendationText(recommendation)}
      />
    </PanelShell>
  );
}
