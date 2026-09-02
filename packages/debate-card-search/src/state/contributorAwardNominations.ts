/**
 * @fileoverview Peer nominations for the "🏆 Top Contributor Awards" bullet's
 * own next-named follow-up under Research Crowdsourcing Organizer Features
 * in TODO.md — "a 'nominate a peer' action". Local-first persistence,
 * mirroring `state/dailyBestCardComments.ts`'s `localStorage` convention: a
 * nomination is keyed by its own generated `id` (many nominations can share
 * a `kind`, one per submission), so `listPeerNominationsForKind` filters and
 * sorts newest-first.
 *
 * This is a lightweight, informal signal — unlike `lib/reviewer-permissions.ts`'s
 * tier-gated review actions, anyone can nominate anyone (but not themself,
 * enforced by `canNominatePeer`) and a nomination has no effect on the
 * helpfulness-score-based award winners in `lib/contributor-awards.ts`. No
 * account-sync exists yet — see `docs/features/contributor-awards.md`'s
 * Known gaps.
 *
 * @module state/contributorAwardNominations
 */

import type { ContributionKind } from "../lib/community-rating";
import { canNominatePeer, type PeerNomination } from "../lib/contributor-awards";

const STORAGE_KEY = "contributorAwardNominations";

/** Hard cap on a nomination's optional note length, enforced before it's ever stored. */
export const MAX_NOMINATION_NOTE_LENGTH = 300;

/** Thrown by `submitPeerNomination` when `nominatorId`/`nomineeId` are blank or identical. */
export class InvalidPeerNominationError extends Error {
  constructor() {
    super("A nomination needs both a nominator and a nominee, and a contributor can't nominate themself.");
    this.name = "InvalidPeerNominationError";
  }
}

function readAll(): PeerNomination[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PeerNomination[]) : [];
  } catch {
    return [];
  }
}

function writeAll(nominations: PeerNomination[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nominations));
}

function generateNominationId(): string {
  return `nom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Lists every persisted nomination across every category, newest first. */
export function listAllPeerNominations(): PeerNomination[] {
  return [...readAll()].sort((a, b) => b.nominatedAt - a.nominatedAt);
}

/** Lists one award category's nominations, newest first. */
export function listPeerNominationsForKind(kind: ContributionKind): PeerNomination[] {
  return listAllPeerNominations().filter((nomination) => nomination.kind === kind);
}

/**
 * Submits a new nomination, trimming `nomineeId`/`nominatorId`/`note` and
 * capping `note` at `MAX_NOMINATION_NOTE_LENGTH`. Throws
 * `InvalidPeerNominationError` if `nominatorId`/`nomineeId` are blank or
 * resolve to the same contributor (see `canNominatePeer`) — callers
 * (`panels/ContributorAwardsPanel.tsx`) are expected to surface that as a
 * form error rather than letting it throw uncaught.
 */
export function submitPeerNomination(input: {
  kind: ContributionKind;
  nomineeId: string;
  nominatorId: string;
  note?: string;
}): PeerNomination {
  if (!canNominatePeer(input.nominatorId, input.nomineeId)) {
    throw new InvalidPeerNominationError();
  }

  const trimmedNote = input.note?.trim();
  const nomination: PeerNomination = {
    id: generateNominationId(),
    kind: input.kind,
    nomineeId: input.nomineeId.trim(),
    nominatorId: input.nominatorId.trim(),
    ...(trimmedNote ? { note: trimmedNote.slice(0, MAX_NOMINATION_NOTE_LENGTH) } : {}),
    nominatedAt: Date.now(),
  };
  writeAll([...readAll(), nomination]);
  return nomination;
}

/**
 * Upserts a nomination as-is, keyed by `id` — for adopting a remote copy
 * once account-sync exists (mirrors
 * `state/dailyBestCardComments.ts#adoptDailyBestCardComment`), not for
 * submitting a new local nomination (use `submitPeerNomination`).
 */
export function adoptPeerNomination(nomination: PeerNomination): void {
  const nominations = readAll();
  const index = nominations.findIndex((existing) => existing.id === nomination.id);
  if (index === -1) {
    nominations.push(nomination);
  } else {
    nominations[index] = nomination;
  }
  writeAll(nominations);
}

/** Deletes a persisted nomination by id; a no-op if it isn't stored. */
export function deletePeerNomination(id: string): void {
  writeAll(readAll().filter((nomination) => nomination.id !== id));
}
