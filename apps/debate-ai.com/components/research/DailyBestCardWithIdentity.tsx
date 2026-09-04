"use client"

/**
 * @fileoverview Thin wrapper over `debate-card-search`'s `DailyBestCardPanel`
 * that prefills each announced day's comment-thread "Your name" field with a
 * signed-in visitor's derived id, via `deriveContributorIdFromSessionIdentity`.
 * The panel itself stays app-agnostic (it takes the derived id as a plain
 * prop); this is the only place that knows about `better-auth`. Mirrors
 * `ProgressUnlocksWithIdentity.tsx`.
 */

import { DailyBestCardPanel } from "debate-community"
import { deriveContributorIdFromSessionIdentity } from "debate-research-evidence"
import { useSession } from "@/lib/hooks/useSession"

export function DailyBestCardWithIdentity() {
  const { user } = useSession()
  const signedInContributorId = deriveContributorIdFromSessionIdentity(user)

  return <DailyBestCardPanel signedInContributorId={signedInContributorId || undefined} />
}
