"use client"

import { DebateFlowPage, type DebateFlowPageProps } from "@debate/round"
import { useSession } from "../../lib/hooks/useSession"

/**
 * The round workspace with the signed-in user's email passed in, so the
 * round sidebar can highlight the speeches they give.
 */
export function ViewerDebateFlowPage(props: Omit<DebateFlowPageProps, "viewerEmail">) {
  const { user } = useSession()
  return <DebateFlowPage {...props} viewerEmail={user?.email ?? null} />
}
