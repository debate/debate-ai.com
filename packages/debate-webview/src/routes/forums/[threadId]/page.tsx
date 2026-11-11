"use client"

import { useParams } from "next/navigation"

import { ForumThreadView } from "@debate-ai/comments/forums/ui"
import { ToolPage } from "../../../components/tools/ToolPageHeader"
import { useSession } from "../../../lib/hooks/useSession"

/**
 * One forum thread, opened from a row in the feed. The thread carries its own
 * back link, so the page is only the shell around it.
 */
export default function ForumThreadPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const { isAuthenticated } = useSession()

  return (
    <ToolPage>
      <ForumThreadView threadId={threadId ?? ""} isAuthenticated={isAuthenticated} />
    </ToolPage>
  )
}
