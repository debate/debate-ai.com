/**
 * @fileoverview Where a team or school profile shows its round videos. The
 * video grid lives in `@debate-ai/videos`, which depends on this package, so
 * the profile pages cannot import it; the host hands the grid in through
 * {@link ProfileVideosProvider} instead, and a profile rendered without one
 * simply has no Videos section.
 * @module leaderboard/profile/ProfileVideosSlot
 */

"use client"

import { createContext, useContext, type ComponentType, type ReactNode } from "react"
import type { ProfileVideoSearch } from "./rankingProfileHelpers"

/** Props the host's videos component receives. */
export interface ProfileVideosProps {
  /** Who to find rounds for; see `teamVideoSearch` and `schoolVideoSearch`. */
  search: ProfileVideoSearch
}

const ProfileVideosContext = createContext<ComponentType<ProfileVideosProps> | null>(null)

/** Supplies the component that renders a profile's Videos section. */
export function ProfileVideosProvider({
  component,
  children,
}: {
  component: ComponentType<ProfileVideosProps>
  children: ReactNode
}) {
  return <ProfileVideosContext.Provider value={component}>{children}</ProfileVideosContext.Provider>
}

/** Renders the provided videos component for `search`, or nothing without a provider. */
export function ProfileVideos({ search }: ProfileVideosProps) {
  const Videos = useContext(ProfileVideosContext)
  return Videos ? <Videos search={search} /> : null
}
