/**
 * @fileoverview The catalog of localStorage-backed tool stores that sync to a
 * signed-in user's account, and the pure helpers both sides of that sync
 * agree on.
 *
 * Most of the sidebar's Coaching/Practice tools kept everything they produce
 * in one browser's `localStorage` — the "per-browser localStorage, not
 * account-synced" Known gap recorded in `packages/debate-help-docs/content/docs/internals/judge-profiles.mdx`,
 * `opponent-team-profiles.md`, `flow-annotations.md`, `prep-notes.md`,
 * `coaching-programs.md`, `coach-materials.md` and friends. Signing in on a
 * second device showed an empty tool.
 *
 * The stores that still had that gap all have the same shape — a JSON array
 * of records under one key, each record identified by one string field — so
 * rather than a bespoke table, route, client and hook per tool (the shape
 * `saved_flows`/`saved_drill_sets`/`saved_tournament_results` took, one file
 * set each), they share one `saved_tool_records` table keyed by
 * `(user_id, collection, client_id)` and one `/api/tool-records/[collection]`
 * route pair. This module is the list of collections that sync and the
 * validation both the route and the client apply, kept framework- and
 * fetch-free so the server, the client and the tests can all import it.
 *
 * A collection is described by data rather than by code — its localStorage
 * key and id field — so hydration can read and write a tool's store without
 * importing that tool's package (`debate-data-sync` is a leaf package: the
 * tool packages depend on it, not the other way round), and without depending
 * on whether the tool's panel happens to be mounted yet.
 *
 * Adding a tool to the sync is **one entry in this list**, and nothing else.
 * `state/tool-record-auto-sync.ts` watches every collection named here and
 * flushes whatever its store gains, changes or loses, so a tool syncs without
 * its own package being edited at all. A store that additionally calls
 * `mirrorToolRecord*` from its `save*`/`delete*` functions (see
 * `state/tool-record-mirror.ts`) gets the same change out immediately rather
 * than at the watcher's next tick; that is an optimization on top of the
 * watcher, not a requirement of joining it.
 *
 * What *is* required is the shape: a JSON array under one `localStorage` key,
 * each element an object carrying a stable string `idField`. Single-object
 * settings stores (`myTeamProfile`, `fontFamily`), presence heartbeats and
 * per-device playback state are deliberately absent — the first cannot be
 * keyed, and the last two describe this browser rather than this user.
 *
 * @module state/toolRecordCollections
 */

/** One localStorage-backed tool store that syncs to the account. */
export interface ToolRecordCollection {
  /**
   * Stable key for this collection: the `collection` path segment of
   * `/api/tool-records/[collection]` and the value of the table's
   * `collection` column. Equal to `storageKey` for every collection today,
   * but kept as its own field so renaming a browser storage key can't
   * silently orphan every row already synced under the old name.
   */
  key: string;
  /** The `localStorage` key this tool's records array lives under. */
  storageKey: string;
  /**
   * The field on each record that identifies it within the collection —
   * what the sync upserts and deletes by. Records whose value for it isn't a
   * non-empty string are not synced (see {@link isSyncableToolRecord}).
   */
  idField: string;
  /** The tool this store belongs to, as the sidebar names it. */
  label: string;
  /** Where that tool is reached, for the sync-status UI. */
  href: string;
}

/**
 * Hard cap on one record's serialized JSON — generous for a long flow
 * annotation or a full judge profile, well short of D1's row-size limit.
 * Matches `MAX_SAVED_TOURNAMENT_RESULT_BYTES`'s role for its own table.
 */
export const MAX_TOOL_RECORD_BYTES = 200_000;

/** Cap on how many records one collection syncs in a single bulk push. */
export const MAX_TOOL_RECORDS_PER_PUSH = 500;

/**
 * Every synced collection, grouped by the sidebar section its tool sits in.
 *
 * This list is an allowlist, not a suggestion: `/api/tool-records/[collection]`
 * rejects any key not named here, so the table can't be used as a free-form
 * per-user blob store by a caller inventing collection names.
 */
