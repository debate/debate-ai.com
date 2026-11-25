/**
 * @fileoverview Where the who-debated-whom pinned card shows matching round
 * videos. The video UI lives in `@debate-ai/videos`, which depends on this
 * package, so the chart cannot import it; the host hands the list in through
 * {@link HeadToHeadVideosProvider}, and a chart without one simply omits the
 * Videos lines.
 * @module leaderboard/network/HeadToHeadVideosSlot
 */

"use client"

import { createContext, useContext, type ComponentType, type ReactNode } from "react"
import type { VideoDebateStyle as DebateStyle } from "../../topics/debate-topics"

/** Props the host's head-to-head videos component receives. */
export interface HeadToHeadVideosProps {
  /** Phrases matched against a round's aff/neg team (or title when none). */
  competitors: readonly string[]
  /** Only rounds in these debate styles (the active rankings format). */
  styles: readonly DebateStyle[]
  /**
   * When set (a pairing card), keep only rounds where each group matches a
   * different side — so both teams appear, not just one.
   */
  requireGroups?: readonly (readonly string[])[]
}

const HeadToHeadVideosContext = createContext<ComponentType<HeadToHeadVideosProps> | null>(null)

/** Supplies the component that lists matching videos on a pinned card. */
export function HeadToHeadVideosProvider({
  component,
  children,
}: {
  component: ComponentType<HeadToHeadVideosProps>
  children: ReactNode
}) {
  return (
    <HeadToHeadVideosContext.Provider value={component}>{children}</HeadToHeadVideosContext.Provider>
  )
}

/** Renders the provided videos list, or nothing without a provider. */
export function HeadToHeadVideos(props: HeadToHeadVideosProps) {
  const Videos = useContext(HeadToHeadVideosContext)
  if (!Videos || props.competitors.length === 0) return null
  return <Videos {...props} />
}
