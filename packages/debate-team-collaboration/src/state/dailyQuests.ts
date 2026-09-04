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
 * `rolloverExpiredRecurringQuestTemplates` closes the "no recurring-quest
 * concept" Known gap: it applies `daily-quests.ts`'s
 * `rolloverRecurringQuestTemplate` to every persisted template, advancing an
 * expired recurring template's `expiresOn` forward to its next cycle instead
 * of leaving it expired. `buildPersistedDailyQuestBoard` calls this first so
 * a recurring quest reappears on the board on its own the next time anyone
 * loads it — no manual cleanup action needed — and `pruneExpiredQuestTemplates`
 * calls it first too, so a recurring template is never deleted as "expired".
 *
 * @module state/dailyQuests
 */

import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";
import { getUtcDayKey } from "debate-research-evidence/src/lib/daily-best-card";
import {
  buildDailyQuestBoard,
  buildUnderCoveredArgumentQuests,
  isQuestTemplateExpired,
  rolloverRecurringQuestTemplate,
  type QuestContribution,
  type QuestProgress,
  type QuestTemplate,
} from "../lib/daily-quests";
import type { CoverageThresholds } from "debate-research-evidence/src/lib/topic-coverage";
import { listContributions } from "debate-research-evidence/src/state/contributions";
import { buildPersistedTopicCoverageReport } from "debate-research-evidence/src/state/trackedArguments";

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
  rolloverExpiredRecurringQuestTemplates(now);
  const dayKey = getUtcDayKey(now);
  const templates = readAll();
  const remaining = templates.filter((template) => !isQuestTemplateExpired(template, dayKey));
  const removedCount = templates.length - remaining.length;
  if (removedCount > 0) writeAll(remaining);
  return removedCount;
}

/**
 * Rolls every persisted template's `expiresOn` forward via
 * `rolloverRecurringQuestTemplate`: a non-recurring or not-yet-expired
 * template is untouched, but an expired recurring template gets a new
 * `expiresOn` on/after the UTC calendar day of `now`, so it counts as active
 * again for its next cycle. Returns how many templates were rolled over.
 */
export function rolloverExpiredRecurringQuestTemplates(now: number): number {
  const dayKey = getUtcDayKey(now);
  const templates = readAll();
  let rolledOverCount = 0;
  const updated = templates.map((template) => {
    const rolled = rolloverRecurringQuestTemplate(template, dayKey);
    if (rolled !== template) rolledOverCount++;
    return rolled;
  });
  if (rolledOverCount > 0) writeAll(updated);
  return rolledOverCount;
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
 * returns an empty board rather than throwing. Rolls over any expired
 * recurring template first (see `rolloverExpiredRecurringQuestTemplates`), so
 * a recurring quest is already back on the board, freshly at 0 progress for
 * its new cycle.
 */
export function buildPersistedDailyQuestBoard(now: number): QuestProgress[] {
  rolloverExpiredRecurringQuestTemplates(now);
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
