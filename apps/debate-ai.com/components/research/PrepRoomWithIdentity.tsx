"use client"

/**
 * @fileoverview Thin wrapper over `debate-team-collaboration`'s `PrepRoomPanel`
 * that prefills the "Your ID" presence field from this app's real
 * signed-in session, via `deriveContributorIdFromSessionIdentity`. The
 * panel itself stays app-agnostic (it takes the derived id as a plain
 * prop); this is the only place that knows about `better-auth`. Mirrors
 * `ReviewQueueWithIdentity.tsx`/`GroupChallengesWithIdentity.tsx`.
 */

import { PrepRoomPanel } from "debate-team-collaboration"
import { deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function PrepRoomWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <PrepRoomPanel signedInContributorId={signedInContributorId || undefined} />
}
