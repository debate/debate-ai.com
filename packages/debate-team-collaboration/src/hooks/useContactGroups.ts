/**
 * @fileoverview The signed-in user's contact groups and the actions over
 * them. Unlike `useContacts` there is no poll: groups only change when this
 * user edits them, so every mounted copy refetches on a shared
 * `CONTACT_GROUPS_CHANGED_EVENT` instead (the share dialog's chips follow an
 * edit made in the manage-contacts modal).
 *
 * @module hooks/useContactGroups
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createContactGroup,
  deleteContactGroup,
  fetchContactGroups,
  updateContactGroup,
  type ContactGroup,
} from "../state/contactGroups";

/** Fired on `window` after any group write so every `useContactGroups` copy refetches. */
export const CONTACT_GROUPS_CHANGED_EVENT = "debate:contact-groups-changed";

export interface UseContactGroupsResult {
  groups: ContactGroup[];
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
  create: (input: { name: string; memberIds?: string[] }) => Promise<ContactGroup | null>;
  update: (input: { id: number; name?: string; memberIds?: string[] }) => Promise<ContactGroup | null>;
  remove: (id: number) => Promise<void>;
}

export function useContactGroups(enabled: boolean): UseContactGroupsResult {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchContactGroups();
    setLoading(false);
    setLoaded(true);
    if (next) setGroups(next);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setGroups([]);
      setLoaded(false);
      return;
    }
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(CONTACT_GROUPS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(CONTACT_GROUPS_CHANGED_EVENT, onChanged);
  }, [enabled, refresh]);

  const after = useCallback(async <T,>(work: Promise<T>): Promise<T> => {
    const result = await work;
    window.dispatchEvent(new Event(CONTACT_GROUPS_CHANGED_EVENT));
    return result;
  }, []);

  return {
    groups,
    loading,
    loaded,
    refresh,
    create: useCallback((input) => after(createContactGroup(input)), [after]),
    update: useCallback((input) => after(updateContactGroup(input)), [after]),
    remove: useCallback((id) => after(deleteContactGroup(id)), [after]),
  };
}
