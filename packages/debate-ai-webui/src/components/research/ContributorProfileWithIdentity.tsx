"use client"

/**
 * @fileoverview Thin wrapper over `debate-community`'s
 * `ContributorProfilePanel` that highlights when the profile being viewed is
 * the signed-in visitor's own, via `deriveContributorIdFromSessionIdentity`.
 * The panel itself stays app-agnostic (it takes the derived id as a plain
 * prop); this is the only place that knows about `better-auth`. Mirrors
 * `ContributionLeaderboardWithIdentity.tsx`.
 */

import { ContributorProfilePanel } from "debate-community"
import { deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function ContributorProfileWithIdentity({ contributorId }: { contributorId: string }) {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return (
    <ContributorProfilePanel contributorId={contributorId} signedInContributorId={signedInContributorId || undefined} />
  )
}
