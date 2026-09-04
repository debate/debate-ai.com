"use client"

/**
 * @fileoverview Thin wrapper over `debate-card-search`'s `DailyQuestsPanel`
 * that prefills its "Your streak" field from a signed-in visitor's session,
 * via `deriveContributorIdFromSessionIdentity`. The panel itself stays
 * app-agnostic (it takes the derived id as a plain prop); this is the only
 * place that knows about `better-auth`. Mirrors `TaskInboxWithIdentity.tsx`.
 */

import { DailyQuestsPanel } from "debate-community"
import { deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function DailyQuestsWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <DailyQuestsPanel signedInContributorId={signedInContributorId || undefined} />
}
