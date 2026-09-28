"use client"

import { useParams } from "next/navigation"

import { ForumThreadView } from "../../../components/forums/ForumThreadView"
import { ToolPage } from "../../../components/tools/ToolPageHeader"

/**
 * One forum thread, opened from a row in the feed. The thread carries its own
 * back link, so the page is only the shell around it.
 */
export default function ForumThreadPage() {
  const { threadId } = useParams<{ threadId: string }>()

  return (
    <ToolPage>
      <ForumThreadView threadId={threadId ?? ""} />
    </ToolPage>
  )
}