export const TOOL_RECORD_COLLECTIONS: readonly ToolRecordCollection[] = [
  // — Practice —
  {
    key: "practiceRounds",
    storageKey: "practiceRounds",
    idField: "roundId",
    label: "Practice Round Simulator",
    href: "/practice-round",
  },
  {
    key: "preRoundBriefings",
    storageKey: "preRoundBriefings",
    idField: "roundId",
    label: "Pre-Round Briefings",
    href: "/briefings",
  },
  {
    key: "opponentTeamProfiles",
    storageKey: "opponentTeamProfiles",
    idField: "teamId",
    label: "Opponent Team Profiles",
    href: "/opponents",
  },
  {
    key: "opponentRoundRecords",
    storageKey: "opponentRoundRecords",
    idField: "id",
    label: "Opponent round records",
    href: "/opponents",
  },
  {
    key: "judgeProfiles",
    storageKey: "judgeProfiles",
    idField: "judgeId",
    label: "Judge Profiles",
    href: "/judges",
  },
  {
    key: "judgeRoundRecords",
    storageKey: "judgeRoundRecords",
    idField: "id",
    label: "Judge round records",
    href: "/judges",
  },
  {
    key: "judgeParadigmSelections",
    storageKey: "judgeParadigmSelections",
    idField: "roundId",
    label: "Judge Paradigm Picker",
    href: "/paradigms",
  },
  {
    key: "flowSummaries",
    storageKey: "flowSummaries",
    idField: "roundId",
    label: "Speech Summaries",
    href: "/summaries",
  },
  {
    key: "argumentTrees",
    storageKey: "argumentTrees",
    idField: "roundId",
    label: "Argument Tree Outline",
    href: "/outline",
  },
  {
    key: "prepNotes",
    storageKey: "prepNotes",
    idField: "id",
    label: "Prep Notes",
    href: "/prep-notes",
  },
  {
    key: "flowAnnotations",
    storageKey: "flowAnnotations",
    idField: "id",
    label: "Flow Annotations",
    href: "/annotations",
  },
  // — Coaching —
  {
    key: "coachConversation",
    storageKey: "coachConversation",
    idField: "id",
    label: "AI Coach Mode",
    href: "/coaching",
  },
  {
    key: "coachingPrograms",
    storageKey: "coachingPrograms",
    idField: "id",
    label: "Coaching Programs",
    href: "/coaching-programs",
  },
  {
    key: "coachMaterials",
    storageKey: "coachMaterials",
    idField: "id",
    label: "Coach Materials",
    href: "/coach-materials",
  },
  {
    key: "coachMaterialVersions",
    storageKey: "coachMaterialVersions",
    idField: "id",
    label: "Coach Material Versions",
    href: "/coach-materials",
  },
  {
    key: "coachingSessionHistory",
    storageKey: "coachingSessionHistory",
    idField: "id",
    // The Coach Workspace's own `coachingSessions` store is deliberately not
    // here: `CoachingSessionRecord` is keyed by `(roundId, sideKey)` and
    // carries no single id field, so it cannot be keyed by this table. Its
    // version history can, and each entry names the round and side it belongs
    // to, so what the user wrote is kept either way.
    label: "Coach Workspace History",
    href: "/coach",
  },
  {
    key: "flowEdits",
    storageKey: "flowEdits",
    idField: "id",
    label: "Flow Edit Log",
    href: "/coach",
  },
  // — Practice —
  {
    key: "drillSets",
    storageKey: "drillSets",
    idField: "roundId",
    label: "Practice Drills",
    href: "/drills",
  },
  {
    key: "aiVersusRounds",
    storageKey: "aiVersusRounds",
    idField: "roundId",
    label: "Debate Versus AI",
    href: "/versus-ai",
  },
  {
    key: "judgeDecisions",
    storageKey: "judgeDecisions",
    idField: "id",
    label: "AI Judge Decision",
    href: "/judge-decision",
  },
  {
    key: "counselPanelAssessments",
    storageKey: "counselPanelAssessments",
    idField: "id",
    label: "Response-Outcome Charts",
    href: "/outcomes",
  },
  {
    key: "vulnerabilityReports",
    storageKey: "vulnerabilityReports",
    idField: "roundId",
    label: "Vulnerability Reports",
    href: "/outcomes",
  },
  {
    key: "opponentPersonaSelections",
    storageKey: "opponentPersonaSelections",
    idField: "sessionId",
    label: "Opponent Persona Picker",
    href: "/practice-opponent",
  },
  {
    key: "customOpponentPersonaLibrary",
    storageKey: "customOpponentPersonaLibrary",
    idField: "id",
    label: "Custom Opponent Personas",
    href: "/practice-opponent",
  },
  {
    key: "wordCountRounds",
    storageKey: "wordCountRounds",
    idField: "roundId",
    label: "Word-Count Speeches",
    href: "/word-count",
  },
  {
    key: "roundPairings",
    storageKey: "roundPairings",
    idField: "roundId",
    label: "Round Pairings",
    href: "/practice-round",
  },
  {
    key: "ownRoundHistory",
    storageKey: "ownRoundHistory",
    idField: "id",
    label: "Your Round History",
    href: "/practice-round",
  },
  {
    key: "strategyRecommendations",
    storageKey: "strategyRecommendations",
    idField: "id",
    label: "Scout-to-Strategy",
    href: "/strategy",
  },
  // — Research —
  {
    key: "evidenceLibraryEntries",
    storageKey: "evidenceLibraryEntries",
    idField: "id",
    label: "Evidence Library",
    href: "/cards/library",
  },
  {
    key: "cardScores",
    storageKey: "cardScores",
    idField: "id",
    label: "Card Scores",
    href: "/cards/reviews",
  },
  {
    key: "cardScoreHistory",
    storageKey: "cardScoreHistory",
    idField: "id",
    label: "Card Score History",
    href: "/cards/reviews",
  },
  {
    key: "peerReviews",
    storageKey: "peerReviews",
    idField: "cardId",
    label: "Review Queue",
    href: "/cards/reviews",
  },
  {
    key: "contributions",
    storageKey: "contributions",
    idField: "id",
    label: "Contributions Feed",
    href: "/cards/contributions",
  },
  {
    key: "trackedArguments",
    storageKey: "trackedArguments",
    idField: "id",
    label: "Argument Library",
    href: "/cards/argument-library",
  },
  {
    key: "revisionHistory",
    storageKey: "revisionHistory",
    idField: "id",
    label: "Card Revision History",
    href: "/cards/library",
  },
  {
    key: "reuseCheckHistory",
    storageKey: "reuseCheckHistory",
    idField: "id",
    label: "Card Reuse Checks",
    href: "/cards/library",
  },
  {
    key: "topicCoverageSnapshots",
    storageKey: "topicCoverageSnapshots",
    idField: "id",
    label: "Topic Coverage",
    href: "/cards/coverage",
  },
  // — Team —
  {
    key: "brainstormIdeas",
    storageKey: "brainstormIdeas",
    idField: "id",
    label: "Team Brainstorm Assist",
    href: "/cards/brainstorm",
  },
  {
    key: "prepNoteReplies",
    storageKey: "prepNoteReplies",
    idField: "id",
    label: "Prep Note Replies",
    href: "/prep-notes",
  },
  {
    key: "prepRoomChecklist",
    storageKey: "prepRoomChecklist",
    idField: "id",
    label: "Collaboration Prep Room",
    href: "/cards/prep-room",
  },
  {
    key: "sprintSessions",
    storageKey: "sprintSessions",
    idField: "id",
    label: "Prep Room Sprints",
    href: "/cards/prep-room",
  },
  {
    key: "sprintNotes",
    storageKey: "sprintNotes",
    idField: "id",
    label: "Sprint Notes",
    href: "/cards/prep-room",
  },
  {
    key: "sprintWhiteboardNotes",
    storageKey: "sprintWhiteboardNotes",
    idField: "id",
    label: "Sprint Whiteboard",
    href: "/cards/prep-room",
  },
  {
    key: "routedTaskQueues",
    storageKey: "routedTaskQueues",
    idField: "topicId",
    label: "Task Inbox",
    href: "/cards/inbox",
  },
  {
    key: "roundContributorFlows",
    storageKey: "roundContributorFlows",
    idField: "contributorId",
    label: "Contributor Flows",
    href: "/cards/progress-tracking",
  },
  {
    key: "contributorAvailability",
    storageKey: "contributorAvailability",
    idField: "contributorId",
    label: "Contributor Availability",
    href: "/cards/progress-tracking",
  },
  {
    key: "groupChallenges",
    storageKey: "groupChallenges",
    idField: "id",
    label: "Group Challenges",
    href: "/cards/leaderboard",
  },
  {
    key: "dailyQuestTemplates",
    storageKey: "dailyQuestTemplates",
    idField: "id",
    label: "Daily Quests",
    href: "/cards/leaderboard",
  },
  {
    key: "contributorAwardNominations",
    storageKey: "contributorAwardNominations",
    idField: "id",
    label: "Contributor Award Nominations",
    href: "/cards/leaderboard",
  },
  {
    key: "dailyBestCardComments",
    storageKey: "dailyBestCardComments",
    idField: "id",
    label: "Daily Best Card Comments",
    href: "/cards/leaderboard",
  },
  {
    key: "dailyBestCardAnnouncements",
    storageKey: "dailyBestCardAnnouncements",
    idField: "dayKey",
    label: "Daily Best Card Announcements",
    href: "/cards/leaderboard",
  },
  {
    key: "contributorAwardAnnouncements",
    storageKey: "contributorAwardAnnouncements",
    idField: "dayKey",
    label: "Contributor Award Announcements",
    href: "/cards/leaderboard",
  },
  // — Videos —
  {
    key: "debateVideosFavorites",
    storageKey: "debateVideosFavorites",
    idField: "videoId",
    label: "Video Favorites",
    href: "/videos",
  },
  {
    key: "debateVideosHidden",
    storageKey: "debateVideosHidden",
    idField: "videoId",
    label: "Hidden Videos",
    href: "/videos",
  },
  {
    key: "debateVideoReports",
    storageKey: "debateVideoReports",
    idField: "id",
    label: "Video Reports",
    href: "/videos",
  },
];

