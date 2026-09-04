"use client"

/**
 * @fileoverview Thin wrapper over `debate-card-search`'s
 * `GroupChallengesPanel` that prefills each challenge's "Record a win
 * (contributor ID)" field from this app's real signed-in session, via
 * `deriveContributorIdFromSessionIdentity`. The panel itself stays
 * app-agnostic (it takes the derived id as a plain prop); this is the only
 * place that knows about `better-auth`. Mirrors `TaskInboxWithIdentity.tsx`.
 */

import { GroupChallengesPanel } from "debate-team-collaboration"
import { deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function GroupChallengesWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <GroupChallengesPanel signedInContributorId={signedInContributorId || undefined} />
}
