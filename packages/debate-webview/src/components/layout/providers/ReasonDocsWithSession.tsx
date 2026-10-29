"use client"

/**
 * @fileoverview Mounts the REASON docs provider with the app's live session.
 * `@debate-ai/reason-docs` never imports the auth client, so the shell reads
 * it here and hands it down through {@link ReasonSessionProvider}.
 */

import { useMemo, type ReactNode } from "react"
import { ReasonDocsProvider } from "@debate-ai/reason-docs/docs/ReasonDocsProvider"
import { ReasonSessionProvider } from "@debate-ai/reason-docs/session"
import { useSession } from "../../../lib/hooks/useSession"

export function ReasonDocsWithSession({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useSession()
  const session = useMemo(() => ({ isAuthenticated, user }), [isAuthenticated, user])
  return (
    <ReasonSessionProvider session={session}>
      <ReasonDocsProvider>{children}</ReasonDocsProvider>
    </ReasonSessionProvider>
  )
}
