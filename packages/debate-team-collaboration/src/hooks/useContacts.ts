/**
 * @fileoverview Polls the signed-in user's contacts list and exposes the
 * request/accept/decline/remove/block actions over it. Mirrors
 * `useAccountNotifications`'s cadence — a plain interval while `enabled` and
 * the tab is visible (no push channel exists in this repo) — and the same
 * poll doubles as the presence heartbeat the server records (see
 * `user_presence` in the app schema), which is what makes contacts show as
 * online for each other.
 *
 * @module hooks/useContacts
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  acceptContactRequest,
  blockUser,
  declineContactRequest,
  fetchContacts,
  removeContact,
  sendContactRequest,
  unblockUser,
  type ContactsPage,
  type SendContactRequestResult,
} from "../state/contacts";

const POLL_INTERVAL_MS = 30_000;

const EMPTY: ContactsPage = { contacts: [], incoming: [], outgoing: [], blocked: [] };

export interface UseContactsResult extends ContactsPage {
  loading: boolean;
  /** True once the first load has resolved (even to an empty page). */
  loaded: boolean;
  refresh: () => Promise<void>;
  request: (target: { userId: string } | { email: string }) => Promise<SendContactRequestResult>;
  accept: (id: number) => Promise<void>;
  decline: (id: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
}

/** Polls `/api/contacts` every {@link POLL_INTERVAL_MS} while `enabled`; every action refreshes the list on success. */
export function useContacts(enabled: boolean): UseContactsResult {
  const [page, setPage] = useState<ContactsPage>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchContacts();
    setLoading(false);
    setLoaded(true);
    if (next) setPage(next);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPage(EMPTY);
      setLoaded(false);
      return;
    }
    void refresh();
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, refresh]);

  const after = useCallback(
    async <T,>(work: Promise<T>): Promise<T> => {
      const result = await work;
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    ...page,
    loading,
    loaded,
    refresh,
    request: useCallback((target) => after(sendContactRequest(target)), [after]),
    accept: useCallback((id) => after(acceptContactRequest(id)), [after]),
    decline: useCallback((id) => after(declineContactRequest(id)), [after]),
    remove: useCallback((id) => after(removeContact(id)), [after]),
    block: useCallback((userId) => after(blockUser(userId)), [after]),
    unblock: useCallback((userId) => after(unblockUser(userId)), [after]),
  };
}
