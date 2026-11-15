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
 * `*API_KEY` are credentials, not storage keys, and are skipped by name, as is
 * any value shaped like a Google API key.
 *
 * Besides constants, the scan reads every literal key passed straight to
 * `localStorage.getItem / setItem / removeItem("…")`. A template-string key
 * (`` `debate-recording-${speechName}` ``) is audited by its static prefix, as
 * `debate-recording-*`. It covers every package's `src/` and the web app's
 * `app/`, `lib/` and `worker/` trees, skipping test folders.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_RECORD_COLLECTIONS } from "../../src/account-sync/toolRecordCollections";

const PACKAGES_DIR = join(import.meta.dirname, "..", "..", "..");
const WEB_APP_DIR = join(PACKAGES_DIR, "..", "apps", "debate-web");
/** Web-app source trees; `components/`, `public/` and build output hold no stores. */
const WEB_APP_SOURCE_DIRS = ["app", "lib", "worker"];
/** Folders whose files are tests or fixtures, not shipped stores. */
const TEST_DIRS = new Set(["__tests__", "test", "tests"]);
/** `STORAGE_KEY = "…"` and every other `SOME_NAME_KEY = "…"` constant. Group 1 is the name, group 2 the key. */
const STORAGE_KEY_PATTERN = /\b((?:[A-Z][A-Z0-9_]*_)?KEY)\s*=\s*"([A-Za-z0-9_.:-]+)"/g;
/** Names that hold a credential rather than a storage key. */
const CREDENTIAL_NAME_PATTERN = /API_KEY$/;
/** Values that are a Google API key (e.g. the public InnerTube key), whatever the constant is called. */
const CREDENTIAL_VALUE_PATTERN = /^AIza[0-9A-Za-z_-]{35}$/;
/**
 * A key passed as a literal to `localStorage.getItem / setItem / removeItem`.
 * Group 2 is the key text up to the closing quote or the first `${`.
 */
