/**
 * @fileoverview Persistent storage for a topic's tracked-argument checklist —
 * the "(b) a team-editable tracked-argument checklist per topic" follow-up
 * named under the "📊 Topic Coverage Dashboard" idea in TODO.md. Stores
 * `TrackedArgumentRecord`s in localStorage, mirroring the existing
 * `evidenceLibraryEntries.ts` persistence convention (SSR/no-storage safe,
 * corrupt or missing JSON degrades to an empty list rather than throwing).
 *
 * `buildPersistedTopicCoverageReport` composes this checklist with the
 * already-persisted `evidenceLibraryEntries.ts` store against the pure
 * `buildTopicCoverageReport` in `lib/topic-coverage.ts` — every
 * `EvidenceLibraryEntry` is already a `CoverageCardSummary` (it carries
 * `argBlock`/`wordCount`), so no new card shape is needed. This closes the
 * data-source half of that idea's "(c) a coverage dashboard UI" follow-up;
 * see `panels/TopicCoverageDashboardPanel.tsx` for the rendering half.
 *
 * @module state/trackedArguments
 */

import type { TrackedArgument } from "../lib/topic-coverage";
import { buildTopicCoverageReport, type CoverageThresholds, type TopicCoverageReport } from "../lib/topic-coverage";
import { listEvidenceLibraryEntries } from "./evidenceLibraryEntries";

/** A tracked argument, scoped to a topic and identified for CRUD. */
export interface TrackedArgumentRecord extends TrackedArgument {
  id: string;
  topic: string;
}

const STORAGE_KEY = "trackedArguments";

function readAll(): TrackedArgumentRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackedArgumentRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: TrackedArgumentRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted tracked argument, optionally scoped to one topic. */
export function listTrackedArguments(topic?: string): TrackedArgumentRecord[] {
  const all = readAll();
  return topic === undefined ? all : all.filter((record) => record.topic === topic);
}

/** Lists every distinct topic with at least one tracked argument, sorted alphabetically. */
export function listTrackedTopics(): string[] {
  return Array.from(new Set(readAll().map((record) => record.topic))).sort((a, b) => a.localeCompare(b));
}

/** Saves a tracked argument, overwriting any existing record with the same id. */
export function saveTrackedArgument(record: TrackedArgumentRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a persisted tracked argument by id; a no-op if it isn't stored. */
export function deleteTrackedArgument(id: string): void {
  writeAll(readAll().filter((record) => record.id !== id));
}

/**
 * Builds a topic's coverage report entirely from persisted stores: this
 * topic's tracked-argument checklist, and the shared evidence library's
 * entries filed under that topic (every `EvidenceLibraryEntry` is already a
 * `CoverageCardSummary`).
 */
export function buildPersistedTopicCoverageReport(
  topic: string,
  thresholds?: CoverageThresholds,
): TopicCoverageReport {
  const tracked = listTrackedArguments(topic);
  const cards = listEvidenceLibraryEntries()
    .filter((entry) => entry.topic === topic)
    .map((entry) => ({ id: entry.id, argBlock: entry.argBlock, wordCount: entry.wordCount }));
  return buildTopicCoverageReport(tracked, cards, thresholds);
}
