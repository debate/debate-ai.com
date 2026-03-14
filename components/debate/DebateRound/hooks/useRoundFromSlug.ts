/**
 * @fileoverview Hook to load a round based on URL slug
 */

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFlowStore } from "@/lib/state/store";

/**
 * Loads and activates a round based on the URL slug pattern:
 * /debate/[tournament]/[teams]
 *
 * Matches against the slug stored in rounds and activates the flows
 * associated with that round.
 */
export function useRoundFromSlug() {
  const pathname = usePathname();
  const { rounds, flows, setFlows } = useFlowStore();

  useEffect(() => {
    // Check if we're on a round-specific URL
    const match = pathname.match(/^\/debate\/([^\/]+)\/([^\/]+)$/);
    if (!match) return;

    const [, tournament, teams] = match;
    const slug = `${tournament}/${teams}`;

    // Find the round with matching slug
    const round = rounds.find((r) => r.slug === slug);
    if (!round) return;

    // Activate the flows for this round
    const roundFlows = flows.filter((f) => round.flowIds.includes(f.id));
    if (roundFlows.length > 0) {
      // Unarchive round flows and archive others
      const updatedFlows = flows.map((f) => {
        if (round.flowIds.includes(f.id)) {
          return { ...f, archived: false };
        }
        return { ...f, archived: true };
      });
      setFlows(updatedFlows);
    }
  }, [pathname, rounds, flows, setFlows]);
}
