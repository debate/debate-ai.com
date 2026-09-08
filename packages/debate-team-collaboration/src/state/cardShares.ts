/**
 * @fileoverview Network calls for collab-card shares (`apps/debate-ai.com`'s
 * `/api/card-shares`) — a CardMirror co-editing session's share code + guest
 * pass handed from one account to a contact, so it shows up as available on
 * the recipient's account instead of only on whichever clipboard the invite
 * link was pasted into. Backs `useCardShares` and `SharedCardsPanel`.
 *
 * Same `401` → `null` read / throwing write conventions as `state/contacts.ts`.
 *
 * @module state/cardShares
 */

import type { ContactUser } from "../lib/contacts";

/** A share as either side sees it: `user` is the other party. */
export interface CardShareEntry {
  id: number;
  /** The other account — the owner on a received share, the recipient on a sent one. */
  user: ContactUser;
  roomId: string;
  shareCode: string;
  guestPass: string | null;
  title: string;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  /** Recipient's first open; null while the share is still "new". */
  openedAt: string | null;
}

export interface CardSharesPage {
  /** Shares addressed to the signed-in user (revoked ones excluded). */
  received: CardShareEntry[];
  /** Shares the signed-in user sent that are still live. */
  sent: CardShareEntry[];
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Fetches shares received and sent. `null` when signed out or on failure. */
export async function fetchCardShares(endpoint = "/api/card-shares"): Promise<CardSharesPage | null> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as CardSharesPage;
  } catch (error) {
    console.error("Unable to load shared cards:", error);
    return null;
  }
}

export interface ShareCardInput {
  /** `cmshare…` code (the server validates the format and derives the room id). */
  shareCode: string;
  guestPass?: string | null;
  title?: string;
  message?: string | null;
  /** Accepted contacts to share with; anyone who isn't one is reported in `skipped`. */
  recipientIds: string[];
}

export interface ShareCardResult {
  /** Ids of recipients the share reached (new or refreshed). */
  shared: string[];
  /** Ids refused — not a contact, blocked, or unknown. */
  skipped: string[];
}

/** Shares a live card with one or more contacts. Throws on a malformed code or when signed out. */
export async function shareCard(input: ShareCardInput, endpoint = "/api/card-shares"): Promise<ShareCardResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Could not share that card."));
  return (await res.json()) as ShareCardResult;
}

/** Recipient-side: records the first open (clears the "new" badge). Best-effort; never throws. */
export async function markCardShareOpened(id: number, endpoint = "/api/card-shares"): Promise<void> {
  try {
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: "opened" }),
    });
  } catch {
    /* the open itself already happened; the badge just stays until the next one */
  }
}

/** Owner: stops sharing (the recipient loses it). Recipient: removes it from their own list. */
export async function removeCardShare(id: number, endpoint = "/api/card-shares"): Promise<void> {
  const res = await fetch(`${endpoint}?id=${encodeURIComponent(String(id))}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Could not remove that share."));
}
