"use client"

/**
 * @fileoverview Thin wrapper over `debate-card-search`'s
 * `ProgressUnlocksPanel` that highlights a signed-in visitor's own row, via
 * `deriveContributorIdFromSessionIdentity`. The panel itself stays
 * app-agnostic (it takes the derived id as a plain prop); this is the only
 * place that knows about `better-auth`. Mirrors `TaskInboxWithIdentity.tsx`.
 */

import { ProgressUnlocksPanel, deriveContributorIdFromSessionIdentity } from "debate-card-search"
import { useSession } from "@/lib/hooks/useSession"

export function ProgressUnlocksWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <ProgressUnlocksPanel signedInContributorId={signedInContributorId || undefined} />
}
