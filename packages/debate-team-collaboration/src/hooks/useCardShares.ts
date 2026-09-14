/**
 * @fileoverview Polls the signed-in user's received/sent collab-card shares
 * and exposes share/open/remove over them. Same visible-tab interval as
 * `useContacts`; a share that lands while the tab is open toasts once (same
 * high-water-mark rule as `useAccountNotifications`, keyed on the share's
 * `updatedAt` so a re-share of the same room re-announces itself).
 *
 * @module hooks/useCardShares
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  fetchCardShares,
  markCardShareOpened,
  removeCardShare,
  shareCard,
  type CardShareEntry,
  type CardSharesPage,
  type ShareCardInput,
  type ShareCardResult,
} from "../state/cardShares";

const POLL_INTERVAL_MS = 30_000;
const LAST_SEEN_STORAGE_KEY = "cardShares:lastSeenUpdatedAt";

const EMPTY: CardSharesPage = { received: [], sent: [] };

function readLastSeen(): number {
  try {
    return Number(localStorage.getItem(LAST_SEEN_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastSeen(value: number): void {
  try {
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, String(value));
  } catch {
    /* storage denied — toasts just repeat on the next load */
  }
}

export interface UseCardSharesResult extends CardSharesPage {
  loading: boolean;
  loaded: boolean;
  /** Received shares the recipient hasn't opened yet. */
  unopenedCount: number;
  refresh: () => Promise<void>;
  share: (input: ShareCardInput) => Promise<ShareCardResult>;
  /** Records the open server-side and returns the share (for the caller to actually join it). */
  markOpened: (share: CardShareEntry) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export interface UseCardSharesOptions {
  /** Called with a freshly-arrived share when the toast's "Open" is pressed; omitted → no action button. */
  onOpen?: (share: CardShareEntry) => void;
  /** Disable the arrival toast (the panel that lists them already shows the badge). */
  toastOnArrival?: boolean;
}

export function useCardShares(enabled: boolean, options: UseCardSharesOptions = {}): UseCardSharesResult {
  const [page, setPage] = useState<CardSharesPage>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const lastSeenRef = useRef(0);
  const initializedRef = useRef(false);
  const onOpenRef = useRef(options.onOpen);
  onOpenRef.current = options.onOpen;
  const toastOnArrival = options.toastOnArrival ?? true;

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchCardShares();
    setLoading(false);
    setLoaded(true);
    if (!next) return;
    setPage(next);

    if (!initializedRef.current) lastSeenRef.current = readLastSeen();
    const stamps = next.received.map((s) => Date.parse(s.updatedAt) || 0);
    const highest = Math.max(lastSeenRef.current, ...stamps);
    if (initializedRef.current && toastOnArrival) {
      for (const share of next.received) {
        const at = Date.parse(share.updatedAt) || 0;
        if (at <= lastSeenRef.current || share.openedAt) continue;
        toast(`${share.user.name} shared "${share.title}" with you`, {
          description: share.message ?? undefined,
          action: onOpenRef.current ? { label: "Open", onClick: () => onOpenRef.current?.(share) } : undefined,
        });
      }
    }
    initializedRef.current = true;
    lastSeenRef.current = highest;
    writeLastSeen(highest);
  }, [toastOnArrival]);

  useEffect(() => {
    if (!enabled) {
      setPage(EMPTY);
      setLoaded(false);
      initializedRef.current = false;
      return;
    }
    void refresh();
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, refresh]);

  const share = useCallback(
    async (input: ShareCardInput) => {
      const result = await shareCard(input);
      await refresh();
      return result;
    },
    [refresh],
  );

  const markOpened = useCallback(
    async (entry: CardShareEntry) => {
      if (entry.openedAt) return;
      await markCardShareOpened(entry.id);
      setPage((prev) => ({
        ...prev,
        received: prev.received.map((s) =>
          s.id === entry.id ? { ...s, openedAt: new Date().toISOString() } : s,
        ),
      }));
    },
    [],
  );

  const remove = useCallback(
    async (id: number) => {
      await removeCardShare(id);
      await refresh();
    },
    [refresh],
  );

  return {
    ...page,
    loading,
    loaded,
    unopenedCount: page.received.filter((s) => !s.openedAt).length,
    refresh,
    share,
    markOpened,
    remove,
  };
}
