/**
 * @fileoverview Contributor profile drill-down panel — the "Contribution
 * Leaderboard" bullet's next-named follow-up in TODO.md's Research
 * Crowdsourcing Organizer Features section ("a per-contributor profile
 * drill-down page"). Renders one contributor's cross-feature standing —
 * leaderboard rank, stats, tier/badges, streak, Top Contributor Awards (live
 * standings plus all-time hall-of-fame wins), and endorsement history —
 * composed by `lib/contributor-profile.ts`'s `buildContributorProfileFromStore`
 * rather than introducing any new scoring/ranking logic here.
 *
 * `ContributionLeaderboardPanel`'s Contributor cell links each row to
 * `/cards/leaderboard/{contributorId}`, this panel's intended app route.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isContributionLeaderboardLiveUpdateStorageEvent`, mirroring
 * `ContributionLeaderboardPanel`'s own cross-tab live-update behavior, so a
 * contribution, completed task, award announcement, or streak update logged
 * in another tab refreshes this profile without a manual reload.
 *
 * @module panels/ContributorProfilePanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import { EmptyState, PanelSection, PanelShell, StatGrid, StatTile } from "debate-research-evidence/src/ui/panels/panel-shell"
import { isOwnContributorRow } from "debate-research-evidence/src/lib/session-identity"
import { isContributionLeaderboardLiveUpdateStorageEvent } from "debate-research-evidence/src/state/live-update"
import type { ContributorEndorsementHistoryEntry } from "debate-research-evidence/src/state/contributions"
import { buildContributorProfileFromStore, type ContributorProfile } from "../lib/contributor-profile"
import { TIER_VARIANT } from "./ContributionLeaderboardPanel"

/** Today's UTC calendar day as `YYYY-MM-DD`, the `dayKey` format used throughout `gamified-quests.ts`. */
function todayUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface ContributorProfilePanelProps {
  contributorId: string
  /**
   * A contributor id to compare against `contributorId`, typically derived
   * from a real signed-in session via `deriveContributorIdFromSessionIdentity`.
   * Shows a "You" badge when the two match.
   */
  signedInContributorId?: string
}

function EndorsementList({
  entries,
  emptyText,
  renderEntry,
}: {
  entries: ContributorEndorsementHistoryEntry[]
  emptyText: string
  renderEntry: (entry: ContributorEndorsementHistoryEntry) => string
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <ul className="space-y-1 text-sm">
      {entries.map((entry, index) => (
        <li
          key={`${entry.contributionId}-${entry.reviewerId}-${entry.endorsedAt}-${index}`}
          className="text-muted-foreground"
        >
          {renderEntry(entry)}
        </li>
      ))}
    </ul>
  )
}

/**
 * Renders `contributorId`'s full cross-feature profile: leaderboard rank,
 * stats, tier/badges, streak, Top Contributor Awards, and endorsement
 * history received and given.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function ContributorProfilePanel({ contributorId, signedInContributorId }: ContributorProfilePanelProps) {
  const [profile, setProfile] = useState<ContributorProfile | null>(null)

  useEffect(() => {
    setProfile(buildContributorProfileFromStore(contributorId, todayUtcDayKey()))
  }, [contributorId])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isContributionLeaderboardLiveUpdateStorageEvent(event)) return
      setProfile(buildContributorProfileFromStore(contributorId, todayUtcDayKey()))
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [contributorId])

  if (profile === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading profile…</div>
  }

  const isMe = isOwnContributorRow(profile.contributorId, signedInContributorId)

  if (!profile.exists) {
    return (
      <PanelShell title={profile.contributorId}>
        <EmptyState title="No activity yet for this contributor." />
      </PanelShell>
    )
  }

  const { unlockStatus } = profile
  const hallOfFameBreakdown = profile.hallOfFame
    ? Object.entries(profile.hallOfFame.winsByKind)
        .map(([kind, count]) => `${kind}: ${count}`)
        .join(", ")
    : ""

  return (
    <PanelShell
      title={profile.contributorId}
      description={profile.rank !== null ? `Ranked #${profile.rank} on the leaderboard` : "Not yet ranked on the leaderboard"}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {isMe && <Badge variant="outline">You</Badge>}
          <Badge variant={TIER_VARIANT[unlockStatus.tier] ?? "outline"} className="capitalize">
            {unlockStatus.tier}
          </Badge>
        </div>
      }
    >
      <StatGrid>
        <StatTile label="Contributions" value={profile.stats.contributionCount} />
        <StatTile label="Total score" value={profile.stats.totalHelpfulnessScore} />
        <StatTile label="Avg score" value={profile.stats.averageHelpfulnessScore} />
        <StatTile label="Completed tasks" value={profile.stats.completedTaskCount} />
        <StatTile
          label="Current streak"
          value={unlockStatus.streak.currentStreak > 0 ? `🔥 ${unlockStatus.streak.currentStreak}` : "—"}
        />
        <StatTile label="Longest streak" value={unlockStatus.streak.longestStreak} />
      </StatGrid>

      <PanelSection title="Badges">
        {unlockStatus.badges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {unlockStatus.badges.map((badge) => (
              <Badge key={badge} variant="outline" className="whitespace-nowrap">
                {badge}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No badges earned yet.</p>
        )}
      </PanelSection>

      <PanelSection title="Top Contributor Awards">
        {profile.currentAwards.length > 0 && (
          <p className="mb-2 text-sm text-muted-foreground">
            Currently leading: {profile.currentAwards.map((award) => award.label).join(", ")}
          </p>
        )}
        {profile.hallOfFame ? (
          <p className="text-sm text-muted-foreground">
            {profile.hallOfFame.totalWins} all-time win{profile.hallOfFame.totalWins === 1 ? "" : "s"} (
            {hallOfFameBreakdown})
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No award wins yet.</p>
        )}
      </PanelSection>

      <PanelSection title="Endorsements received">
        <EndorsementList
          entries={profile.endorsementsReceived}
          emptyText="No endorsements received yet."
          renderEntry={(entry) =>
            `${entry.reviewerId} endorsed a ${entry.contributionKind} (weight ${entry.reviewerWeight.toFixed(2)}) · ${new Date(entry.endorsedAt).toLocaleDateString()}`
          }
        />
      </PanelSection>

      <PanelSection title="Endorsements given">
        <EndorsementList
          entries={profile.endorsementsGiven}
          emptyText="No endorsements given yet."
          renderEntry={(entry) =>
            `Endorsed ${entry.contributionContributorId}'s ${entry.contributionKind} (weight ${entry.reviewerWeight.toFixed(2)}) · ${new Date(entry.endorsedAt).toLocaleDateString()}`
          }
        />
      </PanelSection>
    </PanelShell>
  )
}
