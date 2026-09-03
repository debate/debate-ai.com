"use client";

/**
 * @fileoverview Entry points a host toolbar can offer for ebb without
 * mounting ebb's own full-screen start screen — used by debate-round's
 * `FlowPageSidebar` quick-action row so "New flow" / "Open" / "Join with a
 * code" / "Settings" and the recent-flows list sit beside the round
 * toolbar's other buttons (split view, history, round) instead of only
 * being reachable by first switching to the pinned ebb tab and finding an
 * otherwise-empty panel.
 *
 * Every action here is a thin call into state `EbbFlowEmbed` already reacts
 * to once mounted (`newFlowOpen`, `settingsOpen`, the join dialog's own
 * store, `pendingOpenPath`), so a caller need not know whether the embed is
 * currently mounted — only call `activate` (the host's own "switch to the
 * ebb tab" handler) alongside these so it is by the time the user needs it.
 *
 * @module lib/start/quickActions
 */

import { executeCommand } from "../commands/commands";
import { openFlowFromPicker } from "../commands/fileCommands";
import { useFlowStore } from "../store/useFlowStore";
import { isDesktop } from "../update/adapter";

export { useRecentFlows, type RecentEntry, type RecentFlows } from "../../components/start/useRecentFlows";
export { relativeTime } from "./format";
export { isDesktop };

/** Opens the "New flow" prompt (same one the File menu and `n` on the old start screen used). */
export function openNewEbbFlow(): void {
    useFlowStore.getState().setNewFlowOpen(true);
}

/** Shows the native file picker and opens whatever `.ebb` file is chosen. */
export function openEbbFlowPicker(): Promise<void> {
    return openFlowFromPicker();
}

/** Opens ebb's settings dialog. */
export function openEbbSettings(): void {
    useFlowStore.getState().setSettingsOpen(true);
}

/** Prompts for a share code and opens the round it points to. Desktop only. */
export function joinEbbWithCode(): void {
    executeCommand("collab.join");
}

/** Opens a specific flow file, e.g. a row from `useRecentFlows`. */
export function openEbbFlowPath(path: string): void {
    useFlowStore.getState().setPendingOpenPath(path);
}
