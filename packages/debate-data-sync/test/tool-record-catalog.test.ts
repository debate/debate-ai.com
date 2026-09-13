/**
 * @fileoverview Pins the integrity of the synced-collection catalog itself.
 *
 * The catalog is now the *only* thing needed to make a tool sync — the watcher
 * in `state/tool-record-auto-sync.ts` reads it and needs no per-package
 * wiring — which makes a bad entry uniquely quiet. A duplicated `key` silently
 * merges two unrelated tools into one set of account rows; a mistyped
 * `idField` makes every record in that store fail `isSyncableToolRecord`, so
 * the tool goes on working locally and simply never syncs, with no error
 * anywhere. Neither shows up in any tool's own tests.
 */

import { describe, it, expect } from "vitest";
import {
  TOOL_RECORD_COLLECTIONS,
  findToolRecordCollection,
  isSyncedToolCollection,
} from "../src/state/toolRecordCollections";

/**
 * Each collection's id field, as read off the owning store's own
 * `delete*`/upsert function at the time it was added.
 *
 * Stating it a second time here is the point. `idField` is checked against a
 * *record*, not against a schema, so a wrong value fails open: every record in
 * that store quietly fails `isSyncableToolRecord`, the tool goes on working
 * against `localStorage`, and nothing anywhere reports that it stopped
 * syncing. This map is what turns that into a failing test.
 *
 * It caught a real one: the Coach Workspace's `coachingSessions` store is keyed
 * by `(roundId, sideKey)` and carries no single id field at all, so it could
 * not join the catalog — only its version history could.
 *
 * Adding a collection means adding it here too, having actually read the
 * owning store rather than guessing from the tool's name.
 */
const EXPECTED_ID_FIELDS: Record<string, string> = {
  practiceRounds: "roundId",
  preRoundBriefings: "roundId",
  opponentTeamProfiles: "teamId",
  opponentRoundRecords: "id",
  judgeProfiles: "judgeId",
  judgeRoundRecords: "id",
  judgeParadigmSelections: "roundId",
  flowSummaries: "roundId",
  argumentTrees: "roundId",
  prepNotes: "id",
  flowAnnotations: "id",
  coachConversation: "id",
  coachingPrograms: "id",
  coachMaterials: "id",
  coachMaterialVersions: "id",
  coachingSessionHistory: "id",
  flowEdits: "id",
  drillSets: "roundId",
  aiVersusRounds: "roundId",
  judgeDecisions: "id",
  counselPanelAssessments: "id",
  vulnerabilityReports: "roundId",
  opponentPersonaSelections: "sessionId",
  customOpponentPersonaLibrary: "id",
  wordCountRounds: "roundId",
  roundPairings: "roundId",
  ownRoundHistory: "id",
  strategyRecommendations: "id",
  evidenceLibraryEntries: "id",
  cardScores: "id",
  cardScoreHistory: "id",
  peerReviews: "cardId",
  contributions: "id",
  trackedArguments: "id",
  revisionHistory: "id",
  reuseCheckHistory: "id",
  topicCoverageSnapshots: "id",
  brainstormIdeas: "id",
  prepNoteReplies: "id",
  prepRoomChecklist: "id",
  sprintSessions: "id",
  sprintNotes: "id",
  sprintWhiteboardNotes: "id",
  routedTaskQueues: "topicId",
  roundContributorFlows: "contributorId",
  contributorAvailability: "contributorId",
  groupChallenges: "id",
  dailyQuestTemplates: "id",
  contributorAwardNominations: "id",
  dailyBestCardComments: "id",
  dailyBestCardAnnouncements: "dayKey",
  contributorAwardAnnouncements: "dayKey",
  debateVideosFavorites: "videoId",
  debateVideosHidden: "videoId",
  debateVideoReports: "id",
};

