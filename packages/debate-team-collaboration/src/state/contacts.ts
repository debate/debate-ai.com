/**
 * @fileoverview Network calls for the account-linked contacts list
 * (`apps/debate-ai.com`'s `/api/contacts` and `/api/contacts/block`) — the
 * request/accept/block graph `ContactsPanel` renders and `useContacts` polls.
 *
 * Same conventions as `state/accountNotifications.ts`: reads resolve `null`
 * when signed out (a `401`) or on any request failure, writes throw with the
 * server's `error` message so the panel can toast it.
 *
 * @module state/contacts
 */

import type { ContactUser } from "../lib/contacts";

/** One row of the contacts list: the other account plus its live-presence flag. */
export interface ContactEntry {
  /** The `contacts` row id — what accept/decline/remove address. */
  id: number;
  user: ContactUser;
  /** Inside `PRESENCE_ONLINE_WINDOW_MS` of their last `/api/contacts` poll. */
  online: boolean;
  /** ISO timestamp of their last poll, or null if they've never loaded the list. */
  lastSeenAt: string | null;
  /** ISO timestamp the pair was created (request sent) / accepted. */
  since: string;
}

/** A pending request, in either direction. */
export interface ContactRequestEntry {
  id: number;
  user: ContactUser;
  createdAt: string;
}

/** An account the viewer has blocked. */
export interface BlockedEntry {
  user: ContactUser;
  createdAt: string;
}

export interface ContactsPage {
  contacts: ContactEntry[];
  incoming: ContactRequestEntry[];
  outgoing: ContactRequestEntry[];
  blocked: BlockedEntry[];
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function postJson(url: string, method: string, body: unknown, fallback: string): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, fallback));
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetches the signed-in user's contacts, pending requests, and block list. `null` when signed out or on failure. */
export async function fetchContacts(endpoint = "/api/contacts"): Promise<ContactsPage | null> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as ContactsPage;
  } catch (error) {
    console.error("Unable to load contacts:", error);
    return null;
  }
}

export type SendContactRequestResult =
  | { status: "requested" }
  | { status: "accepted" }
  | { status: "already-requested" }
  | { status: "already-contacts" };

/**
 * Sends a contact request to a user id or an email address. Resolves with
 * what the server did — a request at someone who already asked you is
 * accepted on the spot. Throws (with the server's message) when refused.
 */
export async function sendContactRequest(
  target: { userId: string } | { email: string },
  endpoint = "/api/contacts",
): Promise<SendContactRequestResult> {
  return (await postJson(endpoint, "POST", target, "Could not send that contact request.")) as SendContactRequestResult;
}

/** Accepts an incoming request by its row id. */
export async function acceptContactRequest(id: number, endpoint = "/api/contacts"): Promise<void> {
  await postJson(endpoint, "PATCH", { id, action: "accept" }, "Could not accept that request.");
}

/** Declines an incoming request by its row id. */
export async function declineContactRequest(id: number, endpoint = "/api/contacts"): Promise<void> {
  await postJson(endpoint, "PATCH", { id, action: "decline" }, "Could not decline that request.");
}

/** Removes an accepted contact, or cancels an outgoing request, by row id. */
export async function removeContact(id: number, endpoint = "/api/contacts"): Promise<void> {
  const res = await fetch(`${endpoint}?id=${encodeURIComponent(String(id))}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Could not remove that contact."));
}

/** Blocks a user id: drops any contact row and revokes any shares between you, both ways. */
export async function blockUser(userId: string, endpoint = "/api/contacts/block"): Promise<void> {
  await postJson(endpoint, "POST", { userId }, "Could not block that user.");
}

/** Lifts a block. The old contact row is not restored — send a fresh request. */
export async function unblockUser(userId: string, endpoint = "/api/contacts/block"): Promise<void> {
  await postJson(endpoint, "DELETE", { userId }, "Could not unblock that user.");
}

/** Registered-user lookup for the "add a contact" search box (the app's existing `/api/users/search`). */
export async function searchUsers(query: string, endpoint = "/api/users/search"): Promise<ContactUser[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const payload = (await res.json()) as { users?: ContactUser[] };
    return Array.isArray(payload.users) ? payload.users : [];
  } catch {
    return [];
  }
}
