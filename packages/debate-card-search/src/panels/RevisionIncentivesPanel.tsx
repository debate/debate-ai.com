/**
 * @fileoverview Revision incentives — UI over `lib/revision-incentives.ts`
 * reading the persisted revision history in `state/revisionHistory.ts`.
 *
 * Shows the reward leaderboard, the reward each recorded revision earned, and
 * lets a before/after edit be recorded so the history has a way in from the UI.
 */

"use client";

import { useMemo, useState } from "react";
import { Sparkle } from "lucide-react";

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
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import { Input } from "debate-ui/src/primitives/input";

import {
  DEFAULT_REVISION_REWARD_WEIGHTS,
  buildRevisionIncentiveLeaderboard,
  buildRevisionRewardText,
  evaluateRevision,
  type CardRevision,
  type RevisionRewardWeights,
} from "../lib/revision-incentives";
import {
  deleteRevisionRecord,
  listRevisionHistory,
  saveRevisionRecord,
  type CardRevisionRecord,
} from "../state/revisionHistory";

const EMPTY_DRAFT = {
  cardId: "",
  contributorId: "",
  qualityBefore: "0.4",
  qualityAfter: "0.8",
  citationBefore: "0.5",
  citationAfter: "1",
  yearBefore: "2015",
  yearAfter: "2024",
  wordsBefore: "120",
  wordsAfter: "180",
};

