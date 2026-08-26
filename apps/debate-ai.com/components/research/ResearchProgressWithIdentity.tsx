"use client"

/**
 * @fileoverview Thin wrapper over `debate-card-search`'s
 * `ResearchProgressPanel` that highlights a signed-in visitor's own row, via
 * `deriveContributorIdFromSessionIdentity`. The panel itself stays
 * app-agnostic (it takes the derived id as a plain prop); this is the only
 * place that knows about `better-auth`. Mirrors `TaskInboxWithIdentity.tsx`.
 */

import { ResearchProgressPanel, deriveContributorIdFromSessionIdentity } from "debate-card-search"
import { useSession } from "@/lib/hooks/useSession"

export function ResearchProgressWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <ResearchProgressPanel signedInContributorId={signedInContributorId || undefined} />
}
