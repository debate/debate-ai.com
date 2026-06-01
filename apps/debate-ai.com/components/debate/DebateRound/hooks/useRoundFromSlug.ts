/**
 * @fileoverview Hook to load a round based on URL slug
 */

"use client";

import { useEffect, useRef } from "react";
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
  const lastProcessedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    // Check if we're on a round-specific URL
    const match = pathname.match(/^\/debate\/([^\/]+)\/([^\/]+)$/);
    if (!match) {
      lastProcessedSlugRef.current = null;
      return;
    }

    const [, tournament, teams] = match;
    const slug = `${tournament}/${teams}`;

    // Skip if we already processed this slug
    if (lastProcessedSlugRef.current === slug) return;

    // Find the round with matching slug
    const round = rounds.find((r) => r.slug === slug);
    if (!round) return;

    // Check if the round is already active (prevent infinite loop)
    const activeRoundFlows = flows.filter((f) => !f.archived && round.flowIds.includes(f.id));
    if (activeRoundFlows.length === round.flowIds.length) {
      // Already active, just mark as processed
      lastProcessedSlugRef.current = slug;
      return;
    }

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
      lastProcessedSlugRef.current = slug;
    }
  }, [pathname, rounds, flows, setFlows]);
}
