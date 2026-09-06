"use client"

/**
 * @fileoverview Thin wrapper over `debate-team-collaboration`'s `TaskInboxPanel`
 * that prefills its "My tasks" field from this app's real signed-in
 * session, via `deriveContributorIdFromSessionIdentity`. The panel itself
 * stays app-agnostic (it takes the derived id as a plain prop); this is the
 * only place that knows about `better-auth`.
 */

import { TaskInboxPanel } from "debate-team-collaboration"
import { deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function TaskInboxWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <TaskInboxPanel signedInContributorId={signedInContributorId || undefined} />
}
