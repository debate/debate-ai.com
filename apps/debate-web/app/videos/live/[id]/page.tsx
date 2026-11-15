import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { LiveRoundPage } from "@debate-ai/videos"
import { isLiveStreamId } from "@debate-ai/timer/src/recorder/live-radio"

/**
 * `/videos/live/<id>` — one live round stream (Round Editor → Live stream):
 * tune in while the round is on air, or play the replay afterwards. The
 * player reads `/api/live-rounds` itself, so a private stream answers only
 * its invitees. Not indexed: streams come and go.
 */

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Live round radio",
  description: "Listen to a debate round live, speech by speech.",
  robots: { index: false, follow: false },
}

export default async function LiveRoundRoute({ params }: PageProps) {
  const { id } = await params
  if (!isLiveStreamId(id)) notFound()
  return <LiveRoundPage streamId={id} />
}
