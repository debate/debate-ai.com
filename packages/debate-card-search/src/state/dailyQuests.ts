/**
 * @fileoverview Persistent storage for `daily-quests.ts`'s `QuestTemplate`
 * roster and its board composition against real contributions — the "(a)
 * wiring real contribution-submission events into a persisted daily feed"
 * and "(b) a quest-board widget UI" follow-ups named under the "🎯 Daily
 * Quests and Targets" bullet in TODO.md. Stores `QuestTemplate`s in
 * localStorage, mirroring the existing `dailyMissionResults.ts`/
 * `trackedArguments.ts` persistence convention (SSR/no-storage-safe, corrupt
 * or missing JSON degrades to an empty list rather than throwing).
 *
 * `buildPersistedDailyQuestBoard` closes follow-up (a) by composing the
 * stored quest roster directly against `state/contributions.ts`'s real,
 * persisted contribution feed rather than a caller-supplied list — reusing
 * `dailyMissionResults.ts`'s `hasSubmittedAt` guard convention, since not
 * every persisted contribution necessarily carries the `submittedAt`
 * timestamp `daily-quests.ts` needs to match it to a calendar day.
 *
 * `seedQuestTemplatesFromTopicCoverage` closes the rest of follow-up (b) by
 * turning a topic's under-covered tracked arguments (via the already-
 * persisted `state/trackedArguments.ts` store and the pure
 * `buildUnderCoveredArgumentQuests`) directly into saved quest templates, so
 * a team doesn't have to hand-author quests that duplicate what the Topic
 * Coverage Dashboard already knows is missing.
 *
 * `pruneExpiredQuestTemplates` closes the "a quest template has no expiry"
 * Known gap: it removes every persisted template whose `expiresOn` (a
 * `daily-quests.ts` addition) has passed as of a caller-supplied day,
 * archiving it out of the roster.
 *
 * @module state/dailyQuests
 */

import type { AttributedContribution } from "../lib/contribution-leaderboard";
import { getUtcDayKey } from "../lib/daily-best-card";
import {
  buildDailyQuestBoard,
  buildUnderCoveredArgumentQuests,
  isQuestTemplateExpired,
  type QuestContribution,
  type QuestProgress,
  type QuestTemplate,
} from "../lib/daily-quests";
import type { CoverageThresholds } from "../lib/topic-coverage";
import { listContributions } from "./contributions";
import { buildPersistedTopicCoverageReport } from "./trackedArguments";

const STORAGE_KEY = "dailyQuestTemplates";

function readAll(): QuestTemplate[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QuestTemplate[]) : [];
  } catch {
    return [];
  }
}

function writeAll(templates: QuestTemplate[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

/** Lists every persisted quest template. */
export function listQuestTemplates(): QuestTemplate[] {
  return readAll();
}

/** Saves a quest template, overwriting any existing template with the same id. */
export function saveQuestTemplate(template: QuestTemplate): void {
  const templates = readAll();
  const index = templates.findIndex((existing) => existing.id === template.id);
  if (index === -1) {
    templates.push(template);
  } else {
    templates[index] = template;
  }
  writeAll(templates);
}

/** Deletes a persisted quest template by id; a no-op if it isn't stored. */
export function deleteQuestTemplate(id: string): void {
  writeAll(readAll().filter((template) => template.id !== id));
}

/**
 * Removes every persisted quest template whose `expiresOn` has passed as of
 * the UTC calendar day of `now` (via `lib/daily-quests.ts`'s
 * `isQuestTemplateExpired`), archiving them out of the stored roster rather
 * than leaving them to keep taking up space once `buildDailyQuestBoard`
 * already excludes them from scoring. Templates with no `expiresOn`, or
 * whose `expiresOn` hasn't passed yet, are left untouched. Returns how many
 * were removed.
 */
export function pruneExpiredQuestTemplates(now: number): number {
  const dayKey = getUtcDayKey(now);
  const templates = readAll();
  const remaining = templates.filter((template) => !isQuestTemplateExpired(template, dayKey));
  const removedCount = templates.length - remaining.length;
  if (removedCount > 0) writeAll(remaining);
  return removedCount;
}

/** Whether a persisted contribution carries the `submittedAt` timestamp `daily-quests.ts` needs to match it to a calendar day. */
function hasSubmittedAt(
  contribution: AttributedContribution,
): contribution is AttributedContribution & { submittedAt: number } {
  return typeof (contribution as { submittedAt?: unknown }).submittedAt === "number";
}

/**
 * Builds today's (the UTC calendar day of `now`) quest board directly from
 * the persisted quest-template roster and the real, persisted contribution
 * feed — rather than requiring the caller to hold and pass in either list
 * themselves. Contributions without a `submittedAt` timestamp are excluded
 * rather than throwing, mirroring `dailyMissionResults.ts`'s
 * `computeAndSavePersistedDailyMissionResult`. An empty template roster
 * returns an empty board rather than throwing.
 */
export function buildPersistedDailyQuestBoard(now: number): QuestProgress[] {
  const templates = readAll();
  const contributions = listContributions().filter(hasSubmittedAt) as QuestContribution[];
  return buildDailyQuestBoard(templates, contributions, now);
}

/**
 * Derives a topic's under-covered-argument quest templates (via the
 * already-persisted `trackedArguments.ts` coverage report) and upserts each
 * one into the stored roster, returning the seeded templates. Reuses
 * `buildUnderCoveredArgumentQuests` directly rather than introducing a
 * separate seeding rule — a topic with nothing under-covered seeds nothing.
 */
export function seedQuestTemplatesFromTopicCoverage(
  topic: string,
  thresholds?: CoverageThresholds,
): QuestTemplate[] {
  const report = buildPersistedTopicCoverageReport(topic, thresholds);
  const seeded = buildUnderCoveredArgumentQuests(report, thresholds);
  for (const template of seeded) {
    saveQuestTemplate(template);
  }
  return seeded;
}
