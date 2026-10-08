/**
 * @fileoverview Polls account-linked notifications and toasts newly-arrived
 * ones — the dock Settings menu's "Notifications" entry/unread badge and
 * the toast half of TODO.md's "implement user notifs with toast" ask. Reads
 * through `state/accountNotifications.ts`.
 *
 * Only polls while `enabled` (the caller passes `isAuthenticated` — no
 * session, no notifications) and the tab is visible, on a plain interval:
 * this repo has no push/websocket infrastructure, so "live" here means
 * "checked every `POLL_INTERVAL_MS`", the same best-effort tradeoff TODO.md
 * already documents for the streak-risk banner (idea near "in-app-banner-
 * only, not a real push notification").
 *
 * A notification only toasts once: the highest `id` seen is persisted to
 * `localStorage` (ids are an autoincrement column, so purely increasing),
 * and only notifications above that watermark toast, and only after the
 * first load has established a watermark — so signing in with a backlog of
 * old unread notifications doesn't fire a toast storm, but anything that
 * arrives after does.
 *
 * @module hooks/useAccountNotifications
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  fetchAccountNotifications,
  markAccountNotificationRead,
  markAllAccountNotificationsRead,
  type AccountNotification,
} from "../state/accountNotifications";
import { createSharedFetch } from "../lib/shared-fetch";

const POLL_INTERVAL_MS = 30_000;

/**
 * Every mounted copy (the dock's, the sidebar account menu's) polls on its own
 * interval, so a tick within this long of another copy's reuses its request
 * rather than sending another (see `lib/shared-fetch`).
 */
const fetchNotificationsShared = createSharedFetch(() => fetchAccountNotifications(), POLL_INTERVAL_MS - 2_000);

/**
 * Fired on `window` after a notification is marked read from any instance of
 * this hook, so every other instance (the dock's, the sidebar account menu's
 * badge) refetches at once instead of on its next poll.
 */
export const NOTIFICATIONS_CHANGED_EVENT = "debate:notifications-changed";

export interface UseAccountNotificationsOptions {
  /**
   * Toast notifications that arrive after the first load (default true).
   * Only one mounted instance should toast — the dock's — or each arrival
   * would toast once per instance.
   */
  toastOnArrival?: boolean;
}
const LAST_SEEN_STORAGE_KEY = "accountNotifications:lastSeenId";

export interface UseAccountNotificationsResult {
  notifications: AccountNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

function readLastSeenId(): number {
  if (typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem(LAST_SEEN_STORAGE_KEY)) || 0;
}

function writeLastSeenId(id: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LAST_SEEN_STORAGE_KEY, String(id));
}

/**
 * Polls the signed-in user's account notifications every
 * {@link POLL_INTERVAL_MS} while `enabled`, toasting any that arrive after
 * the first load (see module doc for the watermark rule).
 */
export function useAccountNotifications(
  enabled: boolean,
  { toastOnArrival = true }: UseAccountNotificationsOptions = {},
): UseAccountNotificationsResult {
  const [notifications, setNotifications] = useState<AccountNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const lastSeenIdRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const router = useRouter();

  const load = useCallback(async (force = false) => {
    setLoading(true);
    const page = await fetchNotificationsShared(force);
    setLoading(false);
    if (!page) return;

    setNotifications(page.notifications);
    setUnreadCount(page.unreadCount);

    if (!initializedRef.current) {
      lastSeenIdRef.current = readLastSeenId();
    }

    const highestId = page.notifications.reduce((max, n) => Math.max(max, n.id), lastSeenIdRef.current);

    if (initializedRef.current && toastOnArrival) {
      const fresh = page.notifications.filter((n) => n.id > lastSeenIdRef.current);
      for (const notification of fresh) {
        toast(notification.title, {
          description: notification.body ?? undefined,
          action: notification.link
            ? { label: "View", onClick: () => router.push(notification.link!) }
            : undefined,
        });
      }
    }

    initializedRef.current = true;
    lastSeenIdRef.current = highestId;
    if (toastOnArrival) writeLastSeenId(highestId);
  }, [router, toastOnArrival]);

  useEffect(() => {
    if (!enabled) {
      // Signed out: a request made for the last account must not be reused.
      fetchNotificationsShared.reset();
      return;
    }
    void load();
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void load();
    }, POLL_INTERVAL_MS);
    const onChanged = () => void load();
    if (typeof window !== "undefined") window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [enabled, load]);

  // The event reloads every mounted instance, this one included. Dropping
  // the shared request first makes the first of them fetch the new state and
  // the rest share that one request.
  const announce = useCallback(async () => {
    fetchNotificationsShared.reset();
    if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    else await load(true);
  }, [load]);

  const markRead = useCallback(
    async (id: number) => {
      await markAccountNotificationRead(id);
      await announce();
    },
    [announce],
  );

  const markAllRead = useCallback(async () => {
    await markAllAccountNotificationsRead();
    await announce();
  }, [announce]);

  const refresh = useCallback(() => load(true), [load]);

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead };
}
