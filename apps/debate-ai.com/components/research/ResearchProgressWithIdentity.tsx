"use client"

/**
 * @fileoverview Thin wrapper over `debate-team-collaboration`'s
 * `ResearchProgressPanel` that highlights a signed-in visitor's own row, via
 * `deriveContributorIdFromSessionIdentity`. The panel itself stays
 * app-agnostic (it takes the derived id as a plain prop); this is the only
 * place that knows about `better-auth`. Mirrors `TaskInboxWithIdentity.tsx`.
 */

import { ResearchProgressPanel } from "debate-team-collaboration"
import { deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function ResearchProgressWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <ResearchProgressPanel signedInContributorId={signedInContributorId || undefined} />
}