/** Props for {@link RevisionIncentivesPanel}. */
export interface RevisionIncentivesPanelProps {
  /** Revisions to score. Defaults to the persisted revision history. */
  revisions?: CardRevision[];
  /** Reward weights. */
  weights?: RevisionRewardWeights;
  /** Hides the record-a-revision form. */
  readOnly?: boolean;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Revision reward leaderboard and per-revision reward breakdown.
 *
 * @param props - See {@link RevisionIncentivesPanelProps}.
 * @returns The revision incentives panel.
 */
export function RevisionIncentivesPanel({
  revisions,
  weights = DEFAULT_REVISION_REWARD_WEIGHTS,
  readOnly = false,
  className,
}: RevisionIncentivesPanelProps) {
  const { data: history, refresh } = useStoreSnapshot<CardRevisionRecord[]>(
    listRevisionHistory,
    [],
  );
  const source: CardRevision[] = revisions ?? history;
  const editable = revisions === undefined && !readOnly;
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const leaderboard = useMemo(
    () => buildRevisionIncentiveLeaderboard(source, weights),
    [source, weights],
  );
  const evaluations = useMemo(
    () => source.map((revision) => evaluateRevision(revision, weights)),
    [source, weights],
  );

  const totalPoints = leaderboard.reduce((sum, row) => sum + row.totalRewardPoints, 0);
  const rewarded = evaluations.filter((evaluation) => evaluation.isRewardedImprovement).length;
  const topPoints = leaderboard.length > 0 ? leaderboard[0].totalRewardPoints : 0;

  const recordRevision = () => {
    const number = (value: string, fallback: number) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    if (!draft.cardId.trim() || !draft.contributorId.trim()) return;
    saveRevisionRecord({
      id: `revision-${Date.now()}`,
      revisedAt: new Date().toISOString(),
      cardId: draft.cardId.trim(),
      contributorId: draft.contributorId.trim(),
      before: {
        qualitySignals: [number(draft.qualityBefore, 0)],
        citationCompleteness: number(draft.citationBefore, 0),
        evidenceYear: number(draft.yearBefore, 2000),
        wordCount: number(draft.wordsBefore, 0),
      },
      after: {
        qualitySignals: [number(draft.qualityAfter, 0)],
        citationCompleteness: number(draft.citationAfter, 0),
        evidenceYear: number(draft.yearAfter, 2000),
        wordCount: number(draft.wordsAfter, 0),
      },
    });
    setDraft({ ...EMPTY_DRAFT });
    refresh();
  };

  return (
    <PanelShell
      title="Revision Incentives"
      description="Reward points earned for improving existing cards."
      icon={<Sparkle className="h-4 w-4" />}
      className={className}
      data-testid="revision-incentives-panel"
    >
      <StatGrid columns={3}>
        <StatTile label="Revisions" value={source.length} />
        <StatTile label="Rewarded" value={rewarded} tone="positive" />
        <StatTile label="Total points" value={totalPoints.toFixed(1)} tone="info" />
      </StatGrid>

      <PanelSection title="Reward leaderboard">
        {leaderboard.length === 0 ? (
          <EmptyState
            title="No revisions recorded"
            message="Card edits recorded through the revision history show up here."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {leaderboard.map((stats, index) => (
              <PanelRow
                key={stats.contributorId}
                leading={`#${index + 1}`}
                title={stats.contributorId}
                subtitle={`${stats.rewardedRevisionCount}/${stats.revisionCount} rewarded · ${stats.weakCardsImprovedCount} weak cards fixed`}
                trailing={<Pill tone="positive">{stats.totalRewardPoints.toFixed(1)} pts</Pill>}
              >
                <MeterBar
                  value={stats.totalRewardPoints}
                  max={topPoints}
                  tone={index === 0 ? "positive" : "info"}
                />
              </PanelRow>
            ))}
          </div>
        )}
      </PanelSection>

      {evaluations.length > 0 ? (
        <PanelSection title="Recent revisions">
          <div className="flex flex-col gap-2">
            {evaluations
              .slice(-5)
              .reverse()
              .map((evaluation, index) => {
                const record = revisions ? undefined : history[history.length - 1 - index];
                return (
                  <PanelRow
                    key={record?.id ?? `${evaluation.cardId}-${index}`}
                    title={evaluation.cardId}
                    subtitle={`${evaluation.contributorId}${record ? ` · ${record.revisedAt.slice(0, 10)}` : ""}`}
                    trailing={
                      <>
                        {evaluation.wasWeakCard ? <Pill tone="warning">weak card</Pill> : null}
                        {evaluation.citationStrengthened ? <Pill tone="info">cite</Pill> : null}
                        {evaluation.evidenceRefreshed ? <Pill tone="info">refreshed</Pill> : null}
                        <span className="font-semibold">
                          {evaluation.rewardPoints.toFixed(1)} pts
                        </span>
                        {editable && record ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              deleteRevisionRecord(record.id);
                              refresh();
                            }}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </>
                    }
                  >
                    <SummaryText text={buildRevisionRewardText(evaluation)} />
                  </PanelRow>
                );
              })}
          </div>
        </PanelSection>
      ) : null}

      {editable ? (
        <PanelSection
          title="Record a revision"
          description="Captures a before/after snapshot in the revision history."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <LabeledField label="Card id">
              <Input value={draft.cardId} onChange={(e) => setDraft({ ...draft, cardId: e.target.value })} />
            </LabeledField>
            <LabeledField label="Contributor">
              <Input
                value={draft.contributorId}
                onChange={(e) => setDraft({ ...draft, contributorId: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Quality before">
              <Input
                value={draft.qualityBefore}
                onChange={(e) => setDraft({ ...draft, qualityBefore: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Quality after">
              <Input
                value={draft.qualityAfter}
                onChange={(e) => setDraft({ ...draft, qualityAfter: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Cite before">
              <Input
                value={draft.citationBefore}
                onChange={(e) => setDraft({ ...draft, citationBefore: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Cite after">
              <Input
                value={draft.citationAfter}
                onChange={(e) => setDraft({ ...draft, citationAfter: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Year before">
              <Input
                value={draft.yearBefore}
                onChange={(e) => setDraft({ ...draft, yearBefore: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Year after">
              <Input
                value={draft.yearAfter}
                onChange={(e) => setDraft({ ...draft, yearAfter: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Words before">
              <Input
                value={draft.wordsBefore}
                onChange={(e) => setDraft({ ...draft, wordsBefore: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Words after">
              <Input
                value={draft.wordsAfter}
                onChange={(e) => setDraft({ ...draft, wordsAfter: e.target.value })}
              />
            </LabeledField>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={recordRevision}
              disabled={!draft.cardId.trim() || !draft.contributorId.trim()}
            >
              Record revision
            </Button>
          </div>
        </PanelSection>
      ) : null}
    </PanelShell>
  );
}
