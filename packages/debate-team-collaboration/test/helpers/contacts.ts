/**
 * @fileoverview Fixtures for the contacts and shared-cards panels: users,
 * contact rows, shares, and stand-ins for the `useContacts` /
 * `useCardShares` results the panels accept as props.
 */
import { vi } from "vitest";
import type { ContactUser } from "../../src/lib/contacts";
import type { ContactEntry } from "../../src/state/contacts";
import type { CardShareEntry } from "../../src/state/cardShares";
import type { UseContactsResult } from "../../src/hooks/useContacts";
import type { UseCardSharesResult } from "../../src/hooks/useCardShares";

const ROOM = "0123456789abcdef0123456789abcdef";
/** A valid first-generation share code (32-byte key as 43 base64url chars). */
export const SHARE_CODE = `cmshare1.${ROOM}.${"A".repeat(43)}`;

export function user(id: string, name = id[0].toUpperCase() + id.slice(1)): ContactUser {
  return { id, name, email: `${id}@example.com`, image: null };
}

export function contact(id: number, who: ContactUser, online = false): ContactEntry {
  return { id, user: who, online, lastSeenAt: null, since: "2026-01-01T00:00:00.000Z" };
}

export function share(id: number, who: ContactUser, overrides: Partial<CardShareEntry> = {}): CardShareEntry {
  return {
    id,
    user: who,
    roomId: ROOM,
    shareCode: SHARE_CODE,
    guestPass: null,
    title: `Card ${id}`,
    message: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    openedAt: null,
    ...overrides,
  };
}

export function fakeContacts(overrides: Partial<UseContactsResult> = {}): UseContactsResult {
  return {
    organization: null,
    contacts: [],
    incoming: [],
    outgoing: [],
    blocked: [],
    loading: false,
    loaded: true,
    refresh: vi.fn(async () => {}),
    request: vi.fn(async () => ({ status: "requested" as const })),
    accept: vi.fn(async () => {}),
    decline: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    block: vi.fn(async () => {}),
    unblock: vi.fn(async () => {}),
    ...overrides,
  };
}

export function fakeShares(overrides: Partial<UseCardSharesResult> = {}): UseCardSharesResult {
  const received = overrides.received ?? [];
  return {
    received,
    sent: [],
    loading: false,
    loaded: true,
    unopenedCount: received.filter((entry) => !entry.openedAt).length,
    refresh: vi.fn(async () => {}),
    share: vi.fn(async () => ({ shared: ["bob"], skipped: [] as string[] })),
    markOpened: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    ...overrides,
  };
}
