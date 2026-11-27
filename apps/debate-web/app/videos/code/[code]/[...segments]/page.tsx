import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { formatSegment, parseVideoRoundPath, parseVideoTopicCode, seasonSegment, TOPIC_FORMAT_STYLE } from "@debate-ai/videos"
import { ReasonEditorScreen } from "@debate-ai/reason-docs/editor/ReasonEditorScreen"
import { VideoRoutePage, videoRouteMetadata, type VideoRouteSearchParams } from "../../../_watch/video-route-page"

/**
 * A debate round at its short address, `/<topic code>/<tournament>/<round>/<teams>`,
 * e.g. `/cpd27/shirley/octofinals/kansas-ss-harvard-ab/1nc/llm` (see
 * `@debate-ai/videos`' `lib/video-topic-path`).
 *
 * `next.config.mjs` rewrites that root-level shape here, which is why the
 * address a reader sees never contains `videos/code`. The code names the
 * season and format, so the page turns it back into the `/videos/<season>/<format>/…`
 * segments the video lookup reads and renders the same watch page, whose
 * canonical check sends any other spelling (another case, a retagged
 * tournament, the old `/videos/…` form) to the current address.
 *
 * Topic Starters share the `vcx`, `ld` and `pf` codes at the root, so when no
 * video has the address the Debate Editor renders instead, as it did before
 * rounds took this shape. A `cpd` code has no Topic Starters; that is a 404.
 */

interface PageProps {
  params: Promise<{ code: string; segments: string[] }>
  searchParams: VideoRouteSearchParams
}

/** The `/videos/…` segments the short address stands for, or `null` for a path that is not one. */
function libraryRouteSegments(code: string, segments: string[]): string[] | null {
  const parsed = parseVideoTopicCode(code)
  if (!parsed || !parseVideoRoundPath(`/${code}/${segments.join("/")}`)) return null
  const style = TOPIC_FORMAT_STYLE[parsed.format]
  const format = formatSegment({ videoId: "", title: "", style })
  if (!format) return null
  return [seasonSegment({ videoId: "", title: "", seasonYear: parsed.seasonEnd }), format, ...segments]
}

const EDITOR_METADATA: Metadata = {
  title: "REASON Editor",
  description: "Research Editor for Annotated Summaries in Outline Notation",
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code, segments } = await params
  const library = libraryRouteSegments(code, segments)
  if (!library) return { title: "Video not found", robots: { index: false, follow: false } }
  return videoRouteMetadata(library, parseVideoTopicCode(code)?.format === "cpd" ? undefined : EDITOR_METADATA)
}

export default async function WatchRoundByTopicCodePage({ params, searchParams }: PageProps) {
  const { code, segments } = await params
  const library = libraryRouteSegments(code, segments)
  if (!library) notFound()
  const topicStarterCode = parseVideoTopicCode(code)?.format !== "cpd"
  return (
    <VideoRoutePage
      segments={library}
      searchParams={searchParams}
      requestedPath={`/${code}/${segments.join("/")}`}
      onMissing={topicStarterCode ? () => <ReasonEditorScreen /> : undefined}
    />
  )
}
