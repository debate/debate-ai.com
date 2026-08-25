"use client"

/**
 * @fileoverview Thin wrapper over `debate-card-search`'s `SprintNotesPanel`
 * that prefills the note form's "Author ID" and the presence control's
 * "Your ID" field from this app's real signed-in session, via
 * `deriveContributorIdFromSessionIdentity`. The panel itself stays
 * app-agnostic (it takes the derived id as a plain prop); this is the only
 * place that knows about `better-auth`. Mirrors `TaskInboxWithIdentity.tsx`.
 */

import { SprintNotesPanel, deriveContributorIdFromSessionIdentity } from "debate-card-search"
import { useSession } from "@/lib/hooks/useSession"

export function SprintNotesWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <SprintNotesPanel signedInContributorId={signedInContributorId || undefined} />
}
