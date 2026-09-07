/**
 * @fileoverview Pure rules for the account-linked contacts list and the
 * collab-card shares that ride on it — the framework-free half of
 * `apps/debate-ai.com`'s `/api/contacts`, `/api/contacts/block`, and
 * `/api/card-shares` routes and of `ContactsPanel`/`SharedCardsPanel`.
 *
 * Everything here is keyed by better-auth `user.id`s. The relationship
 * between two accounts is derived from at most one `contacts` row (in either
 * direction) plus up to two `user_blocks` rows (one per direction); the
 * request state machine below decides what a "send request" does given that
 * state, so the route and the tests agree on every transition.
 *
 * Share codes are the CardMirror editor's `cmshare1.<roomId>.<key>` (or
 * `cmshare2.<roomId>.<key>.<minVersion>`) format from
 * `packages/debate-editor/src/editor/collab/collab-crypto.ts`; the parser
 * here is format-only (it never touches the key) so the server can pull the
 * room id out of a code without importing the editor bundle.
 *
 * @module lib/contacts
 */

/** The public shape of another account, as every contacts/share endpoint returns it. */
export interface ContactUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/** One `contacts` row. */
export interface ContactPair {
  id: number;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted";
}

/** One `user_blocks` row. */
export interface BlockPair {
  blockerId: string;
  blockedId: string;
}

/**
 * How `viewerId` relates to `targetId`:
 * - `self` — same account.
 * - `contact` — an accepted pair.
 * - `outgoing` — the viewer's request is waiting on the target.
 * - `incoming` — the target's request is waiting on the viewer.
 * - `blocked` — the viewer has blocked the target.
 * - `blocked-by` — the target has blocked the viewer.
 * - `none` — no row in either direction.
 *
 * A block in either direction wins over any contact row (blocking deletes
 * the row anyway, but a stale read must still come out as blocked).
 */
export type ContactRelationship =
  | "self"
  | "contact"
  | "outgoing"
  | "incoming"
  | "blocked"
  | "blocked-by"
  | "none";

/** Derives the relationship from the rows touching both ids (extra rows are ignored). */
export function deriveRelationship(
  viewerId: string,
  targetId: string,
  pairs: readonly ContactPair[],
  blocks: readonly BlockPair[],
): ContactRelationship {
  if (viewerId === targetId) return "self";
  if (blocks.some((b) => b.blockerId === viewerId && b.blockedId === targetId)) return "blocked";
  if (blocks.some((b) => b.blockerId === targetId && b.blockedId === viewerId)) return "blocked-by";
  const pair = findPair(viewerId, targetId, pairs);
  if (!pair) return "none";
  if (pair.status === "accepted") return "contact";
  return pair.requesterId === viewerId ? "outgoing" : "incoming";
}

/** The one `contacts` row between two ids, in either direction, or `null`. */
export function findPair(
  a: string,
  b: string,
  pairs: readonly ContactPair[],
): ContactPair | null {
  return (
    pairs.find(
      (p) =>
        (p.requesterId === a && p.addresseeId === b) ||
        (p.requesterId === b && p.addresseeId === a),
    ) ?? null
  );
}

/**
 * What sending a contact request should do, given the current relationship:
 * - `create` — insert a pending row.
 * - `accept` — the target already asked; the request is a mutual accept.
 * - `noop` — already pending from us, or already contacts: nothing to change.
 * - `reject` — refused (self, or a block in either direction). `reason` is
 *   the user-facing message; a block by the target is reported with the same
 *   generic wording as any other refusal so blocking stays invisible to the
 *   person blocked.
 */
export type ContactRequestOutcome =
  | { action: "create" }
  | { action: "accept" }
  | { action: "noop"; relationship: "outgoing" | "contact" }
  | { action: "reject"; reason: string };

export const CONTACT_REQUEST_REFUSED_MESSAGE = "You can't send a contact request to this user.";

export function resolveContactRequest(relationship: ContactRelationship): ContactRequestOutcome {
  switch (relationship) {
    case "none":
      return { action: "create" };
    case "incoming":
      return { action: "accept" };
    case "outgoing":
    case "contact":
      return { action: "noop", relationship };
    case "self":
      return { action: "reject", reason: "You can't add yourself as a contact." };
    case "blocked":
      return { action: "reject", reason: "Unblock this user before sending them a contact request." };
    case "blocked-by":
      return { action: "reject", reason: CONTACT_REQUEST_REFUSED_MESSAGE };
  }
}

/** Whether `ownerId` may share a card with `recipientId`: accepted contacts only, never across a block. */
export function canShareWith(relationship: ContactRelationship): boolean {
  return relationship === "contact";
}

// ── Share codes / invite links ──────────────────────────────────────────

