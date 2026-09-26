"use client"

import { Suspense } from "react"
import { DebatePracticeVsAi } from "debate-practice-vs-ai"

import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"
import { useSession } from "../../lib/hooks/useSession"

/**
 * `/versus-ai` outside Next: the web app reads the session on the server
 * (`app/versus-ai/page.tsx`); here it comes from the client session.
 */
export default function VersusAiRoute() {
  const { user } = useSession()
  return (
    <ToolPage>
      <ToolPageHeader href="/versus-ai" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Suspense>
        <DebatePracticeVsAi
          userId={user?.id ?? undefined}
          userDisplayName={user?.name ?? undefined}
          userAvatar={user?.image ?? undefined}
        />
      </Suspense>
    </ToolPage>
  )
}
