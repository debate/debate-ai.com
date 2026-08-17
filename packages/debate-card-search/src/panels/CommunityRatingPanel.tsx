/**
 * @fileoverview Community-rated summaries and highlights — UI over
 * `lib/community-rating.ts`.
 *
 * Ranks contributions by helpfulness and breaks each score into its
 * popularity / quality / reviewer parts so a contribution that is merely
 * popular is visibly distinguishable from one reviewers vouch for.
 */

"use client";

import { useMemo, useState } from "react";
import { Sparkles, ThumbsUp } from "lucide-react";

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
  DEFAULT_HELPFULNESS_WEIGHTS,
  rankContributions,
  type CommunityContribution,
  type ContributionKind,
  type HelpfulnessWeights,
} from "../lib/community-rating";
import type { AttributedContribution } from "../lib/contribution-leaderboard";
import { listContributions, saveContribution } from "../state/contributions";

const KINDS: (ContributionKind | "all")[] = ["all", "summary", "highlight", "annotation", "card"];

/** Props for {@link CommunityRatingPanel}. */
export interface CommunityRatingPanelProps {
  /** Contributions to rank. Defaults to the persisted contribution store. */
  contributions?: AttributedContribution[];
  /** Scoring weights. */
  weights?: HelpfulnessWeights;
  /** Optional label lookup so rows can show titles instead of raw ids. */
  titleFor?: (contribution: CommunityContribution) => string;
  /**
   * Allows the panel to record a like against the persisted store. Disabled
   * when the caller passes its own `contributions` list.
   */
  allowVoting?: boolean;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Ranks community contributions by helpfulness with a score breakdown.
 *
 * @param props - See {@link CommunityRatingPanelProps}.
 * @returns The community rating panel.
 */
export function CommunityRatingPanel({
  contributions,
  weights = DEFAULT_HELPFULNESS_WEIGHTS,
  titleFor,
  allowVoting = true,
  className,
}: CommunityRatingPanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<AttributedContribution[]>(
    listContributions,
    [],
  );
  const source = contributions ?? persisted;
  const votable = contributions === undefined && allowVoting;
  const [kind, setKind] = useState<ContributionKind | "all">("all");

  const filtered = useMemo(
    () => (kind === "all" ? source : source.filter((c) => c.kind === kind)),
    [source, kind],
  );
  const ranked = useMemo(() => rankContributions(filtered, weights), [filtered, weights]);
  const byId = useMemo(() => new Map(filtered.map((c) => [c.id, c])), [filtered]);
  const outliers = ranked.filter((row) => row.isPopularityOnlyOutlier).length;

  const like = (contribution: AttributedContribution) => {
    saveContribution({ ...contribution, likes: contribution.likes + 1 });
    refresh();
  };

  return (
    <PanelShell
      title="Community Ratings"
      description="Summaries and highlights ranked by community helpfulness."
      icon={<Sparkles className="h-4 w-4" />}
      className={className}
      data-testid="community-rating-panel"
      actions={
        <div className="flex flex-wrap gap-1">
          {KINDS.map((option) => (
            <button key={option} type="button" onClick={() => setKind(option)}>
              <Pill tone={kind === option ? "info" : "neutral"}>{option}</Pill>
            </button>
          ))}
        </div>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Rated" value={ranked.length} />
        <StatTile
          label="Top helpfulness"
          value={ranked.length > 0 ? ranked[0].helpfulnessScore.toFixed(2) : "—"}
          tone="positive"
        />
        <StatTile
          label="Popularity-only"
          value={outliers}
          tone={outliers > 0 ? "warning" : "neutral"}
        />
      </StatGrid>

      <PanelSection
        title="Ranked contributions"
        description={`Weights — popularity ${weights.popularity}, quality ${weights.quality}, reviewer ${weights.reviewer}.`}
      >
        {ranked.length === 0 ? (
          <EmptyState
            title="Nothing rated yet"
            message="Likes, saves and reviewer endorsements feed this ranking."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {ranked.map((row, index) => {
              const contribution = byId.get(row.contributionId);
              return (
                <PanelRow
                  key={row.contributionId}
                  leading={`#${index + 1}`}
                  title={
                    contribution && titleFor ? titleFor(contribution) : row.contributionId
                  }
                  subtitle={
                    contribution
                      ? `${contribution.kind} · ${contribution.likes} likes · ${contribution.saves} saves`
                      : undefined
                  }
                  trailing={
                    <>
                      {row.isPopularityOnlyOutlier ? (
                        <Pill tone="warning">popularity only</Pill>
                      ) : null}
                      <span className="font-semibold">{row.helpfulnessScore.toFixed(2)}</span>
                      {votable && contribution ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Like ${row.contributionId}`}
                          onClick={() => like(contribution)}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </>
                  }
                >
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                    <MeterBar
                      value={row.popularityScore}
                      max={1}
                      tone="info"
                      label="Popularity"
                      caption={row.popularityScore.toFixed(2)}
                    />
                    <MeterBar
                      value={row.qualityScore}
                      max={1}
                      tone="positive"
                      label="Quality"
                      caption={row.qualityScore.toFixed(2)}
                    />
                    <MeterBar
                      value={row.reviewerScore}
                      max={1}
                      tone="warning"
                      label="Reviewer"
                      caption={row.reviewerScore.toFixed(2)}
                    />
                  </div>
                </PanelRow>
              );
            })}
          </div>
        )}
      </PanelSection>
    </PanelShell>
  );
}
