"use client"

/**
 * @fileoverview Thin wrapper over `debate-community`'s `QuestStreaksPanel`
 * that highlights a signed-in visitor's own row and syncs their reminder
 * opt-in/spent streak freezes to their account, via
 * `deriveContributorIdFromSessionIdentity`. The panel itself stays
 * app-agnostic (it takes the derived id as a plain prop); this is the only
 * place that knows about `better-auth`. Mirrors `ResearchProgressWithIdentity.tsx`.
 */

import { QuestStreaksPanel } from "debate-community"
import { deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function QuestStreaksWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <QuestStreaksPanel signedInContributorId={signedInContributorId || undefined} />
}
