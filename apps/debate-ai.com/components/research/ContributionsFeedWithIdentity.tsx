"use client"

/**
 * @fileoverview Thin wrapper over `debate-card-search`'s
 * `ContributionsFeedPanel` that locks the endorsing reviewer id to this
 * app's real signed-in session, via `deriveContributorIdFromSessionIdentity`.
 * The panel itself stays app-agnostic (it takes the derived id as a plain
 * prop); this is the only place that knows about `better-auth`. Mirrors
 * `ReviewQueueWithIdentity.tsx`.
 */

import { ContributionsFeedPanel, deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function ContributionsFeedWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <ContributionsFeedPanel signedInContributorId={signedInContributorId || undefined} />
}
