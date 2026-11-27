"use client"

import { lazy, Suspense } from "react"
import { usePathname } from "next/navigation"
import { isVideoRoundPath } from "@debate-ai/videos/src/lib/video-topic-path"
import { ReasonEditorScreen } from "@debate-ai/reason-docs/editor/ReasonEditorScreen"

const VideoWatchRoute = lazy(() => import("../../../_client/VideoWatchRoute"))

/**
 * A personal file's address — `/<username>/<folder path>/<doc slug>`
 * (e.g. `/alexgul/aff/k-aff-answers`).
 *
 * Renders the same editor screen as `/reason-editor`; `ReasonDocsRouteSync`
 * reads the file's path off the address bar and opens it against the reader's
 * own documents (and the public library). The username is the file's
 * namespace (`lib/reason-docs/personal-doc-paths` in @debate-ai/reason-docs).
 *
 * This is also the pattern a round video's short address
 * (`/cpd27/shirley/octofinals/kansas-ss-harvard-ab`) matches in a host without
 * the Worker's rewrite, so a path of that shape renders the video's watch page
 * instead (`isVideoRoundPath` in @debate-ai/videos).
 */
export default function PersonalDocsPage() {
  const pathname = usePathname()
  if (isVideoRoundPath(pathname)) {
    return (
      <Suspense>
        <VideoWatchRoute />
      </Suspense>
    )
  }
  return <ReasonEditorScreen />
}
