"use client";

/**
 * @fileoverview Account-synced scheduled sprint sessions — closes the "🤝
 * Team Collaboration Mode" bullet's "Scheduled sessions ... are ... local-
 * only (no account sync yet)" Known gap in TODO.md.
 *
 * Local-first, mirroring `debate-community`'s
 * `hooks/useDailyBestCardComments.ts`: `TopicSprintPanel` keeps reading/
 * writing `localStorage` through this hook, which stays fully usable signed
 * out. On mount, a one-time account merge (deduped across instances via a
 * module-level `remoteMergePromise`) reconciles local and remote sessions —
 * merged by each session's own `id`: a remote session with no local
 * counterpart is adopted locally (`adoptSprintSession`), and a local-only
 * session (scheduled before this feature existed, or scheduled offline) is
 * best-effort pushed up. Neither direction ever overwrites an `id` both
 * sides already have — a session is scheduled once and only ever cancelled,
 * so there's nothing to reconcile beyond filling gaps.
 *
 * @module hooks/useSprintSessionsSync
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptSprintSession,
  deleteSprintSession,
  listSprintSessions,
  saveSprintSession,
} from "../state/sprintSessions";
import {
  deleteSavedSprintSessionFromAccount,
  listSavedSprintSessions,
  saveSprintSessionToAccount,
} from "../lib/sprint-sessions-client";
import type { SprintSession } from "../lib/team-collaboration-mode";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced sessions into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedSprintSessions()
      .then((remoteSessions) => {
        if (remoteSessions === null) return false;
        remoteAvailable = true;

        const localSessions = listSprintSessions();
        const localIds = new Set(localSessions.map((session) => session.id));
        const remoteIds = new Set(remoteSessions.map((session) => session.id));

        let changed = false;
        for (const remote of remoteSessions) {
          if (!localIds.has(remote.id)) {
            adoptSprintSession(remote);
            changed = true;
          }
        }
        for (const local of localSessions) {
          if (!remoteIds.has(local.id)) {
            saveSprintSessionToAccount(local).catch(() => {
              // Best-effort — this session stays local-only until a later
              // successful sync (e.g. the next schedule/mount).
            });
          }
        }
        return changed;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

export interface UseSprintSessionsSyncResult {
  /** Every persisted sprint session, across all topics. `[]` until the initial local read (and, if signed in, account merge) completes. */
  sessions: SprintSession[];
  /** Whether this browser is signed in and syncing sessions to the account. */
  synced: boolean;
  scheduleSession: (session: SprintSession) => void;
  cancelSession: (id: string) => void;
  /** Re-reads the local store — for cross-tab `storage`-event refreshes, where another tab already wrote the change. */
  refreshSessions: () => void;
}

/**
 * Binds the current user's scheduled sprint sessions: local-first state
 * (`state/sprintSessions.ts`), merged with and best-effort synced to the
 * account when signed in.
 */
export function useSprintSessionsSync(): UseSprintSessionsSyncResult {
  const [sessions, setSessions] = useState<SprintSession[]>([]);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setSessions(listSprintSessions());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setSessions(listSprintSessions());
    });
  }, []);

  const scheduleSession = useCallback((session: SprintSession) => {
    saveSprintSession(session);
    setSessions(listSprintSessions());
    if (remoteAvailable) {
      saveSprintSessionToAccount(session).catch(() => {
        // Best-effort — the session is already saved locally above, matching
        // useDailyBestCardComments's "local apply is never blocked by a sync
        // failure" convention.
      });
    }
  }, []);

  const cancelSession = useCallback((id: string) => {
    deleteSprintSession(id);
    setSessions(listSprintSessions());
    if (remoteAvailable) {
      deleteSavedSprintSessionFromAccount(id).catch(() => {
        // Best-effort, same as scheduleSession above.
      });
    }
  }, []);

  const refreshSessions = useCallback(() => {
    setSessions(listSprintSessions());
  }, []);

  return { sessions, synced, scheduleSession, cancelSession, refreshSessions };
}
