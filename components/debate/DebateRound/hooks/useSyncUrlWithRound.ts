/**
 * @fileoverview Hook to sync browser URL with active round
 */

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useFlowStore } from "@/lib/state/store";

/**
 * Automatically updates the browser URL to match the active round.
 *
 * When a round becomes active (flows are unarchived), this hook:
 * 1. Finds the active round
 * 2. Updates the URL to /debate/{slug}
 * 3. Updates the browser history
 *
 * This ensures the URL always reflects the current round being viewed.
 */
export function useSyncUrlWithRound() {
  const router = useRouter();
  const pathname = usePathname();
  const { rounds, flows } = useFlowStore();

  useEffect(() => {
    // Find the round with active (unarchived) flows
    const activeFlows = flows.filter((f) => !f.archived && f.roundId);
    if (activeFlows.length === 0) {
      // No active flows, navigate to base debate page
      if (pathname !== "/debate") {
        router.push("/debate");
      }
      return;
    }

    // Get the roundId from the first active flow
    const roundId = activeFlows[0].roundId;
    const activeRound = rounds.find((r) => r.id === roundId);

    if (!activeRound?.slug) return;

    // Check if we're already on the correct URL
    const expectedPath = `/debate/${activeRound.slug}`;
    if (pathname !== expectedPath) {
      router.push(expectedPath);
    }
  }, [flows, rounds, pathname, router]);
}
