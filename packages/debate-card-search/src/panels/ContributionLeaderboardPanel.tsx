/**
 * @fileoverview Contribution leaderboard — UI over `lib/contribution-leaderboard.ts`
 * reading the persisted contributions in `state/contributions.ts`.
 */

"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";

import {
  EmptyState,
  MeterBar,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";

import {
  buildLeaderboard,
  type AttributedContribution,
  type ContributorStats,
} from "../lib/contribution-leaderboard";
import type { HelpfulnessWeights } from "../lib/community-rating";
import { listContributions } from "../state/contributions";

type SortKey = "total" | "average" | "count";

const SORT_LABEL: Record<SortKey, string> = {
  total: "Total score",
  average: "Average score",
  count: "Contributions",
};

/** Props for {@link ContributionLeaderboardPanel}. */
export interface ContributionLeaderboardPanelProps {
  /** Contributions to rank. Defaults to the persisted contribution store. */
  contributions?: AttributedContribution[];
  /** Scoring weights passed through to the leaderboard slice. */
  weights?: HelpfulnessWeights;
  /** Highlights one contributor's row, e.g. the signed-in user. */
  highlightContributorId?: string;
  /** Invoked when a contributor row is clicked. */
  onSelectContributor?: (contributorId: string) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Ranks contributors by helpfulness-weighted contribution score.
 *
 * @param props - See {@link ContributionLeaderboardPanelProps}.
 * @returns The leaderboard panel.
 */
export function ContributionLeaderboardPanel({
  contributions,
  weights,
  highlightContributorId,
  onSelectContributor,
  className,
}: ContributionLeaderboardPanelProps) {
  const { data: persisted } = useStoreSnapshot<AttributedContribution[]>(listContributions, []);
  const source = contributions ?? persisted;
  const [sortKey, setSortKey] = useState<SortKey>("total");

  const leaderboard = useMemo(
    () => buildLeaderboard(source, weights),
    [source, weights],
  );

  const sorted = useMemo(() => {
    const rows = [...leaderboard];
    if (sortKey === "average") {
      rows.sort(
        (a, b) =>
          b.averageHelpfulnessScore - a.averageHelpfulnessScore ||
          a.contributorId.localeCompare(b.contributorId),
      );
    } else if (sortKey === "count") {
      rows.sort(
        (a, b) =>
          b.contributionCount - a.contributionCount ||
          a.contributorId.localeCompare(b.contributorId),
      );
    }
    return rows;
  }, [leaderboard, sortKey]);

  const topScore = sorted.length > 0 ? Math.max(...sorted.map((r) => r.totalHelpfulnessScore)) : 0;
  const outlierCount = leaderboard.reduce((sum, row) => sum + row.popularityOnlyOutlierCount, 0);

  return (
    <PanelShell
      title="Contribution Leaderboard"
      description="Contributors ranked by helpfulness-weighted contributions."
      icon={<Trophy className="h-4 w-4" />}
      className={className}
      data-testid="contribution-leaderboard-panel"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setSortKey((key) => (key === "total" ? "average" : key === "average" ? "count" : "total"))
          }
        >
          Sort: {SORT_LABEL[sortKey]}
        </Button>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Contributors" value={leaderboard.length} />
        <StatTile label="Contributions" value={source.length} />
        <StatTile
          label="Popularity-only flags"
          value={outlierCount}
          tone={outlierCount > 0 ? "warning" : "neutral"}
          hint="Liked a lot, rated little"
        />
      </StatGrid>

      <PanelSection title="Standings">
        {sorted.length === 0 ? (
          <EmptyState
            title="No contributions yet"
            message="Contributions recorded by the squad show up here automatically."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((row, index) => (
              <LeaderboardRow
                key={row.contributorId}
                rank={index + 1}
                stats={row}
                topScore={topScore}
                highlighted={row.contributorId === highlightContributorId}
                onSelect={onSelectContributor}
              />
            ))}
          </div>
        )}
      </PanelSection>
    </PanelShell>
  );
}

function LeaderboardRow({
  rank,
  stats,
  topScore,
  highlighted,
  onSelect,
}: {
  rank: number;
  stats: ContributorStats;
  topScore: number;
  highlighted: boolean;
  onSelect?: (contributorId: string) => void;
}) {
  return (
    <PanelRow
      className={highlighted ? "border-primary" : undefined}
      leading={`#${rank}`}
      title={
        onSelect ? (
          <button type="button" className="text-left" onClick={() => onSelect(stats.contributorId)}>
            {stats.contributorId}
          </button>
        ) : (
          stats.contributorId
        )
      }
      subtitle={`${stats.contributionCount} contribution${stats.contributionCount === 1 ? "" : "s"} · best ${stats.bestHelpfulnessScore.toFixed(2)}`}
      trailing={
        <>
          {stats.popularityOnlyOutlierCount > 0 ? (
            <Pill tone="warning">{stats.popularityOnlyOutlierCount} flagged</Pill>
          ) : null}
          <span className="font-semibold">{stats.totalHelpfulnessScore.toFixed(2)}</span>
        </>
      }
    >
      <MeterBar
        value={stats.totalHelpfulnessScore}
        max={topScore}
        tone={rank === 1 ? "positive" : "info"}
        caption={`avg ${stats.averageHelpfulnessScore.toFixed(2)}`}
      />
    </PanelRow>
  );
}
