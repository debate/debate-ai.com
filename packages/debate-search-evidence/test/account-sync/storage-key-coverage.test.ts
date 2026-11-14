/**
 * @fileoverview Guards the "every tool store reaches the user's account" rule.
 *
 * A tool that persists to `localStorage` under a `STORAGE_KEY` constant — or
 * any other `*_KEY` string constant, such as `SOUND_EFFECT_LEVEL_KEY` or
 * `DRAFT_KEY` — must either join `TOOL_RECORD_COLLECTIONS` (the generic account
 * sync), sync through its own route / `user_settings` column, or be declared
 * device-local here. A new store that is none of these is exactly the silent
 * gap this test names: the tool works, nothing fails, and the data never leaves
 * the browser.
 *
 * The scan is textual, so it also sees `*_KEY` constants that are not
 * `localStorage` stores at all (a sessionStorage flag, an IndexedDB record
 * key, a URL hash parameter); those go in `NOT_LOCAL_STORAGE`. Constants named
 * `*API_KEY` are credentials, not storage keys, and are skipped by name.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_RECORD_COLLECTIONS } from "../../src/account-sync/toolRecordCollections";

const PACKAGES_DIR = join(import.meta.dirname, "..", "..", "..");
/** `STORAGE_KEY = "…"` and every other `SOME_NAME_KEY = "…"` constant. Group 1 is the name, group 2 the key. */
const STORAGE_KEY_PATTERN = /\b((?:[A-Z][A-Z0-9_]*_)?KEY)\s*=\s*"([A-Za-z0-9_.:-]+)"/g;
/** Names that hold a credential rather than a storage key. */
const CREDENTIAL_NAME_PATTERN = /API_KEY$/;

/** Stores that sync through a dedicated route, `user_settings` column or saved_* table. */
const SYNCED_ELSEWHERE = new Set([
  "REASON-documents",
  "coachMaterialVersions",
  "coachMaterials",
  "counselPanelAssessments",
  "customOpponentPersonaLibrary",
  "dailyBestCardComments",
  "debate:flow-auto-save",
  "drillSets",
  "favorite-tools",
  "fontFamily",
  "judgeDecisions",
  "myRankedTeams",
  "myTeamProfile",
  // News stream read / liked state: merged with the account's row by `newsStream.ts`.
  "newsStreamViewerState",
  "outline-filter-presets",
  "qualificationCutoff",
  "qualificationPointsTable",
  "recent-tools",
  "researchProgressGoals",
  "roundPairings",
  "saved-argument-collections",
  "sprintSessions",
  "strategyRecommendations",
  "streakFreezes",
  "streakLapseReminders",
  "tournamentResults",
  "word-limit-presets",
  "wordCountRounds",
  // Speech start marks are published for every viewer (`sharedVideoAi.ts`); this copy only bridges the publish.
  "debate-videos:speech-starts",
]);

/** Stores that describe this browser rather than this user, or hold nothing worth syncing. */
const DEVICE_LOCAL = new Set([
  "accountNotifications:lastSeenId",
  "admin:speech-analysis-prompt",
  "admin:watch-ai-cursor",
  "argumentTreeViewMode",
  "brainstormSessionTimer",
  "cardShares:lastSeenUpdatedAt",
  "caselist-sync-log",
  "debate-ai.ownAiKey",
  "debate-ai:debug",
  "debate-ai:speech-judge-draft",
  "debate-ai:my-files:file-index",
  "debate-ai:topic-starters:file-index",
  "debate-playback-speed",
  "debate-recording-captions",
  "debate-videos:outcome-lens",
  "debate-videos:outcome-panel",
  "debate-videos:watch-auto-scroll",
  "debate-videos:watch-skip-breaks",
  "debate:account-save-baselines",
  "debateVideoIndex",
  "debaterDeviceId",
  "firstLoginWelcomeShown",
  "flowPresenceHeartbeats",
  "judgeRoundRecordEditHistory",
  "judgeRoundRecordRedoHistory",
  "opponentRoundRecordEditHistory",
  "opponentRoundRecordRedoHistory",
  "persistent-video-player",
  "prepNoteNotifications:lastRecipientId",
  "reason-editor-sidebar-files-open",
  "reason-editor-sidebar-sort",
  "reason-editor-sidebar-topic-split",
  "reason-editor-sidebar-topics-open",
  "round-sidebar-sections",
  "signInPromptsOptedOut",
  "signInPromptsShownAt",
  "topicPresenceHeartbeats",
  "video-timestamps",
  "visitorLocation:v1",
  // Unsent setup drafts for a practice debate vs AI: restored on this device only.
  "botSelectionState",
  "practiceSetupWizard",
  // Caches of server / AI results: rebuilt on demand, nothing the user owns.
  "cardsSearch:defaultResults:v1",
  "debate-videos:speech-segmentations",
  "debate-videos:speech-summaries",
  // Recorder: clip blobs live in this browser's IndexedDB, and recording webcam / screen is a per-browser choice.
  "debate-video-clips",
  "debate-recording-screen",
  "debate-recording-video",
  // Layout and navigation state of this window.
  "app-dock-hidden",
  "app-sidebar-collapsed",
  "app-sidebar-width",
  "coachHubSection",
  "coachingSection",
  "debate-videos:mini-player-on-top",
  "newsAndForumsSection",
  "practiceDebatesSection",
  "prepWorkspaceSection",
  "researchHubSection",
  "rulesAndGlossarySection",
  "sidebar-icon-animations",
  // Who is using this browser, and per-browser one-time flags.
  "firstLoginWelcomeSynced",
  "guestVideosWatched",
  "researchHubContributorId",
  // Cross-tab coordination: which tab owns video playback.
  "video-playback-owner",
  // Sample data: the manifest of seeded ids and the sample flow never leave the device.
  "sampleDataFlow",
  "sampleDataRecords",
  // Desktop (Tauri) flow app: dev-only memory file system, IndexedDB migration flag, updater setting.
  "df-update-settings",
  "ebb-dev-flow-files",
  "ebb-dev-recents",
  "ebb-idb-migrated",
  // Admin tools: a resume cursor for one admin's browser.
  "admin:card-sources-cursor",
]);

