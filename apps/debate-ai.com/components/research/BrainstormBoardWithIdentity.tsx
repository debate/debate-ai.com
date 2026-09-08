"use client"

/**
 * @fileoverview Thin wrapper over `debate-team-collaboration`'s
 * `BrainstormBoardPanel` that prefills the idea form's "Contributor ID"
 * field from this app's real signed-in session, via
 * `deriveContributorIdFromSessionIdentity`. The panel itself stays
 * app-agnostic (it takes the derived id as a plain prop); this is the only
 * place that knows about `better-auth`. Mirrors `TaskInboxWithIdentity.tsx`.
 */

import { BrainstormBoardPanel } from "debate-team-collaboration"
import { deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function BrainstormBoardWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <BrainstormBoardPanel signedInContributorId={signedInContributorId || undefined} />
}