const BY_KEY = new Map(TOOL_RECORD_COLLECTIONS.map((collection) => [collection.key, collection]));

/**
 * Looks up a collection by key.
 *
 * @param key - An untrusted collection key, e.g. a route path segment.
 * @returns The collection, or `undefined` when nothing syncs under that key.
 */
export function findToolRecordCollection(key: string): ToolRecordCollection | undefined {
  return BY_KEY.get(key);
}

/**
 * Whether a key names a collection that syncs — the allowlist check
 * `/api/tool-records/[collection]` applies before touching the database.
 *
 * @param key - An untrusted collection key.
 */
export function isSyncedToolCollection(key: string): boolean {
  return BY_KEY.has(key);
}

/**
 * Reads a record's id for its collection.
 *
 * @param collection - The collection the record belongs to.
 * @param record - An untrusted record.
 * @returns The id, or `null` when the record carries no usable one.
 */
export function toolRecordId(
  collection: ToolRecordCollection,
  record: unknown,
): string | null {
  if (typeof record !== "object" || record === null || Array.isArray(record)) return null;
  const id = (record as Record<string, unknown>)[collection.idField];
  return typeof id === "string" && id.trim().length > 0 ? id : null;
}

/**
 * Structural validator for an untrusted value claiming to be a record of this
 * collection. Deliberately shallow: the tools own records of a dozen
 * different shapes and their fields are the tool's business, so the sync
 * checks only what it itself relies on — a JSON object carrying a usable id.
 * Everything past that is stored and handed back verbatim.
 *
 * @param collection - The collection the record is being synced under.
 * @param value - The untrusted value, e.g. parsed request-body JSON.
 */
