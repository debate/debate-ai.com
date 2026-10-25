/**
 * @fileoverview Opens the round named by a `?roundId=` deep link (built by
 * `strategy-sync-notes.ts`'s `buildRoundOpenHref`, used by Settings → Saved
 * data): brings that round's flows to the front, archiving every other flow,
 * and selects its first one — the same action as opening a round from the
 * start screen.
 */

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useFlowStore } from "../state/store";
import { parseRoundOpenParam } from "../flow/strategy-sync-notes";

export function useOpenRoundFromLink() {
  const searchParams = useSearchParams();
  const { flows, rounds, setFlows, setSelected } = useFlowStore();
  const openedRoundRef = useRef<number | null>(null);

  const roundId = parseRoundOpenParam(searchParams);

  // Open the linked round once, as soon as the stored rounds have loaded.
  useEffect(() => {
    if (roundId === null || openedRoundRef.current === roundId) return;

    const round = rounds.find((r) => r.id === roundId);
    if (!round) return;
    const firstFlowIndex = flows.findIndex((f) => round.flowIds.includes(f.id));
    if (firstFlowIndex === -1) return;

    openedRoundRef.current = roundId;
    setFlows(flows.map((f) => ({ ...f, archived: !round.flowIds.includes(f.id) })));
    setSelected(firstFlowIndex);
  }, [roundId, rounds, flows, setFlows, setSelected]);
}