/** Pre-sync keys a store migrates out of on first read; the data now lives in a synced store. */
const MIGRATED_LEGACY = new Set([
  "debate:flow-auto-save-enabled",
  "pinned-debates",
  "speech-doc-links",
]);

/** `*_KEY` constants the scan finds that are not `localStorage` stores. */
const NOT_LOCAL_STORAGE = new Set([
  // IndexedDB meta record key in the Topic Starters cache.
  "__version__",
  // URL hash parameter handing the extension its token.
  "debate_ai_ext_token",
  // Tool-record collection name used to look up a sync status, not a store.
  "flowHistory",
  // sessionStorage: per-tab flags that must not outlive the tab.
  "debate-ai:stale-build-reload",
  "toolRecordSyncHydratedAt",
]);

const CLASSIFIED = [SYNCED_ELSEWHERE, DEVICE_LOCAL, MIGRATED_LEGACY, NOT_LOCAL_STORAGE];

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

function declaredStorageKeys(): Set<string> {
  const keys = new Set<string>();
  for (const pkg of readdirSync(PACKAGES_DIR)) {
    const src = join(PACKAGES_DIR, pkg, "src");
    try {
      if (!statSync(src).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of sourceFiles(src)) {
      for (const [, name, key] of readFileSync(file, "utf8").matchAll(STORAGE_KEY_PATTERN)) {
        if (!CREDENTIAL_NAME_PATTERN.test(name)) keys.add(key);
      }
    }
  }
  return keys;
}

describe("localStorage store coverage", () => {
  const declared = declaredStorageKeys();
  const catalog = new Set(TOOL_RECORD_COLLECTIONS.map((collection) => collection.storageKey));

  it("finds the stores to audit", () => {
    expect(declared.size).toBeGreaterThan(50);
  });

  it("sees stores declared under names other than STORAGE_KEY", () => {
    for (const key of ["sound-effect-level", "practiceSetupWizard", "debate-video-clips", "pinnedDebates"]) {
      expect(declared.has(key), key).toBe(true);
    }
  });

  it("skips credential constants named *API_KEY", () => {
    expect(CREDENTIAL_NAME_PATTERN.test("PRODUCTION_AMPLITUDE_API_KEY")).toBe(true);
    expect(CREDENTIAL_NAME_PATTERN.test("SOUND_EFFECT_LEVEL_KEY")).toBe(false);
  });

  it("classifies every *_KEY store as synced or device-local", () => {
    const unclassified = [...declared].filter(
      (key) => !catalog.has(key) && !CLASSIFIED.some((list) => list.has(key)),
    );

    expect(
      unclassified,
      "add each to TOOL_RECORD_COLLECTIONS (preferred), or to SYNCED_ELSEWHERE / DEVICE_LOCAL / MIGRATED_LEGACY / NOT_LOCAL_STORAGE here with a reason",
    ).toEqual([]);
  });

  it("keeps the classification lists free of stale and overlapping entries", () => {
    const listed = CLASSIFIED.flatMap((list) => [...list]);
    const stale = listed.filter((key) => !declared.has(key));
    const overlapping = listed.filter(
      (key) => catalog.has(key) || CLASSIFIED.filter((list) => list.has(key)).length > 1,
    );

    expect(stale).toEqual([]);
    expect(overlapping).toEqual([]);
  });
});
