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
 * coverage report, and contributor-availability list; it doesn't persist a
 * prep room or its inputs, or render a prep-room panel UI. See the
 * follow-ups noted in TODO.md.
 *
 * @module lib/prep-room
 */

import { buildLibrarySummaryText, type ArgumentLibrary } from "./argument-library";
import {
  buildEvidenceLibraryIndex,
  searchEvidenceLibrary,
  type EvidenceLibraryEntry,
  type EvidenceSearchQuery,
  type EvidenceSearchResult,
} from "./shared-evidence-library";
import {
  buildRoutingResult,
  buildRoutingSummaryText,
  type ContributorAvailability,
  type RoutingResult,
} from "./research-task-routing";
import type { TopicCoverageReport } from "./topic-coverage";

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
