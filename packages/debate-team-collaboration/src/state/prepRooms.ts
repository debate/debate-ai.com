/**
 * @fileoverview Composes the persisted `evidenceLibraryEntries.ts`,
 * `trackedArguments.ts`, and `contributorAvailability.ts` stores into a
 * fully store-driven `PrepRoom` — the "(a) a prep-room panel UI" follow-up
 * named under the "🧑‍🤝‍🧑 Collaboration Prep Room" bullet in TODO.md.
 * `buildPrepRoomFromStore` (in `lib/prep-room.ts`) already resolves a room's
 * `entries` from the persisted evidence library when none are supplied, but
 * still requires the caller to supply a `coverageReport` and `contributors`
 * list; `buildPersistedPrepRoom` here closes that gap by resolving those two
 * remaining inputs from their own already-persisted stores
 * (`buildPersistedTopicCoverageReport` from `trackedArguments.ts`,
 * `listContributorAvailability` from `contributorAvailability.ts`), so a
 * caller — namely `panels/PrepRoomPanel.tsx` — only needs to supply a topic
 * name, mirroring `trackedArguments.ts`'s own
 * "compose the pure function directly against every persisted store it
 * needs" convention.
 *
 * `listPrepRoomTopics` lists every topic a prep room could meaningfully be
 * opened for — one with either a tracked-argument checklist or a submitted
 * evidence-library entry — for a topic switcher mirroring
 * `TopicCoverageDashboardPanel`'s `listTrackedTopics` one.
 *
 * @module state/prepRooms
 */

import type { PrepRoom } from "../lib/prep-room";
import { buildPrepRoomFromStore } from "../lib/prep-room";
import type { CoverageThresholds } from "debate-research-evidence/src/lib/topic-coverage";
import { buildPersistedTopicCoverageReport, listTrackedTopics } from "debate-research-evidence/src/state/trackedArguments";
import { listContributorAvailability } from "./contributorAvailability";
import { listEvidenceLibraryEntries } from "debate-research-evidence/src/state/evidenceLibraryEntries";

/**
 * Builds a topic's prep room entirely from persisted stores: its coverage
 * report (this topic's tracked-argument checklist scored against the
 * shared evidence library, via `buildPersistedTopicCoverageReport`), the
 * currently persisted contributor-availability profiles (via
 * `listContributorAvailability`), and its evidence/draft blocks (via
 * `buildPrepRoomFromStore`'s own evidence-library lookup) — reusing each
 * composed slice's own store-reading entry point directly rather than
 * re-reading localStorage here.
 */
export function buildPersistedPrepRoom(topic: string, thresholds?: CoverageThresholds): PrepRoom {
  const coverageReport = buildPersistedTopicCoverageReport(topic, thresholds);
  const contributors = listContributorAvailability();
  return buildPrepRoomFromStore({ topic, coverageReport, contributors });
}

/**
 * Lists every distinct topic with either a tracked-argument checklist or at
 * least one submitted evidence-library entry, sorted alphabetically. A prep
 * room can meaningfully exist for a topic even before it has a checklist,
 * as long as evidence has already been filed under it (and vice versa).
 */
export function listPrepRoomTopics(): string[] {
  const topics = new Set<string>(listTrackedTopics());
  for (const entry of listEvidenceLibraryEntries()) {
    topics.add(entry.topic);
  }
  return Array.from(topics).sort((a, b) => a.localeCompare(b));
}
