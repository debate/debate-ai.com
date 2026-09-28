/**
 * @fileoverview Videos section of a team or school profile: every library
 * video (rounds and lectures) whose title, channel or description matches the
 * profile's search query, newest first.
 * @module panels/leaderboard/profile/ProfileVideos
 */

"use client"

import { useCallback, useState } from "react"
import { X } from "lucide-react"
import { useVideoFeed } from "../../../hooks/useVideoFeed"
import { useVideoState } from "../../../hooks/useVideoState"
import { VideoGrid } from "../../../components/video-grid/VideoGrid"
import { Button } from "../../../ui/primitives/button"

/** Props for {@link ProfileVideos}. */
interface ProfileVideosProps {
  /** Search run against the video library, e.g. a school or team name. */
  query: string
}

/**
 * Grid of videos matching `query`. Clicking a card's badge narrows the search
 * by that badge's text; the chip beside the heading clears it again.
 */
export function ProfileVideos({ query }: ProfileVideosProps) {
  const { state, actions } = useVideoState()
  const [refinement, setRefinement] = useState("")
  const q = refinement ? `${query} ${refinement}` : query

  const feed = useVideoFeed({ source: "all", q, sort: "Recency", enabled: Boolean(query) })
  const onBadgeClick = useCallback((text: string) => setRefinement(text), [])

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Videos</h2>
        <span className="text-sm text-muted-foreground">
          {feed.isLoading ? "Searching…" : `${feed.total} matching “${query}”`}
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
