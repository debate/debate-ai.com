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
 * `getItem / setItem / removeItem("…")`, whatever the receiver
 * (`localStorage`, `window.sessionStorage`, an injected `storage`). A
 * template-string key (`` `debate-recording-${speechName}` ``) is audited by
 * its static prefix, as `debate-recording-*`.
 *
 * It also follows wrappers. A function that hands one of its parameters on
 * as the key of `getItem / setItem / removeItem`, or of another wrapper, is a
 * storage wrapper (`getBulkItem(key)`, `readLocalRecords(key)`,
 * `persist(value, key)`), and a literal passed in that position anywhere in
 * the audited source is a store key, so `setBulkItem("flows", …)` is audited
 * like `localStorage.setItem("flows", …)`. The key may also travel inside an
 * options object: a wrapper that passes `options.key`, or a destructured
 * `{ key }`, is called as `store({ key: "…" })`, and that property is audited.
 * Wrappers are found textually: a function body is read up to the next line,
 * indented no deeper than the definition, that starts with anything but `}`,
 * and a wrapper is known by its name across files.
 *
 * It covers every package's `src/` and the web app's `app/`, `lib/` and
 * `worker/` trees, skipping test folders.
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
/** The Web Storage calls a key reaches: `x.getItem(`, `x?.setItem(`, `x.removeItem(`. */
const STORAGE_CALL = String.raw`\.(?:getItem|setItem|removeItem)`;
/** A literal (or template prefix) key. Group 1 is the quote, group 2 the text up to the closing quote or first `${`, group 3 the `${`. */
const LITERAL_KEY = String.raw`^(["'\`])((?:(?!\1|\$\{).)+)(\$\{)?`;
/**
 * A call that may pass a key: a Web Storage method (group 1) or a plain
 * function call (group 2), up to and including its `(`. A method of the same
 * name as a wrapper (`obj.readKey(`) is neither, and neither is prose with a
 * space before the parenthesis (a comment's ``handle (`some-team`)``).
 */
const CALL_PATTERN = new RegExp(String.raw`(${STORAGE_CALL})\(|(?<![\w$.])([A-Za-z_$][\w$]*)\(`, "g");
/**
 * A function definition, up to and including the `(` of its parameter list:
 * `function name(` or `const name = (` (optionally `async`, optionally
 * generic). Group 1 or 2 is the name.
 */
const FUNCTION_DEFINITION_PATTERN =
  /(?:function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:<[^>]*>)?\()/g;
/** An identifier at the start of a parameter (after any `...`). */
const IDENTIFIER = /^(?:\.\.\.)?([A-Za-z_$][\w$]*)/;

/** Where a storage wrapper takes its key: the argument at `index`, or that argument's `property`. */
interface KeySlot {
  index: number;
  property?: string;
}

/** An expression passed as a key; `property` when it is an options object whose `property` holds the key. */
interface KeyPass {
  expression: string;
  property?: string;
}

/** Stores that sync through a dedicated route, `user_settings` column or saved_* table. */
const SYNCED_ELSEWHERE = new Set([
  "REASON-documents",
  "coachMaterialVersions",
  "coachMaterials",
  "counselPanelAssessments",
  "customOpponentPersonaLibrary",
  // Color theme: the `color_theme` column of `user_settings` (`ThemeDropdown`, Round settings).
  "color-theme",
  // Team Brainstorm Assist session timer: the `brainstorm_session_timer` column of `user_settings`
  // (`useBrainstormSessionTimerSync`, `PUT /api/settings { brainstormSessionTimer }`).
  "brainstormSessionTimer",
  "dailyBestCardComments",
  "debate:flow-auto-save",
  "drillSets",
  "favorite-tools",
  // Username for personal file URLs: a cache of `user_handles` (`/api/users/handle`, use-personal-username.ts).
  "debate-ai:personal-username",
  // First-sign-in welcome: a cache of `user_settings.welcome_dismissed_at` (`/api/settings/welcome`,
  // first-login-welcome.ts). `firstLoginWelcomeSynced`, whether this browser has pushed it, stays device-local.
  "firstLoginWelcomeShown",
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
  // Flows and rounds: kept on device by `bulk-storage.ts` (`getBulkItem("flows")`), synced to `saved_flows` / `saved_rounds`.
  "flows",
  "rounds",
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
  // apps/debate-web/lib/chunk-reload: when this tab last reloaded for a stale chunk.
  "dai-chunk-reload-at",
  // Drill ids whose win already paid Debater Level XP on this device; the drills themselves live in D1.
  "rebuttalDrillPaidWins",
  "accountNotifications:lastSeenId",
  "admin:speech-analysis-prompt",
  "admin:watch-ai-cursor",
  "argumentTreeViewMode",
  "cardShares:lastSeenUpdatedAt",
  "caselist-sync-log",
  "debate-ai.ownAiKey",
  "debate-ai:debug",
  "debate-ai:speech-judge-draft",
  "debate-ai:my-files:file-index",
  "debate-ai:topic-starters:file-index",
  "debate-recording-captions",
  "debate-videos:outcome-lens",
  "debate-videos:outcome-panel",
  "debate:account-save-baselines",
  "debateVideoIndex",
  "debaterDeviceId",
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
  // Sync bookkeeping: the ids the account held at this browser's last merge, per account (`synced-id-baseline.ts`).
  "toolRecordSyncedIds",
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

/** The index of the quote that closes the string starting at `start`, or -1. */
function stringEnd(text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === quote) return i;
    else if (text[i] === "\n" && quote !== "`") return -1;
  }
  return -1;
}

