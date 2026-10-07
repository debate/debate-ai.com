/**
 * @fileoverview Persistent storage for the team calendar's
 * `TeamCalendarItem`s (`lib/team-calendar.ts`) — every coaching group's
 * tasks, assignments and group-only virtual tournaments, in one
 * localStorage array keyed by `id`. Mirrors `state/coachingPrograms.ts`:
 * local writes first, then a fire-and-forget tool-record mirror so a
 * signed-in coach sees the same calendar on another device.
 *
 * @module state/teamCalendar
 */

import { isTeamCalendarItem, type TeamCalendarItem } from "../lib/team-calendar";

import {
  mirrorToolRecordDelete,
  mirrorToolRecordSave,
} from "@debate/data-sync/src/state/tool-record-mirror";

export const TEAM_CALENDAR_STORAGE_KEY = "teamCalendarItems";

function readAll(): TeamCalendarItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEAM_CALENDAR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTeamCalendarItem) : [];
  } catch {
    return [];
  }
}

function writeAll(items: TeamCalendarItem[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TEAM_CALENDAR_STORAGE_KEY, JSON.stringify(items));
}

/** Every persisted calendar entry, across all groups. */
export function listTeamCalendarItems(): TeamCalendarItem[] {
  return readAll();
}

/** Saves an entry, overwriting any existing one with the same id. */
export function saveTeamCalendarItem(item: TeamCalendarItem): void {
  const items = readAll();
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) items.push(item);
  else items[index] = item;
  writeAll(items);
  mirrorToolRecordSave("teamCalendarItems", item);
}

/** Deletes an entry by id; a no-op if it isn't stored. */
export function deleteTeamCalendarItem(id: string): void {
  writeAll(readAll().filter((item) => item.id !== id));
  mirrorToolRecordDelete("teamCalendarItems", id);
}

/** Whether a `storage` event from another tab touched the calendar or the group list it is scoped by. */
export function isTeamCalendarLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return event.key === null || event.key === TEAM_CALENDAR_STORAGE_KEY || event.key === "coachingPrograms";
}
