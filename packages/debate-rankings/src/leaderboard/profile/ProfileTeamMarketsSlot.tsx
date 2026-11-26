/**
 * @fileoverview Where a team profile shows related prediction markets. The
 * markets UI lives in `@debate-ai/predictions`, which depends on this package
 * for ranking presets, so the profile pages cannot import it; the host hands
 * the section in through {@link ProfileTeamMarketsProvider} instead, and a
 * profile rendered without one simply has no Prediction markets section.
 * @module leaderboard/profile/ProfileTeamMarketsSlot
 */

"use client"

import { createContext, useContext, type ComponentType, type ReactNode } from "react"

/** Props the host's related-markets component receives. */
export interface ProfileTeamMarketsProps {
  /** Stable entry hashes for this team across the divisions it appears in. */
  hashes: readonly string[]
  /** Optional team label for empty/loading copy. */
  teamName?: string
}

const ProfileTeamMarketsContext = createContext<ComponentType<ProfileTeamMarketsProps> | null>(null)

/** Supplies the component that renders a team's Prediction markets section. */
export function ProfileTeamMarketsProvider({
  component,
  children,
}: {
  component: ComponentType<ProfileTeamMarketsProps>
  children: ReactNode
}) {
  return (
    <ProfileTeamMarketsContext.Provider value={component}>{children}</ProfileTeamMarketsContext.Provider>
  )
}

/** Renders the provided markets component for `hashes`, or nothing without a provider. */
export function ProfileTeamMarkets({ hashes, teamName }: ProfileTeamMarketsProps) {
  const Markets = useContext(ProfileTeamMarketsContext)
  return Markets ? <Markets hashes={hashes} teamName={teamName} /> : null
}