/**
 * Splits the bracketed list opening at `open` (`(`, `{` or `[`) into its
 * top-level items, skipping strings and comments. With `angle`, `<…>` nests as
 * well, for type arguments in a parameter list (`Map<string, number>`); call
 * arguments leave it off, where `<` is a comparison. Returns null when the
 * list does not close.
 */
function splitList(text: string, open: number, angle = false): { items: string[]; end: number } | null {
  const closers: Record<string, string> = { "(": ")", "[": "]", "{": "}", "<": ">" };
  const stack: string[] = [];
  const items: string[] = [];
  let start = open + 1;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = stringEnd(text, i);
      if (i < 0) return null;
    } else if (ch === "/" && text[i + 1] === "/") {
      i = text.indexOf("\n", i);
      if (i < 0) return null;
    } else if (ch === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1;
      if (i <= 0) return null;
    } else if (closers[ch] && (ch !== "<" || angle)) {
      stack.push(closers[ch]);
    } else if (ch === ")" || ch === "]" || ch === "}" || (ch === ">" && angle && text[i - 1] !== "=")) {
      if (stack.pop() !== ch) return null;
      if (stack.length === 0) {
        items.push(text.slice(start, i));
        const trimmed = items.map((item) => item.trim());
        if (trimmed.at(-1) === "") trimmed.pop();
        return { items: trimmed, end: i };
      }
    } else if (ch === "," && stack.length === 1) {
      items.push(text.slice(start, i));
      start = i + 1;
    }
  }
  return null;
}