export function isSyncableToolRecord(
  collection: ToolRecordCollection,
  value: unknown,
): value is Record<string, unknown> {
  return toolRecordId(collection, value) !== null;
}

/**
 * Merges the account's records into this browser's, by id.
 *
 * Records are create/replace/delete — never edited field-by-field from two
 * devices at once — so, as in `useStandingsAccountSync`'s tournament-result
 * merge, this is a union rather than a conflict resolution: a remote record
 * replaces the local one under the same id (the account is the shared truth
 * across devices), and a local-only record is kept so anything saved before
 * this browser signed in, or saved offline, isn't dropped on the floor. The
 * caller pushes those local-only records up; {@link toolRecordsMissingRemotely}
 * is which ones they are.
 *
 * Local order is preserved for records that stay, and adopted remote records
 * are appended in the order the account returned them.
 *
 * @param local - The records currently in this browser's store.
 * @param remote - The records the account holds.
 * @param collection - The collection both belong to.
 * @returns The merged list to write back to local storage.
 */
export function mergeToolRecords(
  collection: ToolRecordCollection,
  local: readonly unknown[],
  remote: readonly unknown[],
): unknown[] {
  const remoteById = new Map<string, unknown>();
  for (const record of remote) {
    const id = toolRecordId(collection, record);
    if (id !== null) remoteById.set(id, record);
  }

  const merged: unknown[] = [];
  const seen = new Set<string>();
  for (const record of local) {
    const id = toolRecordId(collection, record);
    // A local record with no usable id can't be matched, synced or deleted by
    // id — it stays local, untouched, rather than being silently dropped.
    if (id === null) {
      merged.push(record);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(remoteById.get(id) ?? record);
  }
  for (const [id, record] of remoteById) {
    if (!seen.has(id)) merged.push(record);
  }
  return merged;
}

/**
 * Which of this browser's records the account doesn't have yet — the ones a
 * first sign-in pushes up so they aren't lost when another device's copy of
 * the store becomes the shared one.
 *
 * @param collection - The collection both belong to.
 * @param local - The records currently in this browser's store.
 * @param remote - The records the account holds.
 */
export function toolRecordsMissingRemotely(
  collection: ToolRecordCollection,
  local: readonly unknown[],
  remote: readonly unknown[],
): unknown[] {
  const remoteIds = new Set<string>();
  for (const record of remote) {
    const id = toolRecordId(collection, record);
    if (id !== null) remoteIds.add(id);
  }

  const missing: unknown[] = [];
  const seen = new Set<string>();
  for (const record of local) {
    const id = toolRecordId(collection, record);
    if (id === null || remoteIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    missing.push(record);
  }
  return missing;
}
