/**
 * Session invite links (web-collab Phase 3).
 *
 * A join link is the share code plus (when the relay minted one) the
 * room's guest pass, packed into the URL FRAGMENT — never the query —
 * because the share code carries the room's E2E encryption key and
 * fragments are not sent to any server, don't hit logs, and don't
 * leak through referrers:
 *
 *   https://cardmirror.app/#join=<shareCode>&pass=<guestPass>
 *
 * The pass is what lets a browser with no account and no token join:
 * the relay accepts it on room-data endpoints (see relay_auth's guest
 * passes). A link without a pass still works for joiners who hold
 * their own credentials (desktop builds, linked accounts).
 *
 * The boot handler clears the fragment immediately after parsing —
 * the room key shouldn't linger in the address bar or history.
 */

export const JOIN_LINK_ORIGIN = 'https://cardmirror.app';

export interface JoinLinkParts {
  shareCode: string;
  guestPass: string | null;
}

export function buildJoinLink(parts: JoinLinkParts, origin = JOIN_LINK_ORIGIN): string {
  const frag = new URLSearchParams();
  frag.set('join', parts.shareCode);
  if (parts.guestPass) frag.set('pass', parts.guestPass);
  return `${origin.replace(/\/+$/, '')}/#${frag.toString()}`;
}

/** Parse a location fragment (with or without the leading '#').
 *  Null when it isn't a join link; tolerant of extra params. */
export function parseJoinLinkHash(hash: string): JoinLinkParts | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }
  const shareCode = (params.get('join') ?? '').trim();
  if (!shareCode.startsWith('cmshare')) return null;
  const pass = (params.get('pass') ?? '').trim();
  return { shareCode, guestPass: pass || null };
}
