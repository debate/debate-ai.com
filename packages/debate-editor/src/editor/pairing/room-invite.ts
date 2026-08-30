/**
 * Session invites over the pairing mailbox (plan §5.2).
 *
 * An invite is a normal sealed pairing message whose item carries a
 * `room-invite` payload instead of a card slice — the share code (room
 * id + key) rides in `sliceJson`, which both the desktop main process
 * and the inbox pass through verbatim, so no main-process schema change
 * is needed. The envelope's per-message `minReceiverVersion` floor keeps
 * old clients on the existing "update required" path instead of showing
 * them a card row they can't act on.
 *
 * Zero collab/Loro imports: the Receive pill must recognize invites
 * without pulling in the lazy collab module.
 */

import type { SendItem } from './relay-client.js';
import type { InboxItem } from './inbox-store.js';

export const ROOM_INVITE_ITEM_TYPE = 'room-invite';

/** First app version whose Receive pill understands `room-invite`
 *  items. Envelopes carry this as their compatibility floor, so older
 *  clients drop the invite with the version-mismatch toast rather than
 *  rendering a dead card row. Keep in sync with the release that ships
 *  invite support. */
import { MOVABLE_ROOMS_MIN_VERSION } from '../relay-protocol.js';

export const ROOM_INVITE_MIN_VERSION = '0.1.0-beta.8';

/** The invite's compatibility floor for a given room format. Movable
 *  rooms require the movable-capable build — an older client joining
 *  one could not materialize its children at all, so it must decline
 *  the invite (existing minReceiverVersion UX) rather than import. */
export function roomInviteFloor(format: 'movable' | 'list'): string {
  return format === 'movable' ? MOVABLE_ROOMS_MIN_VERSION : ROOM_INVITE_MIN_VERSION;
}

export interface RoomInvitePayload {
  /** `cmshare1.<roomId>.<key>` (or `cmshare2.….<minVersion>` for
   *  versioned rooms) — everything a client needs to join. */
  shareCode: string;
  /** Host's doc title at invite time, for the pill row ('' if unknown). */
  title: string;
}

export function buildRoomInviteItem(payload: RoomInvitePayload): SendItem {
  return {
    label: payload.title || 'Collaboration session',
    type: ROOM_INVITE_ITEM_TYPE,
    sliceJson: { shareCode: payload.shareCode, title: payload.title },
  };
}

/** Payload of an inbox invite row, or null when the item isn't a
 *  (well-formed) invite. */
export function parseRoomInvite(item: Pick<InboxItem, 'type' | 'sliceJson'>): RoomInvitePayload | null {
  if (item.type !== ROOM_INVITE_ITEM_TYPE) return null;
  const p = item.sliceJson;
  if (!p || typeof p !== 'object') return null;
  const shareCode = (p as Record<string, unknown>)['shareCode'];
  // Both code generations classify as invites. v1-only here demoted
  // every movable-room invite to a generic "Item" row with no Join
  // button (live find, 2026-08-14) — the minReceiverVersion floor on
  // the envelope, not this parse, is what keeps old builds out.
  if (typeof shareCode !== 'string' || !/^cmshare[12]\./.test(shareCode)) return null;
  const title = (p as Record<string, unknown>)['title'];
  return { shareCode, title: typeof title === 'string' ? title : '' };
}
