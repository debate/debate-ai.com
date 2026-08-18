/**
 * @fileoverview Top Contributor Awards panel — the UI follow-up named as
 * "(c) an awards UI in `debate-card-search` that renders
 * `buildAwardsAnnouncementText`" under the "🏆 Top Contributor Awards" bullet
 * in TODO.md's Research Crowdsourcing Organizer Features list.
 *
 * Reads every persisted contribution via `state/contributions.ts`'s
 * `buildTopContributorAwardsFromStore` (itself a thin composition of
 * `contributor-awards.ts`'s pure `buildTopContributorAwards` against the
 * persisted store) and renders one card per category winner — reusing the
 * existing per-category selection/scoring directly rather than introducing
 * new logic here.
 *
 * @module panels/ContributorAwardsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Award } from "lucide-react"
import { Badge } from "debate-ui/src/primitives/badge"
import { buildTopContributorAwardsFromStore } from "../state/contributions"
import type { ContributorAward } from "../lib/contributor-awards"

/**
 * Renders the Top Contributor Awards: one category winner per
 * `ContributionKind` present among persisted contributions, ranked by total
 * helpfulness score within that category.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function ContributorAwardsPanel() {
  const [awards, setAwards] = useState<ContributorAward[] | null>(null)

  useEffect(() => {
    setAwards(buildTopContributorAwardsFromStore())
  }, [])

  if (awards === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading awards…</div>
  }

  if (awards.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No awards yet. Categories fill in as contributors submit cards, summaries, highlights, and
        annotations.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Top Contributor Awards</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Current category winners, ranked by total helpfulness score within each contribution kind.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {awards.map((award) => (
          <div
            key={award.kind}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
          >
            <Award className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{award.label}</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="truncate">
                  {award.contributorId}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {award.contributionCount} contribution{award.contributionCount === 1 ? "" : "s"} ·{" "}
                {award.totalHelpfulnessScore} pts
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
