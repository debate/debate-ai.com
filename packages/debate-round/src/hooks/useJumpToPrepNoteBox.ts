/**
 * @fileoverview Selects a Prep Notes "jump to argument" deep link's
 * (`?flowId=&boxPath=`, built by `strategy-sync-notes.ts`'s
 * `buildPrepNoteJumpHref`) target flow tab in the debate flow page.
 *
 * The flow spreadsheet grid this used to scroll/flash a note's box cell in
 * has been removed, so this only selects the note's flow tab (by `flowId`,
 * not the store's array-index `selected`) — still useful for landing on the
 * right flow, even without the in-grid scroll.
 */

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useFlowStore } from "../state/store";
import { parsePrepNoteJumpParams } from "../flow/strategy-sync-notes";

export function useJumpToPrepNoteBox() {
  const searchParams = useSearchParams();
  const { flows, selected, setSelected } = useFlowStore();
  const processedKeyRef = useRef<string | null>(null);

  const target = parsePrepNoteJumpParams(searchParams);
  const targetKey = target ? `${target.flowId}:${target.boxPath.join(",")}` : null;

  // Select the note's flow tab once, the first time this deep link's target changes.
  useEffect(() => {
    if (!target || !targetKey || processedKeyRef.current === targetKey) return;

    const index = flows.findIndex((flow) => flow.id === target.flowId);
    if (index === -1) return;

    processedKeyRef.current = targetKey;
    if (index !== selected) {
      setSelected(index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, flows, selected, setSelected]);
}