/** The value an object literal gives `property`: `{ key: "x" }` → `"x"`, shorthand `{ key }` → `key`. */
function propertyValue(objectLiteral: string, property: string): string | undefined {
  for (const entry of splitList(objectLiteral, 0)?.items ?? []) {
    const match = /^(["']?)([A-Za-z_$][\w$]*)\1\s*(?::\s*([\s\S]+))?$/.exec(entry);
    if (match?.[2] === property) return match[3]?.trim() ?? property;
  }
  return undefined;
}

/**
 * Every expression `text` passes as a storage key: the first argument of a Web
 * Storage call, or the argument (or options property) in a known wrapper's
 * key slot.
 */
function keyPasses(text: string, wrappers: ReadonlyMap<string, KeySlot>): KeyPass[] {
  const passes: KeyPass[] = [];
  for (const match of text.matchAll(CALL_PATTERN)) {
    const slot: KeySlot | undefined = match[1] ? { index: 0 } : wrappers.get(match[2]);
    if (!slot) continue;
    const argument = splitList(text, match.index + match[0].length - 1)?.items[slot.index];
    if (!argument) continue;
    if (!slot.property) passes.push({ expression: argument });
    else if (argument.startsWith("{")) {
      const value = propertyValue(argument, slot.property);
      if (value) passes.push({ expression: value });
    } else passes.push({ expression: argument, property: slot.property });
  }
  return passes;
}

/** Strips a non-null assertion or `as` cast from a key expression. */
function bareExpression(expression: string): string {
  return expression.replace(/\s+as\s+[\s\S]+$/, "").replace(/!$/, "");
}

/**
 * The key slot a function's parameters fill, given what its body passes as
 * keys: a parameter passed as-is, a parameter's property (`options.key`), or a
 * name destructured from one (`{ key }`).
 */
function keySlotOf(params: readonly string[], passes: readonly KeyPass[]): KeySlot | undefined {
  for (const [index, param] of params.entries()) {
    const locals = new Map<string, string | undefined>();
    if (param.startsWith("{")) {
      for (const entry of splitList(param, 0)?.items ?? []) {
        const match = /^(?:\.\.\.)?([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?/.exec(entry);
        if (match) locals.set(match[2] ?? match[1], match[1]);
      }
    } else {
      const name = IDENTIFIER.exec(param)?.[1];
      if (name) locals.set(name, undefined);
    }
    for (const pass of passes) {
      const expression = bareExpression(pass.expression);
      if (locals.has(expression)) {
        const property = pass.property ?? locals.get(expression);
        if (pass.property && locals.get(expression)) continue;
        return property ? { index, property } : { index };
      }
      const member = /^([A-Za-z_$][\w$]*)\??\.([A-Za-z_$][\w$]*)$/.exec(expression);
      if (member && !pass.property && locals.has(member[1]) && !locals.get(member[1])) {
        return { index, property: member[2] };
      }
    }
  }
  return undefined;
}

/** The indentation of the line holding `index`. */
function indentOf(source: string, index: number): number {
  const lineStart = source.lastIndexOf("\n", index) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart))?.[0].length ?? 0;
}

/**
 * Where a definition indented by `indent` ends: the next line indented no
 * deeper that starts with anything but `}`. A top-level function ends at the
 * next column-0 line; a handler nested in a component ends with its own
 * block, not the component's.
 */
function bodyEnd(indent: number): RegExp {
  return new RegExp(String.raw`\n(?=[ \t]{0,${indent}}[^\s}])`);
}

/**
 * The storage wrappers the sources define, each with its key slot: functions
 * that pass a parameter on as a Web Storage key, or as the key of a wrapper
 * found in an earlier pass (so `setBulkItem` → `writeLegacy` →
 * `storage.setItem` counts).
 */
function storageWrappers(sources: readonly string[]): Map<string, KeySlot> {
  const wrappers = new Map<string, KeySlot>();
  for (let found = true; found; ) {
    found = false;
    for (const source of sources) {
      for (const match of source.matchAll(FUNCTION_DEFINITION_PATTERN)) {
        const name = match[1] ?? match[2];
        if (wrappers.has(name)) continue;
        const params = splitList(source, match.index + match[0].length - 1, true);
        if (!params) continue;
        const rest = source.slice(params.end + 1);
        const end = rest.search(bodyEnd(indentOf(source, match.index)));
        const slot = keySlotOf(params.items, keyPasses(end < 0 ? rest : rest.slice(0, end), wrappers));
        if (slot) {
          wrappers.set(name, slot);
          found = true;
        }
      }
    }
  }
  return wrappers;
}

/**
 * The storage keys one source file declares: `*_KEY` constants, and literal
 * keys passed to `getItem / setItem / removeItem` or in the key slot of any
 * of the given storage wrappers.
 */
function storageKeysIn(source: string, wrappers: ReadonlyMap<string, KeySlot> = new Map()): string[] {
  const keys: string[] = [];
  for (const [, name, key] of source.matchAll(STORAGE_KEY_PATTERN)) {
    if (!CREDENTIAL_NAME_PATTERN.test(name) && !CREDENTIAL_VALUE_PATTERN.test(key)) keys.push(key);
  }
  for (const pass of keyPasses(source, wrappers)) {
    const literal = pass.property ? null : new RegExp(LITERAL_KEY).exec(pass.expression);
    if (literal) keys.push(literal[3] ? `${literal[2]}*` : literal[2]);
  }
  return keys;
}

function auditedSources(): string[] {
  return auditedRoots().flatMap((root) => sourceFiles(root).map((file) => readFileSync(file, "utf8")));
}

function declaredStorageKeys(sources: readonly string[], wrappers: ReadonlyMap<string, KeySlot>): Set<string> {
  const keys = new Set<string>();
  for (const source of sources) {
    for (const key of storageKeysIn(source, wrappers)) keys.add(key);
  }
  return keys;
}

describe("localStorage store coverage", () => {
  const sources = auditedSources();
  const wrappers = storageWrappers(sources);
  const declared = declaredStorageKeys(sources, wrappers);
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
      `storage.setItem("injected-store", value)`,
    ].join("\n");

    expect(storageKeysIn(source)).toEqual([
      "color-theme",
      "chatModelKey",
      "debate-recording-*",
      "plain-template",
      "tab-only",
      "injected-store",
    ]);
    for (const key of ["color-theme", "settings", "debate-recording-*", "chatModelKey"]) {
      expect(declared.has(key), key).toBe(true);
    }
  });

  it("finds storage wrappers, including wrappers of wrappers", () => {
    const sources = [
      [
        "function writeLegacy(key: string, value: string): void {",
        "  storage.setItem(key, value)",
        "}",
        "export function setBulkItem(key: BulkKey, value: string): void {",
        "  cache.set(key, value)",
        "  writeLegacy(key, value)",
        "}",
        "export const readRecords = async <T,>(name: string) => JSON.parse(localStorage.getItem(name) ?? \"[]\")",
        "function render(props: Props) {",
        "  return localStorage.getItem(OTHER_KEY)",
        "}",
        "function handle(event: Event) {",
        "  localStorage.removeItem(\"fixed\")",
        "}",
      ].join("\n"),
    ];

    expect([...storageWrappers(sources).keys()].sort()).toEqual(["readRecords", "setBulkItem", "writeLegacy"]);
  });

  it("sees literal keys passed to a storage wrapper", () => {
    const wrappers = new Map([
      ["setBulkItem", { index: 0 }],
      ["readRecords", { index: 0 }],
    ]);
    const source = [
      `setBulkItem("flows", JSON.stringify(flows))`,
      "readRecords(`speech-${id}`)",
      `obj.setBulkItem("method-not-wrapper", x)`,
      `notsetBulkItem("other-function", x)`,
      `readJson(response, "Couldn't load.")`,
    ].join("\n");

    expect(storageKeysIn(source, wrappers)).toEqual(["flows", "speech-*"]);
  });

  it("finds wrappers that take the key in a later parameter or an options object", () => {
    const sources = [
      [
        "function persist<T>(value: Map<string, T>, key: string, onError?: (e: Error) => void) {",
        "  try {",
        "    localStorage.setItem(key, JSON.stringify([...value]))",
        "  } catch (e) {",
        "    onError?.(e as Error)",
        "  }",
        "}",
        "export function readStore({ key, fallback }: { key: string; fallback: string }) {",
        "  return localStorage.getItem(key) ?? fallback",
        "}",
        "export const writeStore = (value: string, options: { storageKey: string }) => {",
        "  window.localStorage?.setItem(options.storageKey, value)",
        "}",
        "function renamed({ key: name }: Options) {",
        "  sessionStorage.removeItem(name)",
        "}",
        "function forward(opts: Options) {",
        "  return readStore(opts)",
        "}",
        "function notAWrapper(value: string, key: string) {",
        "  cache.set(key, value)",
        "}",
        "export function Panel({ rows }: Props) {",
        "  const startEdit = (row: Row) => {",
        "    setEditingId(row.id)",
        "  }",
        "  rows.forEach((row) => localStorage.removeItem(row.id))",
        "}",
      ].join("\n"),
    ];

    expect(Object.fromEntries(storageWrappers(sources))).toEqual({
      persist: { index: 1 },
      readStore: { index: 0, property: "key" },
      writeStore: { index: 1, property: "storageKey" },
      renamed: { index: 0, property: "key" },
      forward: { index: 0, property: "key" },
    });
  });

  it("sees literal keys in a wrapper's later parameter or options object", () => {
    const wrappers = new Map([
      ["persist", { index: 1 }],
      ["readStore", { index: 0, property: "key" }],
    ]);
    const source = [
      `persist(new Map([["a", 1]]), "later-param", (e) => console.warn(e, "not-a-key"))`,
      "persist(value, `templated-${id}`)",
      `readStore({ key: "options-key", fallback: "not-a-key" })`,
      `readStore({ "key": 'quoted-property' })`,
      `readStore({ fallback: "no-key-property" })`,
      `readStore(options)`,
      `persist("first-param-not-the-key")`,
      "// a team handle (`harvard-university-bm`), not a call",
    ].join("\n");
    wrappers.set("handle", { index: 0 });

    expect(storageKeysIn(source, wrappers)).toEqual(["later-param", "templated-*", "options-key", "quoted-property"]);
  });

  it("finds the codebase's later-parameter and options-object wrappers", () => {
    expect(wrappers.get("useHubSection")).toEqual({ index: 1 });
    expect(wrappers.get("readLocalToolRecords")).toEqual({ index: 0, property: "storageKey" });
    expect(wrappers.get("writeLocalToolRecords")).toEqual({ index: 0, property: "storageKey" });
  });

  it("audits flows and rounds through the bulk-storage wrappers", () => {
    for (const name of ["getBulkItem", "setBulkItem", "removeBulkItem", "readLocalRecords"]) {
      expect(wrappers.has(name), name).toBe(true);
    }
    for (const key of ["flows", "rounds"]) expect(declared.has(key), key).toBe(true);
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
