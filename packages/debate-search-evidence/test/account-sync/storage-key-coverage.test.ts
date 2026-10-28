/**
 * @fileoverview Guards the "every tool store reaches the user's account" rule.
 *
 * A tool that persists to `localStorage` under a `STORAGE_KEY` constant must
 * either join `TOOL_RECORD_COLLECTIONS` (the generic account sync), sync through
 * its own route / `user_settings` column, or be declared device-local here. A
 * new store that is none of these is exactly the silent gap this test names:
 * the tool works, nothing fails, and the data never leaves the browser.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_RECORD_COLLECTIONS } from "../../src/account-sync/toolRecordCollections";

const PACKAGES_DIR = join(import.meta.dirname, "..", "..", "..");
const STORAGE_KEY_PATTERN = /STORAGE_KEY\s*=\s*"([A-Za-z0-9_.:-]+)"/g;

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
]);

/** Stores that describe this browser rather than this user, or hold nothing worth syncing. */
const DEVICE_LOCAL = new Set([
  "accountNotifications:lastSeenId",
  "admin:speech-analysis-prompt",
  "argumentTreeViewMode",
  "brainstormSessionTimer",
  "cardShares:lastSeenUpdatedAt",
  "caselist-sync-log",
  "debate-ai.ownAiKey",
  "debate-ai:speech-judge-draft",
  "debate-playback-speed",
  "debate-recording-captions",
  "debate-videos:outcome-lens",
  "debate-videos:outcome-panel",
  "debate-videos:watch-auto-scroll",
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
  "reason-editor-sidebar-topics-open",
  "round-sidebar-sections",
  "signInPromptsOptedOut",
  "signInPromptsShownAt",
  "topicPresenceHeartbeats",
  "video-timestamps",
  "visitorLocation:v1",
]);

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
      for (const match of readFileSync(file, "utf8").matchAll(STORAGE_KEY_PATTERN)) keys.add(match[1]);
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

  it("classifies every STORAGE_KEY store as synced or device-local", () => {
    const unclassified = [...declared].filter(
      (key) => !catalog.has(key) && !SYNCED_ELSEWHERE.has(key) && !DEVICE_LOCAL.has(key),
    );

    expect(
      unclassified,
      "add each to TOOL_RECORD_COLLECTIONS (preferred), or to SYNCED_ELSEWHERE / DEVICE_LOCAL here with a reason",
    ).toEqual([]);
  });

  it("keeps the classification lists free of stale and overlapping entries", () => {
    const stale = [...SYNCED_ELSEWHERE, ...DEVICE_LOCAL].filter((key) => !declared.has(key));
    const overlapping = [...SYNCED_ELSEWHERE, ...DEVICE_LOCAL].filter(
      (key) => catalog.has(key) || (SYNCED_ELSEWHERE.has(key) && DEVICE_LOCAL.has(key)),
    );

    expect(stale).toEqual([]);
    expect(overlapping).toEqual([]);
  });
});
