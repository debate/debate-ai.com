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

import { redactFileSource } from "./redact-file-source";

/**
 * The groupings `/settings` → Account → **Tool data** renders as section
 * headers, matching how `content/docs/internals/tool-data-sync.mdx` already
 * describes the catalog to a reader. Deliberately its own list rather than
 * `app/tools/tool-groups.ts`'s sidebar headings ("Workspaces", "Prep &
 * Practice", …) — see "Audited, stays separate" in that doc for why this
 * catalog does not derive from the sidebar's tool groups.
 */
export const TOOL_RECORD_SECTIONS = [
  "Videos",
  "Practice",
  "Scouting and judging",
  "Flowing and writing",
  "Coaching",
  "Research",
  "Team",
] as const;

/** One of {@link TOOL_RECORD_SECTIONS}. */
export type ToolRecordSection = (typeof TOOL_RECORD_SECTIONS)[number];

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
  /** Which {@link TOOL_RECORD_SECTIONS} group the sync-status UI lists this under. */
  section: ToolRecordSection;
  /**
   * Strips fields from a record that must never leave this browser — a saved
   * password, private key or OAuth token — before it is sent to the account.
   * Applied at every push site (the immediate mirror, the auto-sync watcher,
   * and the first-sign-in push of local-only records) and never to what a
   * tool reads back out of its own `localStorage`, so the field stays usable
   * locally on the device that saved it.
   *
   * Absent for every collection except `fileSources`: the catalog is data,
   * not code, specifically so a tool can join it without this package
   * importing that tool's package — this is the one narrow exception, for
   * the one collection whose records can carry plaintext storage credentials
   * (see `redact-file-source.ts`). A collection without this problem has no
   * reason to define one.
   */
  redact?: (record: unknown) => unknown;
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
    section: "Practice",
  },
  {
    key: "preRoundBriefings",
    storageKey: "preRoundBriefings",
    idField: "roundId",
    label: "Pre-Round Briefings",
    href: "/briefings",
    section: "Practice",
  },
  {
    key: "opponentTeamProfiles",
    storageKey: "opponentTeamProfiles",
    idField: "teamId",
    label: "Opponent Team Profiles",
    href: "/opponents",
    section: "Scouting and judging",
  },
  {
    key: "opponentRoundRecords",
    storageKey: "opponentRoundRecords",
    idField: "id",
    label: "Opponent round records",
    href: "/opponents",
    section: "Scouting and judging",
  },
  {
    key: "judgeProfiles",
    storageKey: "judgeProfiles",
    idField: "judgeId",
    label: "Judge Profiles",
    href: "/judges",
    section: "Scouting and judging",
  },
  {
    key: "judgeRoundRecords",
    storageKey: "judgeRoundRecords",
    idField: "id",
    label: "Judge round records",
    href: "/judges",
    section: "Scouting and judging",
  },
  {
    key: "judgeParadigmSelections",
    storageKey: "judgeParadigmSelections",
    idField: "roundId",
    label: "Judge Paradigm Picker",
    href: "/paradigms",
    section: "Scouting and judging",
  },
  {
    key: "flowSummaries",
    storageKey: "flowSummaries",
    idField: "roundId",
    label: "Speech Summaries",
    href: "/summaries",
    section: "Flowing and writing",
  },
  {
    key: "argumentTrees",
    storageKey: "argumentTrees",
    idField: "roundId",
    label: "Argument Tree Outline",
    href: "/outline",
    section: "Flowing and writing",
  },
  {
    key: "argumentTreeFilters",
    storageKey: "argumentTreeFilters",
    idField: "roundId",
    label: "Argument Tree Filters",
    href: "/outline",
    section: "Flowing and writing",
  },
  {
    key: "prepNotes",
    storageKey: "prepNotes",
    idField: "id",
    label: "Prep Notes",
    href: "/prep-notes",
    section: "Flowing and writing",
  },
  {
    key: "flowAnnotations",
    storageKey: "flowAnnotations",
    idField: "id",
    label: "Flow Annotations",
    href: "/annotations",
    section: "Flowing and writing",
  },
  {
    key: "spellcheckDictionary",
    storageKey: "pmd-user-dictionary",
    idField: "id",
    label: "Personal Dictionary",
    href: "/reason-editor",
    section: "Flowing and writing",
  },
  {
    key: "flowHistory",
    storageKey: "flow-history",
    idField: "id",
    // Distinct from `saved_flows` (the explicit, user-triggered cloud save on
    // each flow chip): this is the auto-saved undo/version log the same
    // dialog's "History" tab reads, kept in its own `flow-history` key by
    // `debate-round/src/state/store.ts`'s `saveToHistory`/`getFlowHistory`.
    label: "Flow History",
    href: "/debate",
    section: "Flowing and writing",
  },
  {
    key: "docsChatTabs",
    storageKey: "qwksearch-open-chat-tabs",
    idField: "id",
    // Which REASON Docs chat conversations are open as tabs, kept by
    // `apps/debate-ai.com/components/qwksearch/useChatTabs.ts`. The
    // conversations themselves are owned by the third-party `research-agent-ui`
    // package's own backend and fetched by id, so this record is the tab
    // layout — which chats to reopen and their titles — not the chat content.
    label: "Debate Docs Chat Tabs",
    href: "/doc",
    section: "Flowing and writing",
  },
  {
    key: "fileSources",
    storageKey: "REASON-file-sources",
    idField: "id",
    // Which storage backends (SSH, S3, R2, B2, Google Docs, Turso) the `/doc`
    // file browser is configured to reach — `file-sources.ts`'s `AnyFileSource`
    // list. `redact` holds back every field that would let another device
    // connect as this user; see `redact-file-source.ts`.
    label: "File Sources",
    href: "/doc",
    section: "Flowing and writing",
    redact: redactFileSource,
  },
  // — Coaching —
  {
    key: "coachConversation",
    storageKey: "coachConversation",
    idField: "id",
    label: "AI Coach Mode",
    href: "/coaching",
    section: "Coaching",
  },
  {
    key: "coachingPrograms",
    storageKey: "coachingPrograms",
    idField: "id",
    label: "Coaching Programs",
    href: "/coaching-programs",
    section: "Coaching",
  },
  {
    key: "coachingSessionHistory",
    storageKey: "coachingSessionHistory",
    idField: "id",
    label: "Coach Workspace History",
    href: "/coach",
    section: "Coaching",
  },
  {
    key: "coachingSessions",
    storageKey: "coachingSessions",
    idField: "id",
    label: "AI Coach Mode",
    href: "/coaching",
    section: "Coaching",
  },
  {
    key: "flowEdits",
    storageKey: "flowEdits",
    idField: "id",
    label: "Flow Edit Log",
    href: "/coach",
    section: "Coaching",
  },
  // — Practice —
  {
    key: "aiVersusRounds",
    storageKey: "aiVersusRounds",
    idField: "roundId",
    label: "Debate Versus AI",
    href: "/versus-ai",
    section: "Practice",
  },
  {
    key: "vulnerabilityReports",
    storageKey: "vulnerabilityReports",
    idField: "roundId",
    label: "Vulnerability Reports",
    href: "/outcomes",
    section: "Scouting and judging",
  },
  {
    key: "opponentPersonaSelections",
    storageKey: "opponentPersonaSelections",
    idField: "sessionId",
    label: "Opponent Persona Picker",
    href: "/practice-opponent",
    section: "Scouting and judging",
  },
  {
    key: "ownRoundHistory",
    storageKey: "ownRoundHistory",
    idField: "id",
    label: "Your Round History",
    href: "/practice-round",
    section: "Practice",
  },
  // — Research —
  {
    key: "evidenceLibraryEntries",
    storageKey: "evidenceLibraryEntries",
    idField: "id",
    label: "Evidence Library",
    href: "/cards",
    section: "Research",
  },
  {
    key: "cardScores",
    storageKey: "cardScores",
    idField: "id",
    label: "Card Scores",
    href: "/cards/reviews",
    section: "Research",
  },
  {
    key: "cardScoreHistory",
    storageKey: "cardScoreHistory",
    idField: "id",
    label: "Card Score History",
    href: "/cards/reviews",
    section: "Research",
  },
  {
    key: "aiCardAssessments",
    storageKey: "aiCardAssessments",
    idField: "cardId",
    label: "AI Card Assessments",
    href: "/cards/reviews",
    section: "Research",
  },
  {
    key: "peerReviews",
    storageKey: "peerReviews",
    idField: "cardId",
    label: "Review Queue",
    href: "/cards/reviews",
    section: "Research",
  },
  {
    key: "contributions",
    storageKey: "contributions",
    idField: "id",
    label: "Contributions Feed",
    href: "/cards/contributions",
    section: "Research",
  },
  {
    key: "trackedArguments",
    storageKey: "trackedArguments",
    idField: "id",
    label: "Argument Library",
    href: "/cards",
    section: "Research",
  },
  {
    key: "revisionHistory",
    storageKey: "revisionHistory",
    idField: "id",
    label: "Card Revision History",
    href: "/cards",
    section: "Research",
  },
  {
    key: "reuseCheckHistory",
    storageKey: "reuseCheckHistory",
    idField: "id",
    label: "Card Reuse Checks",
    href: "/cards",
    section: "Research",
  },
  {
    key: "topicCoverageSnapshots",
    storageKey: "topicCoverageSnapshots",
    idField: "id",
    label: "Topic Coverage",
    href: "/cards/coverage",
    section: "Research",
  },
  // — Team —
  {
    key: "brainstormIdeas",
    storageKey: "brainstormIdeas",
    idField: "id",
    label: "Team Brainstorm Assist",
    href: "/cards/brainstorm",
    section: "Team",
  },
  {
    key: "prepNoteReplies",
    storageKey: "prepNoteReplies",
    idField: "id",
    label: "Prep Note Replies",
    href: "/prep-notes",
    section: "Flowing and writing",
  },
  {
    key: "prepNoteNotifications",
    storageKey: "prepNoteNotifications",
    idField: "id",
    label: "Prep Note Notifications",
    href: "/prep-notes",
    section: "Flowing and writing",
  },
  {
    key: "prepRoomChecklist",
    storageKey: "prepRoomChecklist",
    idField: "id",
    label: "Collaboration Prep Room",
    href: "/cards/prep-room",
    section: "Team",
  },
  {
    key: "sprintNotes",
    storageKey: "sprintNotes",
    idField: "id",
    label: "Sprint Notes",
    href: "/cards/prep-room",
    section: "Team",
  },
  {
    key: "sprintWhiteboardNotes",
    storageKey: "sprintWhiteboardNotes",
    idField: "id",
    label: "Sprint Whiteboard",
    href: "/cards/prep-room",
    section: "Team",
  },
  {
    key: "routedTaskQueues",
    storageKey: "routedTaskQueues",
    idField: "topicId",
    label: "Task Inbox",
    href: "/cards/inbox",
    section: "Team",
  },
  {
    key: "pendingTaskVerifications",
    storageKey: "pendingTaskVerifications",
    idField: "id",
    label: "Task Verification Queue",
    href: "/cards/inbox",
    section: "Team",
  },
  {
    key: "roundContributorFlows",
    storageKey: "roundContributorFlows",
    idField: "contributorId",
    label: "Contributor Flows",
    href: "/cards/progress-tracking",
    section: "Team",
  },
  {
    key: "contributorAvailability",
    storageKey: "contributorAvailability",
    idField: "contributorId",
    label: "Contributor Availability",
    href: "/cards/progress-tracking",
    section: "Team",
  },
  {
    key: "completedResearchTasks",
    storageKey: "completedResearchTasks",
    idField: "id",
    label: "Completed Research Tasks",
    href: "/cards/progress-tracking",
    section: "Team",
  },
  {
    key: "groupChallenges",
    storageKey: "groupChallenges",
    idField: "id",
    label: "Group Challenges",
    href: "/cards/leaderboard",
    section: "Team",
  },
  {
    key: "challengeWinEvents",
    storageKey: "challengeWinEvents",
    idField: "id",
    label: "Group Challenge Win Events",
    href: "/cards/leaderboard",
    section: "Team",
  },
  {
    key: "dailyQuestTemplates",
    storageKey: "dailyQuestTemplates",
    idField: "id",
    label: "Daily Quests",
    href: "/cards/leaderboard",
    section: "Team",
  },
  {
    key: "dailyMissionResults",
    storageKey: "dailyMissionResults",
    idField: "id",
    // The day-by-day mission-result history `/cards/streaks`' quest-streak
    // roster is computed from — `state/dailyMissionResults.ts`'s
    // `saveDailyMissionResult` now stamps a deterministic
    // `${contributorId}::${dayKey}` id onto every record. `/cards/streaks`
    // isn't itself a registered sidebar destination (see
    // `tool-record-sync-catalog.test.ts`), so this points at `/cards/leaderboard`
    // like its `dailyQuestTemplates`/`groupChallenges` siblings.
    label: "Quest Streak History",
    href: "/cards/leaderboard",
    section: "Team",
  },
  {
    key: "questTeams",
    storageKey: "questTeams",
    idField: "id",
    label: "Quest Teams",
    href: "/cards/leaderboard",
    section: "Team",
  },
  {
    key: "contributorAwardNominations",
    storageKey: "contributorAwardNominations",
    idField: "id",
    label: "Contributor Award Nominations",
    href: "/cards/leaderboard",
    section: "Team",
  },
  {
    key: "unlockCelebrations",
    storageKey: "unlockCelebrationSeenBadges",
    idField: "id",
    // Each contributor's "last-seen badges" celebration baseline —
    // `debate-contributor-progress/src/state/unlockCelebrations.ts`'s
    // `UnlockCelebrationSeenBadgesRecord`, keyed by the contributor's id.
    // Without this, a contributor who has already been shown a badge's
    // celebration toast on one device sees it celebrated again as "new" on a
    // second device, since the baseline it's diffed against never followed
    // them. `/cards/progress` (Progress Unlocks) isn't itself a registered
    // sidebar destination (see `tool-record-sync-catalog.test.ts`), so this
    // points at `/cards/leaderboard` like its `dailyQuestTemplates`/
    // `dailyMissionResults` siblings.
    label: "Progress Unlocks",
    href: "/cards/leaderboard",
    section: "Team",
  },
  {
    key: "dailyBestCardAnnouncements",
    storageKey: "dailyBestCardAnnouncements",
    idField: "dayKey",
    label: "Daily Best Card Announcements",
    href: "/cards/leaderboard",
    section: "Team",
  },
  {
    key: "contributorAwardAnnouncements",
    storageKey: "contributorAwardAnnouncements",
    idField: "dayKey",
    label: "Contributor Award Announcements",
    href: "/cards/leaderboard",
    section: "Team",
  },
  // — Videos —
  {
    key: "debateVideosFavorites",
    storageKey: "debateVideosFavorites",
    idField: "videoId",
    label: "Video Favorites",
    href: "/videos",
    section: "Videos",
  },
  {
    key: "debateVideosHidden",
    storageKey: "debateVideosHidden",
    idField: "videoId",
    label: "Hidden Videos",
    href: "/videos",
    section: "Videos",
  },
  {
    key: "debateVideoReports",
    storageKey: "debateVideoReports",
    idField: "id",
    label: "Video Reports",
    href: "/videos",
    section: "Videos",
  },
  {
    key: "debateVideoWatchHistory",
    storageKey: "debateVideoWatchHistory",
    idField: "videoId",
    label: "Video Watch History",
    href: "/videos",
    section: "Videos",
  },
  {
    key: "speechOutcomeRuns",
    storageKey: "debate-videos:speech-outcomes",
    idField: "id",
    // The watch page's cached AI outcome-simulation runs
    // (`debate-videos/src/state/speechOutcomeCache.ts`), keyed by a derived
    // `${videoId}::${speechKey}::${lens}` id — see that module's own header
    // comment for why it needed one before it could join this catalog.
    label: "Speech Outcome Runs",
    href: "/videos",
    section: "Videos",
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
 * Fills back into `remote` whatever field `local` has that `remote` doesn't,
 * recursing into any nested plain object both sides carry.
 *
 * The account only ever holds what a collection's `redact` let through, so
 * for a `redact`-carrying collection the account's copy of a record is
 * missing, by construction, exactly the fields this browser must not have
 * uploaded — the local `password` a redacted `credentials` object dropped,
 * say. Adopting the account's copy wholesale, as a collection without
 * `redact` does, would then read as the *account* revoking a credential this
 * browser never sent it in the first place, erasing it from the device that
 * is the only place it still exists. Restoring by "present locally, absent
 * remotely" needs no knowledge of which fields a given `redact` strips: it
 * holds for any function that only ever omits keys, never renames or nulls
 * them.
 *
 * A field both sides carry still takes the account's value — a rename made
 * on another device reaches this one, same as any other field the merge
 * treats as shared truth. Only what the account was never told about is
 * preserved.
 *
 * @param local - This browser's copy of the record (or nested object).
 * @param remote - The account's copy.
 */
function restoreRedactedFields(local: unknown, remote: unknown): unknown {
  if (
    typeof local !== "object" ||
    local === null ||
    Array.isArray(local) ||
    typeof remote !== "object" ||
    remote === null ||
    Array.isArray(remote)
  ) {
    return remote;
  }
  const merged: Record<string, unknown> = { ...(remote as Record<string, unknown>) };
  for (const [field, value] of Object.entries(local as Record<string, unknown>)) {
    merged[field] = field in merged ? restoreRedactedFields(value, merged[field]) : value;
  }
  return merged;
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
 * For a collection with `redact` (see `ToolRecordCollection.redact`), "the
 * account is the shared truth" only holds for the fields the account was
 * ever shown — {@link restoreRedactedFields} fills back whatever this
 * browser's copy has that the account's doesn't, rather than letting an
 * always-redacted remote field read as the account clearing it.
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
    if (!remoteById.has(id)) {
      merged.push(record);
    } else if (collection.redact) {
      merged.push(restoreRedactedFields(record, remoteById.get(id)));
    } else {
      merged.push(remoteById.get(id));
    }
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
