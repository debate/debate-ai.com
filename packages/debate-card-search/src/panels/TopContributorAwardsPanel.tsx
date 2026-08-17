/**
 * @fileoverview Top contributor awards — UI over `lib/contributor-awards.ts`.
 *
 * Shows the per-category winner (best evidence finder, best explainer, ...)
 * with the runners-up behind each award and the announcement text the slice
 * generates for posting to a squad channel.
 */

"use client";

import { useMemo, useState } from "react";
import { Award } from "lucide-react";

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

import type { ContributionKind } from "../lib/community-rating";
import {
  DEFAULT_AWARD_CATEGORY_LABELS,
  buildAwardsAnnouncementText,
  buildCategoryLeaderboard,
  buildTopContributorAwards,
  groupContributionsByKind,
} from "../lib/contributor-awards";
import type { AttributedContribution } from "../lib/contribution-leaderboard";
import { listContributions } from "../state/contributions";

/** Props for {@link TopContributorAwardsPanel}. */
export interface TopContributorAwardsPanelProps {
  /** Contributions to award over. Defaults to the persisted contribution store. */
  contributions?: AttributedContribution[];
  /** Category display names, e.g. to localise the award titles. */
  categoryLabels?: Record<ContributionKind, string>;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Renders one card per award category with its winner and runners-up.
 *
 * @param props - See {@link TopContributorAwardsPanelProps}.
 * @returns The awards panel.
 */
export function TopContributorAwardsPanel({
  contributions,
  categoryLabels = DEFAULT_AWARD_CATEGORY_LABELS,
  className,
}: TopContributorAwardsPanelProps) {
  const { data: persisted } = useStoreSnapshot<AttributedContribution[]>(listContributions, []);
  const source = contributions ?? persisted;
  const [expanded, setExpanded] = useState<ContributionKind | null>(null);

  const awards = useMemo(
    () => buildTopContributorAwards(source, categoryLabels),
    [source, categoryLabels],
  );
  const byKind = useMemo(() => groupContributionsByKind(source), [source]);

  return (
    <PanelShell
      title="Top Contributor Awards"
      description="Per-category winners across the squad's contributions."
      icon={<Award className="h-4 w-4" />}
      className={className}
      data-testid="top-contributor-awards-panel"
    >
      <StatGrid columns={2}>
        <StatTile label="Awards" value={awards.length} tone="positive" />
        <StatTile label="Contributions counted" value={source.length} />
      </StatGrid>

      <PanelSection title="Winners">
        {awards.length === 0 ? (
          <EmptyState
            title="No awards yet"
            message="Awards appear once contributions have been recorded in each category."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {awards.map((award) => {
              const open = expanded === award.kind;
              const runnersUp = open
                ? buildCategoryLeaderboard(byKind.get(award.kind) ?? []).slice(1)
                : [];
              return (
                <PanelRow
                  key={award.kind}
                  leading="🏆"
                  title={
                    <button
                      type="button"
                      className="text-left"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : award.kind)}
                    >
                      {award.label}
                    </button>
                  }
                  subtitle={`${award.contributorId} · ${award.contributionCount} ${award.kind}${award.contributionCount === 1 ? "" : "s"}`}
                  trailing={<Pill tone="positive">{award.totalHelpfulnessScore.toFixed(2)}</Pill>}
                >
                  {open ? (
                    runnersUp.length === 0 ? (
                      <p className="text-muted-foreground text-xs">No runners-up in this category.</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {runnersUp.map((stats, index) => (
                          <li
                            key={stats.contributorId}
                            className="text-muted-foreground flex items-center justify-between gap-2 text-xs"
                          >
                            <span>
                              #{index + 2} {stats.contributorId}
                            </span>
                            <span className="tabular-nums">
                              {stats.totalHelpfulnessScore.toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </PanelRow>
              );
            })}
          </div>
        )}
      </PanelSection>

      {awards.length > 0 ? (
        <SummaryText label="Announcement" text={buildAwardsAnnouncementText(awards)} />
      ) : null}
      {awards.length > 0 ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(buildAwardsAnnouncementText(awards));
            }}
          >
            Copy announcement
          </Button>
        </div>
      ) : null}
    </PanelShell>
  );
}
