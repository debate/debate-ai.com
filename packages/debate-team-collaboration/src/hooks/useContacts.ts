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
  ORGANIZATION_CHANGED_EVENT,
  type ContactsPage,
  type SendContactRequestResult,
} from "../state/contacts";
import { createSharedFetch } from "../lib/shared-fetch";

const POLL_INTERVAL_MS = 30_000;

/**
 * Every mounted copy (the dock's presence heartbeat, the contacts page, the
 * share dialog) polls on its own interval, so a tick within this long of
 * another copy's reuses its request (see `lib/shared-fetch`).
 */
const fetchContactsShared = createSharedFetch(() => fetchContacts(), POLL_INTERVAL_MS - 2_000);

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

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    const next = await fetchContactsShared(force);
    setLoading(false);
    setLoaded(true);
    if (next) setPage(next);
  }, []);
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    if (!enabled) {
      // Signed out: a request made for the last account must not be reused.
      fetchContactsShared.reset();
      setPage(EMPTY);
      setLoaded(false);
      return;
    }
    void load(false);
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void load(false);
    }, POLL_INTERVAL_MS);
    // Switching organization changes who the contacts are.
    const onOrganizationChanged = () => void refresh();
    if (typeof window !== "undefined") window.addEventListener(ORGANIZATION_CHANGED_EVENT, onOrganizationChanged);
    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") window.removeEventListener(ORGANIZATION_CHANGED_EVENT, onOrganizationChanged);
    };
  }, [enabled, load, refresh]);

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
