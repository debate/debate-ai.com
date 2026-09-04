/**
 * @fileoverview Composition slice for the "Collaboration Prep Room" idea
 * under Research Crowdsourcing Organizer Features in TODO.md ("Create a
 * shared prep space for teammates to research, draft blocks, organize
 * evidence, and coordinate assignments"). Composes the existing "Shared
 * Evidence Library" slice (`shared-evidence-library.ts`) — which already
 * models a team-drafted reusable analytic block as a `kind: "block"`
 * evidence entry — for organizing and searching a topic's evidence and
 * draft blocks, with the existing "Research Task Routing" slice
 * (`research-task-routing.ts`) for coordinating research assignments off
 * that same topic's coverage gaps, reusing both directly rather than
 * introducing a separate evidence or assignment model. This is the first
 * slice only — it works entirely off a caller-supplied entry list,
 * coverage report, and contributor-availability list; it doesn't render a
 * prep-room panel UI. See the follow-ups noted in TODO.md.
 *
 * `buildPrepRoomFromStore` is a second, thin slice that closes the "(a)
 * wiring `buildPrepRoom`/`searchPrepRoomEvidence` to read through the
 * now-persisted `evidenceLibraryEntries.ts` store instead of caller-supplied
 * entries" follow-up named under the "Collaboration Prep Room" bullet — it
 * resolves the room's entries from that store when the caller doesn't
 * already supply an entry list, then delegates to the pure `buildPrepRoom`
 * above.
 *
 * @module lib/prep-room
 */

import { buildLibrarySummaryText, type ArgumentLibrary } from "debate-research-evidence/src/lib/argument-library";
import {
  buildEvidenceLibraryIndex,
  searchEvidenceLibrary,
  type EvidenceLibraryEntry,
  type EvidenceSearchQuery,
  type EvidenceSearchResult,
} from "debate-research-evidence/src/lib/shared-evidence-library";
import {
  buildRoutingResult,
  buildRoutingSummaryText,
  type ContributorAvailability,
  type RoutingResult,
} from "debate-research-evidence/src/lib/research-task-routing";
import type { TopicCoverageReport } from "debate-research-evidence/src/lib/topic-coverage";
import { listEvidenceLibraryEntries } from "debate-research-evidence/src/state/evidenceLibraryEntries";

/**
 * One topic's shared prep space: its evidence (organized into topic
 * folders/tag collections), the draft blocks filed under it, and the
 * coverage-gap tasks routed to available contributors.
 */
export interface PrepRoom {
  topic: string;
  /** This topic's evidence entries (cards and draft blocks alike). */
  entries: EvidenceLibraryEntry[];
  evidenceIndex: ArgumentLibrary;
  /** This topic's `kind: "block"` entries — team-drafted reusable analytic blocks. */
  draftBlocks: EvidenceLibraryEntry[];
  routing: RoutingResult;
}

export interface BuildPrepRoomInput {
  topic: string;
  entries: EvidenceLibraryEntry[];
  coverageReport: TopicCoverageReport;
  contributors: ContributorAvailability[];
}

/**
 * Builds a topic's prep room: scopes `entries` down to this topic, organizes
 * them via `buildEvidenceLibraryIndex`, splits out the `block`-kind entries
 * as draft blocks, and routes the topic-coverage report's gaps to available
 * contributors via `buildRoutingResult` — reusing each slice's own
 * composition entry point directly rather than reimplementing any of their
 * organizing/routing logic.
 */
export function buildPrepRoom(input: BuildPrepRoomInput): PrepRoom {
  const entries = input.entries.filter((entry) => entry.topic === input.topic);

  return {
    topic: input.topic,
    entries,
    evidenceIndex: buildEvidenceLibraryIndex(entries),
    draftBlocks: entries.filter((entry) => entry.kind === "block"),
    routing: buildRoutingResult(input.coverageReport, input.contributors),
  };
}

/**
 * Searches a prep room's evidence and draft blocks, reusing
 * `searchEvidenceLibrary` directly and pinning the query to the room's
 * topic so a caller can't accidentally search outside the room.
 */
export function searchPrepRoomEvidence(
  room: PrepRoom,
  query: Omit<EvidenceSearchQuery, "topic"> = {},
): EvidenceSearchResult[] {
  return searchEvidenceLibrary(room.entries, { ...query, topic: room.topic });
}

export interface BuildPrepRoomFromStoreInput extends Omit<BuildPrepRoomInput, "entries"> {
  /** Explicit entries to use instead of reading through the persisted store. */
  entries?: EvidenceLibraryEntry[];
}

/**
 * Same as `buildPrepRoom`, but reads `entries` from the persisted
 * `evidenceLibraryEntries.ts` store when the caller doesn't already supply
 * an entry list. An explicitly supplied `entries` array always takes
 * precedence over the store.
 */
export function buildPrepRoomFromStore(input: BuildPrepRoomFromStoreInput): PrepRoom {
  const entries = input.entries ?? listEvidenceLibraryEntries();
  return buildPrepRoom({ ...input, entries });
}

/**
 * Renders a prep room as a short, human-readable status block for a
 * collaboration-space header — organized evidence, draft-block count, and
 * routed assignments — reusing each composed slice's own summary line
 * rather than introducing a separate rendering.
 */
export function buildPrepRoomSummaryText(room: PrepRoom): string {
  const draftBlockCount = room.draftBlocks.length;
  const lines = [
    `${room.topic} prep room`,
    buildLibrarySummaryText(room.evidenceIndex),
    `${draftBlockCount} draft block${draftBlockCount === 1 ? "" : "s"}`,
    buildRoutingSummaryText(room.routing),
  ];
  return lines.join("\n");
}
