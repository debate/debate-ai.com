/**
 * @fileoverview A row of links under the Greatest of All-Time banner to the
 * all-time (GOAT) rankings of each of the four event tabs: College Policy, HS
 * Policy, Forum and Individual. Each goes to the rankings page's "All time"
 * season (`/rank/<format>?season=all-time`) and is labelled as that page's
 * event tab is. The links wrap onto a second line on narrow screens, with
 * touch-sized targets.
 *
 * @module components/category-gallery/GoatRankingsLinks
 */

import React from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { ALL_TIME_SEASON } from "@debate-ai/rankings/src/leaderboard/AllTimeRankingsView";
import { LEADERBOARD_TABS } from "@debate-ai/rankings/src/leaderboard/leaderboardUtils";
import { rankingsHref } from "@debate-ai/rankings/src/leaderboard/rankingsUrl";

/** The all-time rankings address for one rankings format (`VCX`, `NDT`, …). */
export function goatRankingsHref(format: string): string {
  return rankingsHref(format, new URLSearchParams({ season: ALL_TIME_SEASON }));
}

export function GoatRankingsLinks() {
  return (
    <nav
      aria-label="Greatest of all time rankings"
      className="mb-6 flex flex-wrap items-center justify-center gap-2 text-sm"
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
        <Crown className="h-4 w-4 text-amber-500" aria-hidden />
        GOAT rankings:
      </span>
      {LEADERBOARD_TABS.map((tab) => (
        <Link
          key={tab.value}
          href={goatRankingsHref(tab.value)}
          className="inline-flex min-h-9 items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:border-amber-500/60 hover:bg-amber-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
