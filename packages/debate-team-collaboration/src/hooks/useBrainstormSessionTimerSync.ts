"use client";

/**
 * @fileoverview Account sync for `BrainstormBoardPanel`'s session timer —
 * closes `packages/debate-help-docs/content/docs/features/brainstorm-board.mdx`'s
 * "The session timer is `localStorage`-only, not account-synced" Known gap.
 * Wraps `state/brainstormSessionTimer.ts`'s existing local (per-browser)
 * timer store: local-first (works fully signed out, mirroring every other
 * synced field's hook in this repo), then best-effort merges in the
 * account's synced timer on mount and pushes every start/pause/reset/
 * duration change back to the account via the `/api/settings`
 * `brainstormSessionTimer` field, mirroring
 * `useResearchProgressGoalSync.ts`'s split.
 *
 * Unlike that hook, this one isn't keyed by a contributor id — the account
 * row itself is scoped to the real signed-in user via `/api/settings`'s
 * session check, and a session timer has no per-contributor data to key by
 * — so the caller only needs to say *whether* the visitor is signed in.
 * `BrainstormBoardPanel` already derives that from its own
 * `signedInContributorId` prop (present only for a real signed-in visitor —
 * see `lib/session-identity.ts`), so this hook takes that same value as its
 * enable signal rather than introducing a second one.
 *
 * @module hooks/useBrainstormSessionTimerSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applySyncedSessionTimer,
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
  /** Re-reads the timer from `localStorage`, e.g. after another tab changes it (`storage` event). */
  reloadFromStorage: () => void;
  start: (now?: number) => void;
  pause: (now?: number) => void;
  reset: () => void;
  setDuration: (durationSeconds: number) => void;
};

/**
 * Binds the signed-in-or-not Team Brainstorm Assist session timer:
 * local-first state (`state/brainstormSessionTimer.ts`), synced to the
 * account when `signedIn` is true.
 */
export function useBrainstormSessionTimerSync(signedIn: boolean): UseBrainstormSessionTimerSyncResult {
  const [timer, setTimer] = useState<BrainstormSessionTimerState | null>(null);
  const remoteAvailableRef = useRef(false);

  const pushRemote = useCallback((next: BrainstormSessionTimerState) => {
    if (!remoteAvailableRef.current) return;
    saveBrainstormSessionTimer(next).catch(() => {
      // Best-effort — the local apply already succeeded.
    });
  }, []);

  useEffect(() => {
    remoteAvailableRef.current = false;
    setTimer(loadBrainstormSessionTimer());
    if (!signedIn) return;

    let cancelled = false;
    fetchBrainstormSessionTimer()
      .then((remote) => {
        if (cancelled || remote === null) return;
        remoteAvailableRef.current = true;
        if (remote.timer) {
          setTimer(applySyncedSessionTimer(remote.timer));
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
  }, [signedIn]);

  const reloadFromStorage = useCallback(() => {
    setTimer(loadBrainstormSessionTimer());
  }, []);

  const start = useCallback(
    (now?: number) => {
      const next = startSessionTimer(now);
      setTimer(next);
      pushRemote(next);
    },
    [pushRemote],
  );

  const pause = useCallback(
    (now?: number) => {
      const next = pauseSessionTimer(now);
      setTimer(next);
      pushRemote(next);
    },
    [pushRemote],
  );

  const reset = useCallback(() => {
    const next = resetSessionTimer();
    setTimer(next);
    pushRemote(next);
  }, [pushRemote]);

  const setDuration = useCallback(
    (durationSeconds: number) => {
      const next = setSessionTimerDuration(durationSeconds);
      setTimer(next);
      pushRemote(next);
    },
    [pushRemote],
  );

  return { timer, reloadFromStorage, start, pause, reset, setDuration };
}
