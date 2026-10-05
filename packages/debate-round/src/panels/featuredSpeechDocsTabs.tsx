/**
 * @fileoverview The watch-page tab that shows a featured round's speech docs
 * beside its video. Not a client module itself, so the app's server-rendered
 * watch route can call it; the panel it mounts is the client part.
 *
 * @module panels/featuredSpeechDocsTabs
 */

import type { WatchSideTab } from "@debate/videos"
import { featuredRoundForVideo } from "../round/featured-rounds"
import { FeaturedSpeechDocsPanel } from "./FeaturedSpeechDocsPanel"

/**
 * The extra side-panel tabs for `videoId`: one "Speech docs" tab when the
 * video is a featured round's, none otherwise.
 */
export function featuredSpeechDocsTabs(videoId: string | null | undefined): WatchSideTab[] {
  const featured = featuredRoundForVideo(videoId)
  if (!featured) return []
  return [
    {
      id: `speech-docs:${featured.key}`,
      label: "Speech docs",
      hint: `${featured.speechDocs.length} speeches`,
      content: <FeaturedSpeechDocsPanel featuredKey={featured.key} />,
    },
  ]
}
