/**
 * @fileoverview Videos section of a team or school profile: the rounds the
 * team or school debated in, newest first. A round counts when its aff or neg
 * team names the school (or, for a round with no teams recorded, its title
 * does), limited to the divisions the profile is ranked in.
 * @module panels/leaderboard/profile/ProfileVideos
 */

"use client"

import { useCallback, useState } from "react"
import { X } from "lucide-react"
import { useVideoFeed } from "../../../hooks/useVideoFeed"
import { useVideoState } from "../../../hooks/useVideoState"
import { VideoGrid } from "../../../components/video-grid/VideoGrid"
import { Button } from "../../../ui/primitives/button"
import type { ProfileVideoSearch } from "./rankingProfileHelpers"

/** Props for {@link ProfileVideos}. */
interface ProfileVideosProps {
  /** Who to find rounds for; see `teamVideoSearch` and `schoolVideoSearch`. */
  search: ProfileVideoSearch
}

/**
 * Grid of the rounds `search` finds. Clicking a card's badge narrows the
 * results by that badge's text; the chip beside the heading clears it again.
 */
export function ProfileVideos({ search }: ProfileVideosProps) {
  const { state, actions } = useVideoState()
  const [refinement, setRefinement] = useState("")

  const feed = useVideoFeed({
    source: "round",
    competitors: search.competitors,
    styles: search.styles,
    q: refinement,
    sort: "Recency",
    enabled: search.competitors.length > 0,
  })
  const onBadgeClick = useCallback((text: string) => setRefinement(text), [])

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Videos</h2>
        <span className="text-sm text-muted-foreground">
          {feed.isLoading ? "Searching…" : `${feed.total} matching “${search.label}”`}
        </span>
        {refinement && (
          <Button variant="outline" size="sm" className="h-7" onClick={() => setRefinement("")}>
            {refinement}
            <X className="h-3 w-3" aria-label="Clear refinement" />
          </Button>
        )}
      </div>

      {feed.errorMessage ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{feed.errorMessage}</p>
      ) : !feed.isLoading && feed.videos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No videos found.</p>
      ) : (
        <VideoGrid
          videos={feed.videos}
          showThumbnails={state.showThumbnails}
          videoContainerRef={state.videoContainerRef}
          favorites={state.favorites}
          onToggleFavorite={actions.toggleFavorite}
          onBadgeClick={onBadgeClick}
          onHideVideo={actions.hideVideo}
          onUnhideVideo={actions.unhideVideo}
          hiddenVideos={state.hiddenVideos}
          stacksEnabled={false}
          showFullDate
        />
      )}

      {feed.hasMore && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" disabled={feed.isLoadingMore} onClick={() => feed.loadMore({ force: true })}>
            {feed.isLoadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </section>
  )
}
