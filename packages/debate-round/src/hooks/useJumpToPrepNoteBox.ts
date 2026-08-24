/**
 * @fileoverview Hook wiring a Prep Notes "jump to argument" deep link
 * (`?flowId=&boxPath=`, built by `strategy-sync-notes.ts`'s
 * `buildPrepNoteJumpHref`) into the debate flow page — closes the
 * `docs/features/prep-notes.md` "Known gaps" bullet "No 'jump to argument'
 * link from a note back to its flow box."
 *
 * Selects the note's flow tab (by `flowId`, not the store's array-index
 * `selected`), then scrolls to and flashes the note's box cell via
 * `edit-cells.ts`'s `jumpToBoxInGrid` once that flow's grid has the target
 * row rendered — either immediately, if the grid is already mounted and the
 * flow tab didn't need to change, or once the returned `onGridReady`
 * handler fires for a fresh grid mount.
 */

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useFlowStore } from "../state/store";
import { jumpToBoxInGrid, type GridJumpApi } from "../flow/edit-cells";
import { parsePrepNoteJumpParams } from "../flow/strategy-sync-notes";

export function useJumpToPrepNoteBox(gridApiRef: React.RefObject<GridJumpApi | null>) {
  const searchParams = useSearchParams();
  const { flows, selected, setSelected } = useFlowStore();
  const pendingBoxPathRef = useRef<number[] | null>(null);
  const processedKeyRef = useRef<string | null>(null);

  const target = parsePrepNoteJumpParams(searchParams);
  const targetKey = target ? `${target.flowId}:${target.boxPath.join(",")}` : null;

  // Select the note's flow tab once, the first time this deep link's target changes.
  useEffect(() => {
    if (!target || !targetKey || processedKeyRef.current === targetKey) return;

    const index = flows.findIndex((flow) => flow.id === target.flowId);
    if (index === -1) return;

    processedKeyRef.current = targetKey;
    pendingBoxPathRef.current = target.boxPath;
    if (index !== selected) {
      setSelected(index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, flows, selected, setSelected]);

  // Retry the grid jump once the selected flow's rows have (re)rendered.
  useEffect(() => {
    const boxPath = pendingBoxPathRef.current;
    const api = gridApiRef.current;
    if (!boxPath || !api) return;

    const timeout = setTimeout(() => {
      if (jumpToBoxInGrid(api, boxPath)) {
        pendingBoxPathRef.current = null;
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [selected, gridApiRef]);

  return {
    /** Wire into the grid's `onGridReady` so a fresh grid mount also retries a pending jump. */
    onGridReady: () => {
      const boxPath = pendingBoxPathRef.current;
      const api = gridApiRef.current;
      if (boxPath && api && jumpToBoxInGrid(api, boxPath)) {
        pendingBoxPathRef.current = null;
      }
    },
  };
}
