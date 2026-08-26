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
 *
 * If the row never appears — e.g. the note's `boxPath` no longer resolves
 * because the flow was edited or the row removed since the note was made —
 * retries every `RETRY_INTERVAL_MS` up to `edit-cells.ts`'s
 * `MAX_BOX_JUMP_ATTEMPTS` times, then gives up and reports `jumpFailed` so
 * the caller can show `buildBoxJumpFailedMessage()`, closing the "silently
 * returns false... no error is shown" Known gap recorded in
 * `docs/features/prep-notes.md`.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFlowStore } from "../state/store";
import { jumpToBoxInGrid, hasExhaustedBoxJumpAttempts, type GridJumpApi } from "../flow/edit-cells";
import { parsePrepNoteJumpParams } from "../flow/strategy-sync-notes";

const RETRY_INTERVAL_MS = 200;

export function useJumpToPrepNoteBox(gridApiRef: React.RefObject<GridJumpApi | null>) {
  const searchParams = useSearchParams();
  const { flows, selected, setSelected } = useFlowStore();
  const pendingBoxPathRef = useRef<number[] | null>(null);
  const attemptsRef = useRef(0);
  const processedKeyRef = useRef<string | null>(null);
  const [jumpFailed, setJumpFailed] = useState(false);

  const target = parsePrepNoteJumpParams(searchParams);
  const targetKey = target ? `${target.flowId}:${target.boxPath.join(",")}` : null;

  // Select the note's flow tab once, the first time this deep link's target changes.
  useEffect(() => {
    if (!target || !targetKey || processedKeyRef.current === targetKey) return;

    const index = flows.findIndex((flow) => flow.id === target.flowId);
    if (index === -1) return;

    processedKeyRef.current = targetKey;
    pendingBoxPathRef.current = target.boxPath;
    attemptsRef.current = 0;
    setJumpFailed(false);
    if (index !== selected) {
      setSelected(index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, flows, selected, setSelected]);

  const attemptJump = () => {
    const boxPath = pendingBoxPathRef.current;
    const api = gridApiRef.current;
    if (!boxPath || !api) return;

    if (jumpToBoxInGrid(api, boxPath)) {
      pendingBoxPathRef.current = null;
      attemptsRef.current = 0;
      return;
    }

    attemptsRef.current += 1;
    if (hasExhaustedBoxJumpAttempts(attemptsRef.current)) {
      pendingBoxPathRef.current = null;
      setJumpFailed(true);
    }
  };

  // Retry the grid jump, spaced out, until it succeeds or the retry budget
  // (edit-cells.ts's MAX_BOX_JUMP_ATTEMPTS) is exhausted. Keyed on targetKey
  // (not just `selected`) so a second jump to a different note in the same
  // flow — where `selected` never changes — still starts its own retries.
  useEffect(() => {
    if (!pendingBoxPathRef.current) return;

    attemptJump();
    const interval = setInterval(() => {
      attemptJump();
      if (!pendingBoxPathRef.current) clearInterval(interval);
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, targetKey]);

  return {
    /** Wire into the grid's `onGridReady` so a fresh grid mount also retries a pending jump. */
    onGridReady: attemptJump,
    /** True once a jump target's retry budget is exhausted without ever resolving. */
    jumpFailed,
    /** Dismiss the failure message (e.g. a banner's "×" button). */
    dismissJumpFailed: () => setJumpFailed(false),
  };
}