/** Matches the editor's `cmshare1.<roomId>.<key>` and `cmshare2.<roomId>.<key>.<minVersion>` codes. */
const SHARE_CODE_PATTERN = /^cmshare([12])\.([0-9a-f]{16,64})\.([A-Za-z0-9_-]{43})(?:\.(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?))?$/;

export interface ParsedShareCode {
  shareCode: string;
  roomId: string;
  /** Set on v2 codes: the minimum editor version that can join the room. */
  minVersion: string | null;
}

/**
 * Validates a share code's format and pulls the room id out of it. `null`
 * for anything that isn't a well-formed code (a v1 code with a version
 * suffix, a v2 code without one, a room id that isn't hex, a key that isn't
 * 32 base64url bytes). Never decodes the key.
 */
export function parseShareCode(input: string): ParsedShareCode | null {
  const code = input.trim();
  const match = SHARE_CODE_PATTERN.exec(code);
  if (!match) return null;
  const [, generation, roomId, , minVersion] = match;
  if (generation === "1" && minVersion) return null;
  if (generation === "2" && !minVersion) return null;
  return { shareCode: code, roomId, minVersion: minVersion ?? null };
}

export interface ParsedInvite extends ParsedShareCode {
  guestPass: string | null;
}

/**
 * Accepts what a host has on their clipboard after "Start Session" — either
 * the bare share code or a full `…/#join=<code>&pass=<guestPass>` invite
 * link (see `packages/debate-editor/src/editor/collab/join-link.ts`) — and
 * returns the code plus the guest pass when the link carried one.
 */
export function parseInviteInput(input: string): ParsedInvite | null {
  const text = input.trim();
  if (!text) return null;
  const hashIdx = text.indexOf("#");
  if (hashIdx >= 0) {
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(text.slice(hashIdx + 1));
    } catch {
      return null;
    }
    const parsed = parseShareCode(params.get("join") ?? "");
    if (!parsed) return null;
    const pass = (params.get("pass") ?? "").trim();
    return { ...parsed, guestPass: pass || null };
  }
  const parsed = parseShareCode(text);
  return parsed ? { ...parsed, guestPass: null } : null;
}

/** Builds the invite link the editor's own "Copy Invite Link" produces, for a share's Open button fallback. */
export function buildInviteLink(
  shareCode: string,
  guestPass: string | null,
  origin: string,
): string {
  const frag = new URLSearchParams();
  frag.set("join", shareCode);
  if (guestPass) frag.set("pass", guestPass);
  return `${origin.replace(/\/+$/, "")}/#${frag.toString()}`;
}

export const MAX_CARD_SHARE_TITLE_LENGTH = 200;
export const MAX_CARD_SHARE_MESSAGE_LENGTH = 500;

/** Trims and caps a shared card's display title; empty falls back to the editor's own default. */
export function normalizeCardShareTitle(title: unknown): string {
  const text = typeof title === "string" ? title.trim() : "";
  return (text || "Untitled document").slice(0, MAX_CARD_SHARE_TITLE_LENGTH);
}

/** Trims and caps an optional note attached to a share; `null` when blank. */
export function normalizeCardShareMessage(message: unknown): string | null {
  const text = typeof message === "string" ? message.trim() : "";
  return text ? text.slice(0, MAX_CARD_SHARE_MESSAGE_LENGTH) : null;
}

// ── Presence ────────────────────────────────────────────────────────────

/**
 * How recent a `user_presence.last_seen_at` has to be to count as online.
 * The contacts poll (`useContacts`) runs every 30s while the tab is visible,
 * so two minutes tolerates a missed tick or two without flapping.
 */
export const PRESENCE_ONLINE_WINDOW_MS = 2 * 60 * 1000;

/** Whether a last-seen timestamp (Date, ISO string, or epoch ms) is inside the online window. */
export function isPresenceOnline(
  lastSeenAt: Date | string | number | null | undefined,
  now: number = Date.now(),
): boolean {
  if (lastSeenAt == null) return false;
  const seen =
    lastSeenAt instanceof Date
      ? lastSeenAt.getTime()
      : typeof lastSeenAt === "number"
        ? lastSeenAt
        : Date.parse(lastSeenAt);
  if (!Number.isFinite(seen)) return false;
  return now - seen <= PRESENCE_ONLINE_WINDOW_MS;
}

/** Sorts contacts online-first, then by name (case-insensitive), then id for stability. */
export function sortContacts<T extends { user: ContactUser; online: boolean }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    const byName = a.user.name.localeCompare(b.user.name, undefined, { sensitivity: "base" });
    return byName !== 0 ? byName : a.user.id.localeCompare(b.user.id);
  });
}