const INLINE_KEY_PATTERN = /\blocalStorage\??\.(?:getItem|setItem|removeItem)\(\s*(["'`])((?:(?!\1|\$\{).)+)(\$\{)?/g;

/** Stores that sync through a dedicated route, `user_settings` column or saved_* table. */
const SYNCED_ELSEWHERE = new Set([
  "REASON-documents",
  "coachMaterialVersions",
  "coachMaterials",
  "counselPanelAssessments",
  "customOpponentPersonaLibrary",
  // Color theme: the `color_theme` column of `user_settings` (`ThemeDropdown`, Round settings).
  "color-theme",
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
  // Round settings (`debateStyle`, `fontSize`): the matching `user_settings` columns via `UserSettingsPanel`.
  "settings",
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
  // One speech's recorded audio as a data URL: far too large for an account row.
  "debate-recording-*",
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
  // Debate Editor (upstream): a feature flag, a save-repair diagnostic log, the
  // navigation pane's width / depth, and collab identity / relay settings, which
  // stay per device like the flow editor's `collab*` settings.
  "cm-save-heal-log",
  "pmd-collab-web-relay-token",
  "pmd-collab-web-relay-url",
  "pmd-compress",
  "pmd-nav-max-level",
  "pmd-nav-width",
  "pmd-web-guest-name",
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

/**
 * Browser-only stores that arguably belong to the user, where syncing needs a
 * product call first. Each is a tracked follow-up (TODO.md) and a Known gap in
 * `dev-docs/internals/tool-data-sync.mdx`; listing one here keeps the guard
 * failing for the *next* unclassified store without pretending this one is fine.
 */
const AWAITING_DECISION = new Set([
  // QwkSearch chat model choice: providers are configured per install, so a synced pick may not exist elsewhere.
  "chatModelKey",
  "chatModelProviderId",
  // Debate Editor plugin settings, one JSON bag per plugin id.
  "plugin:*",
]);

/**
 * Keys that only exist in the Debate Editor's upstream source: the
 * `debate-editor-cm` submodule and the `debate-editor/src` that
 * `sync-upstream.mjs` assembles from it. CI has both; a checkout without the
 * submodule does not, so these are not called stale when that source is absent.
 */
const EDITOR_ONLY = new Set([
  "cm-save-heal-log",
  "plugin:*",
  "pmd-collab-web-relay-token",
  "pmd-collab-web-relay-url",
  "pmd-compress",
  "pmd-nav-max-level",
  "pmd-nav-width",
  "pmd-web-guest-name",
]);
const EDITOR_SOURCE_DIRS = ["debate-editor", "debate-editor-cm"].map((pkg) => join(PACKAGES_DIR, pkg, "src"));

const CLASSIFIED = [SYNCED_ELSEWHERE, DEVICE_LOCAL, MIGRATED_LEGACY, NOT_LOCAL_STORAGE, AWAITING_DECISION];

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || TEST_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path);
  }
  return files;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Every source tree the guard audits: each package's `src/` and the web app's source folders. */
function auditedRoots(): string[] {
  return [
    ...readdirSync(PACKAGES_DIR).map((pkg) => join(PACKAGES_DIR, pkg, "src")),
    ...WEB_APP_SOURCE_DIRS.map((dir) => join(WEB_APP_DIR, dir)),
  ].filter(isDirectory);
}

/** The storage keys one source file declares: `*_KEY` constants plus literal `localStorage` keys. */
function storageKeysIn(source: string): string[] {
  const keys: string[] = [];
  for (const [, name, key] of source.matchAll(STORAGE_KEY_PATTERN)) {
    if (!CREDENTIAL_NAME_PATTERN.test(name) && !CREDENTIAL_VALUE_PATTERN.test(key)) keys.push(key);
  }
  for (const [, , text, interpolation] of source.matchAll(INLINE_KEY_PATTERN)) {
    keys.push(interpolation ? `${text}*` : text);
  }
  return keys;
}

function declaredStorageKeys(): Set<string> {
  const keys = new Set<string>();
  for (const root of auditedRoots()) {
    for (const file of sourceFiles(root)) {
      for (const key of storageKeysIn(readFileSync(file, "utf8"))) keys.add(key);
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

  it("audits the web app's source as well as the packages", () => {
    expect(auditedRoots()).toContain(join(WEB_APP_DIR, "app"));
    expect(auditedRoots()).toContain(join(WEB_APP_DIR, "lib"));
  });

  it("sees literal and template-string keys passed straight to localStorage", () => {
    const source = [
      `localStorage.getItem("color-theme")`,
      `window.localStorage.setItem('chatModelKey', key)`,
      "localStorage?.removeItem(`debate-recording-${speechName}`)",
      "localStorage.getItem(`plain-template`)",
      `localStorage.getItem(SOME_KEY)`,
      `sessionStorage.getItem("tab-only")`,
    ].join("\n");

    expect(storageKeysIn(source)).toEqual([
      "color-theme",
      "chatModelKey",
      "debate-recording-*",
      "plain-template",
    ]);
    for (const key of ["color-theme", "settings", "debate-recording-*", "chatModelKey"]) {
      expect(declared.has(key), key).toBe(true);
    }
  });

  it("skips credential values even under a plain *_KEY name", () => {
    const googleKey = `AIza${"x".repeat(35)}`;
    expect(storageKeysIn(`const INNERTUBE_KEY = "${googleKey}";`)).toEqual([]);
    expect(storageKeysIn(`const DRAFT_KEY = "speech-draft";`)).toEqual(["speech-draft"]);
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
      "add each to TOOL_RECORD_COLLECTIONS (preferred), or to SYNCED_ELSEWHERE / DEVICE_LOCAL / MIGRATED_LEGACY / NOT_LOCAL_STORAGE / AWAITING_DECISION here with a reason",
    ).toEqual([]);
  });

  it("keeps the classification lists free of stale and overlapping entries", () => {
    const listed = CLASSIFIED.flatMap((list) => [...list]);
    const editorSourcePresent = EDITOR_SOURCE_DIRS.some(isDirectory);
    const stale = listed.filter(
      (key) => !declared.has(key) && (editorSourcePresent || !EDITOR_ONLY.has(key)),
    );
    const overlapping = listed.filter(
      (key) => catalog.has(key) || CLASSIFIED.filter((list) => list.has(key)).length > 1,
    );

    expect(stale).toEqual([]);
    expect(overlapping).toEqual([]);
    expect([...EDITOR_ONLY].filter((key) => !CLASSIFIED.some((list) => list.has(key)))).toEqual([]);
  });
});
