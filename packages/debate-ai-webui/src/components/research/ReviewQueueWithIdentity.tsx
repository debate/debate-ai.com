"use client"

/**
 * @fileoverview Thin wrapper over `debate-research-evidence`'s `ReviewQueuePanel`
 * that prefills "Your reviewer ID" and each card's comment "Reviewer ID"
 * field from this app's real signed-in session, via
 * `deriveContributorIdFromSessionIdentity`. The panel itself stays
 * app-agnostic (it takes the derived id as a plain prop); this is the only
 * place that knows about `better-auth`. Mirrors `TaskInboxWithIdentity.tsx`.
 */

import { ReviewQueuePanel, deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function ReviewQueueWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <ReviewQueuePanel signedInContributorId={signedInContributorId || undefined} />
}
