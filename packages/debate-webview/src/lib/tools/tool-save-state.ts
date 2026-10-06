/**
 * @fileoverview Pure helper behind the "Saved to your account" badge in a
 * tool page's header (`components/tools/ToolSyncBadge.tsx`).
 *
 * `ToolSyncStatusPanel` answers "is everything synced?" once, on `/tools`;
 * this answers the same question for the one tool a person is looking at,
 * from the per-collection statuses `getToolRecordCollectionSyncStatus` reports.
 *
 * @module lib/tools/tool-save-state
 */

import type { ToolRecordSyncStatus } from "@debate/data-sync/src/state/tool-record-auto-sync"

export type ToolSaveState = "local" | "checking" | "saving" | "saved"

export interface ToolSaveDisplay {
  state: ToolSaveState
  /** Short badge text. */
  label: string
  /** Longer explanation for the badge's tooltip. */
  title: string
}

const DISPLAYS: Record<ToolSaveState, ToolSaveDisplay> = {
  local: {
    state: "local",
    label: "Saved on this device",
    title: "Sign in to keep this tool's data on your account and use it on other devices.",
  },
  checking: {
    state: "checking",
    label: "Syncing…",
    title: "Merging this tool's data with your account.",
  },
  saving: {
    state: "saving",
    label: "Saving to your account…",
    title: "Recent changes are on their way to your account.",
  },
  saved: {
    state: "saved",
    label: "Saved to your account",
    title: "This tool's data is synced to your account.",
  },
}

/**
 * Collapses a tool's collection statuses into one badge state. Signed out is
 * always `local`; any pending collection wins over synced; an unknown one
 * (no baseline yet) reads as still syncing; no collections at all means the
 * tool stores nothing to sync, so there's nothing to show (`null`).
 */
export function describeToolSaveState(
  signedIn: boolean,
  statuses: readonly ToolRecordSyncStatus[],
): ToolSaveDisplay | null {
  if (statuses.length === 0) return null
  if (!signedIn) return DISPLAYS.local
  if (statuses.includes("pending")) return DISPLAYS.saving
  if (statuses.includes("unknown")) return DISPLAYS.checking
  return DISPLAYS.saved
}

export interface SaveNowButtonDisplay {
  label: string
  title: string
}

/**
 * What the "Save now" button beside the badge should say, or `null` when it
 * shouldn't show. It appears while a save is pending (`saving`) or after a
 * failed attempt (so it can offer a retry), and never for a signed-out or
 * fully synced tool, where there is nothing to flush.
 */
export function describeSaveNowButton(
  state: ToolSaveState,
  saving: boolean,
  saveError: string | null,
): SaveNowButtonDisplay | null {
  if (state !== "saving" && saveError === null) return null
  return {
    label: saving ? "Saving…" : saveError ? "Retry save" : "Save now",
    title: saveError ? `Couldn't save: ${saveError}. Try again.` : "Save this tool's changes to your account now.",
  }
}
