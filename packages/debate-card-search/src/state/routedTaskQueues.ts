/**
 * @fileoverview Persistent storage for `research-task-routing.ts`'s
 * `RoutingResult`, keyed by a caller-supplied `topicId` — the other half of
 * the "(a) persisted contributor profiles (active task count — skill level
 * is now derived) and a persisted task queue" follow-up named in the
 * "Research Task Routing" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features list (the contributor-profile half is already covered
 * by `contributorAvailability.ts`). Stores a topic's most recently routed
 * task queue in localStorage, mirroring the existing `drillSets.ts`/
 * `flowSummaries.ts` persistence convention (SSR/no-storage-safe, corrupt or
 * missing JSON degrades to an empty list rather than throwing). This is a
 * persistence slice only — it stores whatever `RoutingResult` a caller
 * passes in verbatim (`buildRoutingResult`/`routeTasks` themselves are
 * unchanged); no task-assignment/inbox UI in this repo yet reads or writes
 * through this store.
 *
 * @module state/routedTaskQueues
 */

import type { RoutingResult } from "../lib/research-task-routing";

export type RoutedTaskQueueRecord = {
  topicId: string;
  result: RoutingResult;
};

const STORAGE_KEY = "routedTaskQueues";

function readAll(): RoutedTaskQueueRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoutedTaskQueueRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: RoutedTaskQueueRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted routed task queue, across all topics. */
export function listRoutedTaskQueues(): RoutedTaskQueueRecord[] {
  return readAll();
}

/** Looks up the persisted routed task queue for a topic, if any. */
export function getRoutedTaskQueue(topicId: string): RoutedTaskQueueRecord | undefined {
  return readAll().find((record) => record.topicId === topicId);
}

/** Saves a topic's routed task queue, overwriting any existing record for that `topicId`. */
export function saveRoutedTaskQueue(record: RoutedTaskQueueRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.topicId === record.topicId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a topic's persisted routed task queue; a no-op if it isn't stored. */
export function deleteRoutedTaskQueue(topicId: string): void {
  writeAll(readAll().filter((record) => record.topicId !== topicId));
}
