"use client"

import { PracticeVsAiSections } from "../../components/practice/PracticeVsAiSections"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"
import { useSession } from "../../lib/hooks/useSession"

/**
 * `/practice/versus-ai` (and `/practice`, merged into it) outside Next: the
 * web app reads the session on the server (`app/practice/versus-ai/page.tsx`);
 * here it comes from the client session.
 */
export default function VersusAiRoute() {
  const { user } = useSession()
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/versus-ai" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <PracticeVsAiSections
        userId={user?.id ?? undefined}
        userDisplayName={user?.name ?? undefined}
        userAvatar={user?.image ?? undefined}
      />
    </ToolPage>
  )
}
