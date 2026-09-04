/**
 * @fileoverview Client wrapper around `CommunityResearchHubPanel` — split
 * out of `page.tsx` because `page.tsx` needs to stay a server component to
 * export `metadata`, but the "For You" section needs
 * `useFavoriteTools`'s client-side (`localStorage` + account-synced) read of
 * the viewer's starred tools, mirroring `NewsPageContent.tsx`'s split for
 * the same reason.
 *
 * @module app/community-hub/CommunityHubPageContent
 */

"use client"

import { CommunityResearchHubPanel } from "debate-community"
import { useFavoriteTools } from "@/lib/hooks/useFavoriteTools"

export function CommunityHubPageContent() {
  const { favorites } = useFavoriteTools()
  return <CommunityResearchHubPanel favoriteHrefs={favorites} />
}
