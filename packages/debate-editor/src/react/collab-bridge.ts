/**
 * Collaboration bridge for React hosts (the debate-ai.com app).
 *
 * The engine's collab flows are wired to ribbon commands and the pairing
 * pills inside `editor/index.ts`; an embedding page has no handle on any
 * of that. This module is that handle — a thin, Loro-free layer over the
 * `collab-hooks` seams so the app's own UI (the /reason-editor "Share with
 * contacts" control, the /contacts "Open" button) can:
 *
 *   - read the live session's share code + guest pass for the focused doc
 *     (exactly what the editor's own invite link carries), so the app can
 *     hand them to a contact through its own server instead of the
 *     clipboard;
 *   - start a session programmatically (same confirm + flow as the Start
 *     Collaboration Session command) and get that share back;
 *   - join a share by code + guest pass (same flow as pasting an invite
 *     link), so a card a contact shared opens in place.
 *
 * Only the always-loaded seams are imported here; the heavy collab
 * module still loads lazily, on first use, exactly as it does for the
 * ribbon. Every function is a no-op (null/false) until the singleton
 * engine has booted, which `CardMirrorEditor` guarantees before any
 * user-driven call can happen.
 */

import {
  collabActiveShareCode,
  collabActiveInviteLink,
  collabInviteJoiner,
  collabSessionStarter,
  collabLiveSessionCount,
} from '../editor/collab/collab-hooks.js';
import { collabEnabled } from '../editor/collab/collab-gate.js';
import { parseJoinLinkHash } from '../editor/collab/join-link.js';
import { settings } from '../editor/settings.js';

export interface CollabShare {
  /** `cmshare1.<roomId>.<key>` (or the v2 form) — the room + its E2E key. */
  shareCode: string;
  /** The relay's account-less join credential, when the room minted one. */
  guestPass: string | null;
  /** The full invite link the editor's own Copy Invite Link produces. */
  inviteLink: string | null;
}

/** Whether collaboration surfaces exist on this host at all (closed on the mobile shell and Lite builds). */
export function collabAvailable(): boolean {
  try {
    return collabEnabled();
  } catch {
    return false;
  }
}

/** The focused document's live session share, or null when it has none. */
export function activeCollabShare(): CollabShare | null {
  const shareCode = collabActiveShareCode();
  if (!shareCode) return null;
  const inviteLink = collabActiveInviteLink();
  const fromLink = inviteLink ? parseJoinLinkHash(inviteLink.slice(inviteLink.indexOf('#'))) : null;
  return { shareCode, guestPass: fromLink?.guestPass ?? null, inviteLink };
}

/** Whether the engine has booted far enough to register its collab seams
 *  (start/join). False until `editor/index.ts` has run — the React host
 *  polls this before a programmatic join so a page that lands with a
 *  share to open doesn't race the singleton's boot. */
export function collabSeamsReady(): boolean {
  return collabInviteJoiner() !== null && collabSessionStarter() !== null;
}

/** True while ANY session is live in this window. */
export function anyCollabSessionLive(): boolean {
  return collabLiveSessionCount() > 0;
}

/**
 * Start a co-editing session on the focused document — the same
 * confirm-and-mint flow as the Start Collaboration Session command (the
 * user still sees the confirm; a "no" resolves null). Resolves with the new
 * session's share, or null when the flow was declined, unavailable, or the
 * doc already had one (in which case `activeCollabShare()` has it).
 *
 * Flips the 'Enable collaboration' master toggle on if it was off: the
 * caller is an explicit share action, which IS the opt-in.
 */
export async function startCollabSession(): Promise<CollabShare | null> {
  if (!collabAvailable()) return null;
  const existing = activeCollabShare();
  if (existing) return existing;
  const starter = collabSessionStarter();
  if (!starter) return null;
  try {
    if (!settings.get('pairingEnabled')) settings.set('pairingEnabled', true);
  } catch {
    /* settings store unavailable — the flow itself still works */
  }
  await starter();
  return activeCollabShare();
}

/**
 * Join a shared card by share code (+ guest pass). Same flow as pasting an
 * invite link: the user confirms, the focused doc is replaced by the
 * room's document, and the session goes live. Resolves true when the join
 * landed (false when cancelled, unavailable, or the room is gone).
 */
export async function joinCollabShare(shareCode: string, guestPass: string | null): Promise<boolean> {
  if (!collabAvailable()) return false;
  const joiner = collabInviteJoiner();
  if (!joiner) return false;
  try {
    if (!settings.get('pairingEnabled')) settings.set('pairingEnabled', true);
  } catch {
    /* see startCollabSession */
  }
  return joiner(shareCode, { guestPass });
}

/**
 * Seed the presence/comment display name from the signed-in account when
 * the user hasn't set one themselves — so a contact sees "Alex Kim" at the
 * partner cursor instead of "Guest 412". Never overwrites a name the user
 * typed into settings; returns whether it wrote anything.
 */
export function seedCollabDisplayName(name: string): boolean {
  const clean = name.trim();
  if (!clean) return false;
  try {
    if (settings.get('pairingDisplayName').trim()) return false;
    settings.set('pairingDisplayName', clean);
    return true;
  } catch {
    return false;
  }
}