describe("the synced collection catalog", () => {
  it("keys every collection by the field its own store deletes by", () => {
    for (const collection of TOOL_RECORD_COLLECTIONS) {
      expect(EXPECTED_ID_FIELDS[collection.key], `${collection.key} is not in EXPECTED_ID_FIELDS — read its store's delete function and add it`).toBe(
        collection.idField,
      );
    }
  });

  it("has no stale entry in the expectation map", () => {
    const keys = new Set(TOOL_RECORD_COLLECTIONS.map((collection) => collection.key));

    expect(Object.keys(EXPECTED_ID_FIELDS).filter((key) => !keys.has(key))).toEqual([]);
  });

  it("keys every collection uniquely", () => {
    const keys = TOOL_RECORD_COLLECTIONS.map((collection) => collection.key);

    expect(keys).toHaveLength(new Set(keys).size);
  });

  it("maps each localStorage key to exactly one collection", () => {
    // Two collections over one store would each overwrite the other's merge.
    const storageKeys = TOOL_RECORD_COLLECTIONS.map((collection) => collection.storageKey);

    expect(storageKeys).toHaveLength(new Set(storageKeys).size);
  });

  it("gives every collection a usable key, store, id field, label and route", () => {
    for (const collection of TOOL_RECORD_COLLECTIONS) {
      expect(collection.key, "key").toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
      expect(collection.storageKey.trim(), `${collection.key} storageKey`).not.toBe("");
      expect(collection.idField.trim(), `${collection.key} idField`).not.toBe("");
      expect(collection.label.trim(), `${collection.key} label`).not.toBe("");
      expect(collection.href, `${collection.key} href`).toMatch(/^\//);
    }
  });

  it("finds every collection by its own key, and nothing else", () => {
    for (const collection of TOOL_RECORD_COLLECTIONS) {
      expect(findToolRecordCollection(collection.key)).toBe(collection);
      expect(isSyncedToolCollection(collection.key)).toBe(true);
    }

    // The allowlist is what stops `/api/tool-records/[collection]` being used
    // as a free-form per-user blob store by a caller inventing a key.
    expect(isSyncedToolCollection("notATool")).toBe(false);
    expect(isSyncedToolCollection("")).toBe(false);
    expect(isSyncedToolCollection("__proto__")).toBe(false);
    expect(findToolRecordCollection("notATool")).toBeUndefined();
  });

  it("syncs the Flow Edit Log now that its panel has a route", () => {
    // `SharedFlowSyncPanel`/`FlowEditLogPanel` mount at `/coach` via
    // `CoachHub`, closing the gap `tool-data-sync.mdx` used to note under
    // "What deliberately does not sync".
    expect(findToolRecordCollection("flowEdits")).toMatchObject({
      storageKey: "flowEdits",
      idField: "id",
      href: "/coach",
    });
  });

  it("syncs the frozen daily/award announcements now that both are keyed by dayKey", () => {
    // `announceDailyBestCard`/`announceContributorAwards` each freeze at most
    // one record per UTC day under `dayKey`, mirroring `dailyBestCardComments`'
    // own precedent of reusing that panel's existing sidebar destination —
    // `DailyBestCardPanel`/`ContributorAwardsPanel` render both a collection's
    // records and its frozen announcements on the same page.
    expect(findToolRecordCollection("dailyBestCardAnnouncements")).toMatchObject({
      storageKey: "dailyBestCardAnnouncements",
      idField: "dayKey",
      href: "/cards/leaderboard",
    });
    expect(findToolRecordCollection("contributorAwardAnnouncements")).toMatchObject({
      storageKey: "contributorAwardAnnouncements",
      idField: "dayKey",
      href: "/cards/leaderboard",
    });
  });

  it("syncs the video library's favourites, hidden list and reports", () => {
    // The tools a user most visibly curates across devices, and the reason
    // this sync grew past the Practice/Coaching stores it started with.
    expect(findToolRecordCollection("debateVideosFavorites")).toMatchObject({
      storageKey: "debateVideosFavorites",
      idField: "videoId",
    });
    expect(findToolRecordCollection("debateVideosHidden")).toMatchObject({
      idField: "videoId",
    });
    expect(findToolRecordCollection("debateVideoReports")).toMatchObject({
      idField: "id",
    });
  });
});
