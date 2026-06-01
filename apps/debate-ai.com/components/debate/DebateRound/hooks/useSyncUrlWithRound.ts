/**
 * @fileoverview Hook to sync browser URL with active round
 */

"use client";

import { useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useFlowStore } from "@/lib/state/store";

/**
 * Automatically updates the browser URL to match the active round.
 *
 * When a round becomes active (flows are unarchived), this hook:
 * 1. Finds the active round
 * 2. Updates the URL to /debate/{slug}
 * 3. Uses replace to avoid cluttering history
 *
 * This ensures the URL always reflects the current round being viewed.
 */
export function useSyncUrlWithRound() {
  const router = useRouter();
  const pathname = usePathname();
  const { rounds, flows } = useFlowStore();
  const lastSyncedSlugRef = useRef<string | null>(null);

  // Memoize the active round slug to prevent unnecessary re-runs
  const activeRoundSlug = useMemo(() => {
    const activeFlows = flows.filter((f) => !f.archived && f.roundId);
    if (activeFlows.length === 0) return null;

    const roundId = activeFlows[0].roundId;
    const activeRound = rounds.find((r) => r.id === roundId);
    return activeRound?.slug || null;
  }, [flows, rounds]);

  useEffect(() => {
    // No active round
    if (!activeRoundSlug) return;

    // Already synced to this slug
    if (lastSyncedSlugRef.current === activeRoundSlug) return;

    const expectedPath = `/debate/${activeRoundSlug}`;

    // Already on the correct URL
    if (pathname === expectedPath) {
      lastSyncedSlugRef.current = activeRoundSlug;
      return;
    }

    // Update the URL
    lastSyncedSlugRef.current = activeRoundSlug;
    router.replace(expectedPath);
  }, [activeRoundSlug, pathname, router]);
}
