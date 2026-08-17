/**
 * @fileoverview Daily best card challenge — UI over `lib/daily-best-card.ts`.
 *
 * Highlights today's winning card and lists the previous days' winners.
 */

"use client";

import { useMemo } from "react";
import { Crown } from "lucide-react";

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
} from "debate-ui/src/panels/panel-shell";

import {
  buildDailyBestCardHighlight,
  buildDailyBestCards,
  getBestCardForDay,
  getUtcDayKey,
  type TimestampedCardContribution,
} from "../lib/daily-best-card";
import {
  DEFAULT_HELPFULNESS_WEIGHTS,
  type HelpfulnessWeights,
} from "../lib/community-rating";

/** Props for {@link DailyBestCardPanel}. */
export interface DailyBestCardPanelProps {
  /** Card contributions with submission timestamps. */
  contributions: TimestampedCardContribution[];
  /** "Now" in epoch ms; picks which UTC day counts as today. */
  now?: number;
  /** Scoring weights. */
  weights?: HelpfulnessWeights;
  /** How many past days to list under today's winner. */
  historyLimit?: number;
  /** Optional label lookup so rows can show a card title instead of its id. */
  titleFor?: (contribution: TimestampedCardContribution) => string;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Shows the winner of today's best-card challenge plus recent winners.
 *
 * @param props - See {@link DailyBestCardPanelProps}.
 * @returns The daily best card panel.
 */
export function DailyBestCardPanel({
  contributions,
  now = Date.now(),
  weights = DEFAULT_HELPFULNESS_WEIGHTS,
  historyLimit = 7,
  titleFor,
  className,
}: DailyBestCardPanelProps) {
  const today = useMemo(
    () => getBestCardForDay(contributions, now, weights),
    [contributions, now, weights],
  );
  const history = useMemo(
    () =>
      buildDailyBestCards(contributions, weights)
        .filter((entry) => entry.dayKey !== getUtcDayKey(now))
        .slice(0, historyLimit),
    [contributions, weights, now, historyLimit],
  );

  const todaysEntries = useMemo(
    () => contributions.filter((c) => getUtcDayKey(c.submittedAt) === getUtcDayKey(now)).length,
    [contributions, now],
  );

  return (
    <PanelShell
      title="Daily Best Card"
      description="The highest-rated card submitted today."
      icon={<Crown className="h-4 w-4" />}
      className={className}
      data-testid="daily-best-card-panel"
      actions={<Pill tone="info">{getUtcDayKey(now)}</Pill>}
    >
      <StatGrid columns={3}>
        <StatTile label="Entries today" value={todaysEntries} />
        <StatTile
          label="Winning score"
          value={today ? today.breakdown.helpfulnessScore.toFixed(2) : "—"}
          tone="positive"
        />
        <StatTile label="Past winners" value={history.length} />
      </StatGrid>

      {today ? (
        <PanelSection title="Today's winner">
          <PanelRow
            leading="👑"
            title={titleFor ? titleFor(today.contribution) : today.contribution.id}
            subtitle={`${today.contribution.likes} likes · ${today.contribution.saves} saves`}
            trailing={<Pill tone="positive">{today.breakdown.helpfulnessScore.toFixed(2)}</Pill>}
          >
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
              <MeterBar
                value={today.breakdown.popularityScore}
                max={1}
                tone="info"
                label="Popularity"
                caption={today.breakdown.popularityScore.toFixed(2)}
              />
              <MeterBar
                value={today.breakdown.qualityScore}
                max={1}
                tone="positive"
                label="Quality"
                caption={today.breakdown.qualityScore.toFixed(2)}
              />
              <MeterBar
                value={today.breakdown.reviewerScore}
                max={1}
                tone="warning"
                label="Reviewer"
                caption={today.breakdown.reviewerScore.toFixed(2)}
              />
            </div>
          </PanelRow>
          <SummaryText text={buildDailyBestCardHighlight(today)} />
        </PanelSection>
      ) : (
        <EmptyState
          title="No cards submitted today"
          message="The first card submitted today takes the lead."
        />
      )}

      {history.length > 0 ? (
        <PanelSection title="Previous winners">
          <div className="flex flex-col gap-2">
            {history.map((entry) => (
              <PanelRow
                key={entry.dayKey}
                leading={entry.dayKey}
                title={titleFor ? titleFor(entry.contribution) : entry.contribution.id}
                trailing={<Pill>{entry.breakdown.helpfulnessScore.toFixed(2)}</Pill>}
              />
            ))}
          </div>
        </PanelSection>
      ) : null}
    </PanelShell>
  );
}
