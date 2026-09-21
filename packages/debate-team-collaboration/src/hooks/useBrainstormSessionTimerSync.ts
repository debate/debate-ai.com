"use client";

/**
 * @fileoverview Account sync for the brainstorm session timer — closes
 * `brainstorm-board.mdx`'s Known gaps entry "The session timer is
 * `localStorage`-only, not account-synced." Wraps
 * `state/brainstormSessionTimer.ts`'s existing local (single, fixed-key,
 * localStorage) timer store: local-first (works fully signed out, mirroring
 * every other synced field's hook in this repo), then best-effort merges in
 * the account's synced timer on mount and pushes every start/pause/reset/
 * duration change back to the account via the `/api/settings`
 * `brainstormSessionTimer` field, mirroring `useResearchProgressGoalSync.ts`'s
 * split.
 *
 * Unlike that hook, a remote value is only adopted while the local timer is
 * `"idle"` — the same "never rewrite a countdown already in progress" rule
 * `setBrainstormSessionTimerDuration` itself already applies, reused here so
 * a stale remote fetch can never stomp a countdown a moderator just started
 * in this browser.
 *
 * @module hooks/useBrainstormSessionTimerSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adoptBrainstormSessionTimer,
  loadBrainstormSessionTimer,
  pauseSessionTimer,
  resetSessionTimer,
  setSessionTimerDuration,
  startSessionTimer,
} from "../state/brainstormSessionTimer";
import {
  fetchBrainstormSessionTimer,
  saveBrainstormSessionTimer,
} from "../lib/brainstorm-session-timer-sync-client";
import type { BrainstormSessionTimerState } from "../lib/brainstorm-session-timer";

export type UseBrainstormSessionTimerSyncResult = {
  timer: BrainstormSessionTimerState | null;
  /** Re-reads the local store (e.g. after another tab's `storage` event) without touching the account. */
  reload: () => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setDuration: (durationSeconds: number) => void;
};

/**
 * Binds the squad's brainstorm session timer: local-first state
 * (`state/brainstormSessionTimer.ts`), synced to the account when signed in.
 * `signedInContributorId` gates the account sync exactly like
 * `useResearchProgressGoalSync`'s `contributorId` — undefined means signed
 * out, so every network call is skipped and the hook behaves exactly as the
 * panel's previous local-only wiring did.
 */
export function useBrainstormSessionTimerSync(
  signedInContributorId: string | undefined,
): UseBrainstormSessionTimerSyncResult {
  const [timer, setTimer] = useState<BrainstormSessionTimerState | null>(null);
  const remoteAvailableRef = useRef(false);

  const reload = useCallback(() => {
    setTimer(loadBrainstormSessionTimer());
  }, []);

  useEffect(() => {
    remoteAvailableRef.current = false;
    reload();
    if (!signedInContributorId) return;

    let cancelled = false;
    fetchBrainstormSessionTimer()
      .then((remote) => {
        if (cancelled || remote === null) return;
        remoteAvailableRef.current = true;
        if (remote.timer && loadBrainstormSessionTimer().status === "idle") {
          adoptBrainstormSessionTimer(remote.timer);
          reload();
        }
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep
        // whatever's already local rather than blocking, mirroring
        // useResearchProgressGoalSync's same catch.
      });
    return () => {
      cancelled = true;
    };
  }, [signedInContributorId, reload]);

  const push = useCallback((next: BrainstormSessionTimerState) => {
    if (remoteAvailableRef.current) {
      saveBrainstormSessionTimer(next).catch(() => {
        // Best-effort — the local apply already succeeded.
      });
    }
  }, []);

  const start = useCallback(() => {
    const next = startSessionTimer();
    setTimer(next);
    push(next);
  }, [push]);

  const pause = useCallback(() => {
    const next = pauseSessionTimer();
    setTimer(next);
    push(next);
  }, [push]);

  const reset = useCallback(() => {
    const next = resetSessionTimer();
    setTimer(next);
    push(next);
  }, [push]);

  const setDuration = useCallback(
    (durationSeconds: number) => {
      const next = setSessionTimerDuration(durationSeconds);
      setTimer(next);
      push(next);
    },
    [push],
  );

  return { timer, reload, start, pause, reset, setDuration };
}
