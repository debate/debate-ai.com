"use client"

import { DebateFlowPage, type DebateFlowPageProps } from "@debate-ai/round"
import { useSession } from "../../lib/hooks/useSession"

/**
 * The round workspace with the signed-in user's email and name passed in, so
 * the round sidebar can highlight the speeches they give and the Cameras room
 * can label them with their seat (1A, 2N, 1J…) from the round invite.
 */
export function ViewerDebateFlowPage(props: Omit<DebateFlowPageProps, "viewerEmail" | "viewerName">) {
  const { user } = useSession()
  return <DebateFlowPage {...props} viewerEmail={user?.email ?? null} viewerName={user?.name ?? null} />
}
