"use client";

/**
 * @fileoverview Binds idea #7's ("On Page Card Reuse Search") team reuse
 * dashboard — `GET /api/evidence-reuse-check/dashboard` — into a small
 * fetch-on-mount hook `EvidenceLibraryPanel` renders as a "Team reuse
 * dashboard" section. Unlike this package's account-synced hooks (e.g.
 * `useSavedArgumentCollections`), there's no local-first/signed-out state to
 * merge here — the dashboard is inherently team-wide server data, not a
 * per-user preference, so a signed-out visitor sees it exactly like anyone
 * else.
 *
 * @module hooks/useReuseCheckDashboard
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchReuseCheckDashboard,
  type RemoteFlaggedPageReuseSummary,
} from "../lib/evidence-reuse-check-client";

export type UseReuseCheckDashboardResult = {
  dashboard: RemoteFlaggedPageReuseSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/** Loads the team reuse dashboard on mount, with a manual `refresh` for after a new check. */
export function useReuseCheckDashboard(): UseReuseCheckDashboardResult {
  const [dashboard, setDashboard] = useState<RemoteFlaggedPageReuseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReuseCheckDashboard()
      .then((result) => {
        if (cancelled) return;
        setDashboard(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  return { dashboard, loading, error, refresh };
}
